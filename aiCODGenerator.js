require('dotenv').config();
const encoder = require('gpt-3-encoder');
const { jsonrepair } = require('jsonrepair');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { callLLM } = require('./llmClient');
const { saveGeneratedQuestion } = require('./questionRegistry');

function getTokenCount(input) {
    const encoded = encoder.encode(input);
    return encoded.length;
}

// ─── MongoDB helpers ──────────────────────────────────────────────────────────
const mongoClient = new MongoClient(process.env.MONGO_URI);
const dbName = 'aiMemoryDB';
const collectionName = 'conversations';
const sessionsCol = 'sessions';

async function connectDB(col) {
    if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
        await mongoClient.connect();
    }
    return mongoClient.db(dbName).collection(col);
}

async function createSession(name, createdBy = 'unknown') {
    const sessions = await connectDB(sessionsCol);
    const sessionId = uuidv4();
    await sessions.insertOne({ _id: sessionId, name, createdBy, createdAt: new Date(), lastActive: new Date() });
    return sessionId;
}

async function updateSessionActivity(sessionId) {
    const sessions = await connectDB(sessionsCol);
    await sessions.updateOne({ _id: sessionId }, { $set: { lastActive: new Date() } });
}

async function saveConversation(sessionId, role, content) {
    const collection = await connectDB(collectionName);
    await collection.insertOne({ sessionId, role, content, timestamp: new Date() });
    await updateSessionActivity(sessionId);
}

async function getConversation(sessionId, limit = 10) {
    const collection = await connectDB(collectionName);
    return collection.find({ sessionId }).sort({ timestamp: 1 }).limit(limit).toArray();
}

// ─── JSON extraction ──────────────────────────────────────────────────────────
function stripCodeFences(text) {
    return text.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function extractJSONArray(text) {
    text = stripCodeFences(text);

    // Azure json_object mode wraps in { "items": [...] } — unwrap it
    try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            const key = Object.keys(obj)[0];
            if (Array.isArray(obj[key])) return JSON.stringify(obj[key]);
        }
        if (Array.isArray(obj)) return JSON.stringify(obj);
    } catch (_) { /* fall through to bracket scan */ }

    const startIndex = text.indexOf('[');
    if (startIndex === -1) throw new Error('No JSON array found in response');

    let bracketCount = 0;
    let endIndex = -1;
    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '[') bracketCount++;
        else if (text[i] === ']') bracketCount--;
        if (bracketCount === 0) { endIndex = i; break; }
    }
    if (endIndex === -1) throw new Error('JSON array not closed properly');
    return text.slice(startIndex, endIndex + 1);
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildCODPrompt({ prompt, format, language, topic, difficulty_level, count, provider, excludeScenarios = [] }) {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';

    let basePrompt = prompt ||
        `Generate ${count} unique scenario based ${difficulty_level} level ${language} programming description(s) on ${topic}`;

    const exampleDetailed = `{
    "question_data": "<h3>Problem Statement: Bike Number Plate Verification System</h3><h4>Objective</h4><p>Create a Bike Number Plate Verification System using C# OOP principles...</p>",
    "inputformat": "<p>1. Number of bikes to be added to the system.</p>",
    "outputformat": "<p>For each bike, print the BikeID, Number Plate and whether the number plate is valid.</p>",
    "constraints": "<ul><li>1 ≤ N ≤ 1000</li><li>Number plate length: 6–10 characters</li><li>Time limit: 1 second</li></ul>",
    "manual_difficulty": "Easy",
    "language": "C#"
  }`;

    const exampleSimple = `{
    "question_data": "<p><strong><u>Find the First Non-Repeating Character in a String</u></strong></p><p>Write a program that finds the first character that does not repeat.</p>",
    "inputformat": "<p>A single line containing a string s.</p>",
    "outputformat": "<ul><li>If a non-repeating character exists, print that character.</li><li>Otherwise, print: No non-repeating character found!</li></ul>",
    "constraints": "<ul><li>1 ≤ |s| ≤ 10<sup>5</sup></li><li>s contains only lowercase English letters</li></ul>",
    "manual_difficulty": "Easy",
    "language": "C#"
  }`;

    const example = format === 'detailed' ? exampleDetailed : format === 'simple' ? exampleSimple : exampleDetailed;

    // Azure requires a root JSON object — wrap in { "items": [...] }
    const wrapperNote = isAzure
        ? `Wrap the array in a JSON object: { "items": [ ...your ${count} questions... ] }`
        : `Return a bare JSON array: [ ...your ${count} questions... ]`;

    const fullPrompt = `${basePrompt}.

You are an AI that generates scenario-based programming questions in a structured JSON format.

Example item structure:
${example}

Rules:
- Be scenario-based (real-world context).
- Include a Title, Problem Description, and a clear Question section.
- Specify Classes/Methods if needed.
- Use HTML formatting for rich text (question_data, inputformat, outputformat, constraints).
- Each item must be unique — different scenario, different problem title, different logic.
- Do not repeat scenarios from previous responses.${excludeScenarios.length > 0 ? `\n- IMPORTANT: The following scenarios have already been generated for this user. Do NOT generate any question with a similar scenario, domain, or problem context — even if the title is different:\n${excludeScenarios.map(s => `  • ${s}`).join('\n')}` : ''}

${wrapperNote}
The array must contain exactly ${count} item(s).
Each item must have: "question_data", "inputformat", "outputformat", "constraints", "manual_difficulty" (Easy|Medium|Hard), "language".
Do not include any explanations, extra text, or markdown formatting — return only valid JSON.`;

    return fullPrompt;
}

// ─── Main export ──────────────────────────────────────────────────────────────
exports.aiCODGenerator = async (req) => {
    try {
        let { sessionId, prompt, format, language, topic, difficulty_level, count,
              provider = 'groq', model, excludeScenarios = [], createdBy = 'unknown' } = req;

        count = Math.max(1, parseInt(count) || 1);
        const isAzure = (provider || 'groq').toLowerCase() === 'azure';

        if (!sessionId) {
            sessionId = await createSession(`${language} - ${topic}`, createdBy);
        }

        const history = await getConversation(sessionId);

        const fullPrompt = buildCODPrompt({ prompt, format, language, topic, difficulty_level, count, provider, excludeScenarios });

        console.log('[aiCODGenerator] provider:', provider, '| model:', model, '| count:', count);

        const tokenCount = getTokenCount(fullPrompt);
        if (tokenCount > 8192) throw new Error('Input prompt exceeds maximum token limit.');

        const messages = [
            {
                role: 'system',
                content: isAzure
                    ? 'You are a COD Problem generator. Always return valid JSON only, no markdown.'
                    : 'You are a COD Problem generator.',
            },
            ...history.map((msg) => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: fullPrompt },
        ];

        const resultText = await callLLM({ provider, model, messages, jsonMode: isAzure });
        console.log('[aiCODGenerator] raw response (first 500):', resultText.substring(0, 500));

        await saveConversation(sessionId, 'user', fullPrompt);
        await saveConversation(sessionId, 'assistant', resultText);

        try {
            const jsonArrayText = extractJSONArray(resultText);
            let parsedJson;

            try {
                parsedJson = JSON.parse(jsonArrayText);
            } catch (parseError) {
                console.warn('[aiCODGenerator] Initial parse failed, repairing...');
                console.warn('[aiCODGenerator] Extracted JSON (first 1000):', jsonArrayText.substring(0, 1000));
                const repairedJson = jsonrepair(jsonArrayText);
                parsedJson = JSON.parse(repairedJson);
            }

            // Save every generated question immediately so the same scenario is never re-generated
            for (const q of parsedJson) {
                if (q.question_data) {
                    await saveGeneratedQuestion({
                        question_data: q.question_data,
                        language: q.language || language,
                        topic: topic || '',
                        generatedBy: createdBy,
                        sessionId,
                    }).catch(err => console.warn('[Registry] Failed to save generated question:', err.message));
                }
            }

            return { sessionId, result: parsedJson };
        } catch (e) {
            console.error('[aiCODGenerator] Failed to parse JSON:', e.message);
            console.error('[aiCODGenerator] Raw LLM response (first 2000):', resultText.substring(0, 2000));
            throw new Error('The AI response is not valid JSON.');
        }

    } catch (error) {
        console.error('Error in aiCODGenerator:', error);
        throw error;
    }
};
