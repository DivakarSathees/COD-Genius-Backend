require('dotenv').config();
const encoder = require('gpt-3-encoder');
const { jsonrepair } = require('jsonrepair');
const { callLLM } = require('./llmClient');

function getTokenCount(input) {
    const encoded = encoder.encode(input);
    return encoded.length;
}

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
    } catch (_) { /* not fully valid JSON yet, fall through to bracket scan */ }

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

/**
 * Build the prompt for the solution generator.
 * For Azure (jsonMode=true), the system message instructs the model to wrap in
 * { "items": [...] } so that response_format: json_object is satisfied.
 */
function buildPrompt({ question_data, inputformat, outputformat, language, provider }) {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';

    const returnShape = isAzure
        ? `{ "items": [ { "solution_data": "...", "samples": [...], "io_spec": {...} } ] }`
        : `[ { "solution_data": "...", "samples": [...], "io_spec": {...} } ]`;

    const prompt = `You are an assistant that must return ONLY valid JSON (no Markdown, no code fences, no commentary).
Infer the most appropriate programming language from the question; if unclear, default to Java.

Requirements:
- Provide a COMPLETE, RUNNABLE solution with ALL required imports.
- The program must read dynamic user input from STDIN and print to STDOUT exactly as specified.
- Do NOT include any placeholder text like "...", "your code here", etc.
- All special characters inside JSON strings (newlines, tabs, backslashes, double quotes) MUST be properly escaped.
- Produce 10 to 15 distinct sample input/output pairs that cover edge cases, with a score per sample summing to 100 (Easy=low, Medium=normal, Hard=high score).
- Ensure the JSON is syntactically valid.
- STRICT JAVA RULE: If the language is Java, the public class name MUST be exactly "Main" (i.e. "public class Main"). No other class name is allowed as the entry point.

Return JSON in this exact shape:
${returnShape}

Where each item has:
- "solution_data": complete runnable source code as a properly escaped JSON string
- "samples": array of { "input": "...", "output": "...", "difficulty": "Easy|Medium|Hard", "score": number }
- "io_spec": { "input_format": "...", "output_format": "..." }

Question context:
question_data: ${question_data}
inputformat: ${inputformat}
outputformat: ${outputformat}
language: ${language || 'Java'}

Return only valid JSON. No explanations, no markdown.`;

    return prompt;
}

exports.aiSolutionGenerator = async (req) => {
    try {
        const { question_data, inputformat, outputformat, language,
                provider = 'groq', model } = req;

        const isAzure = (provider || 'groq').toLowerCase() === 'azure';
        const prompt = buildPrompt({ question_data, inputformat, outputformat, language, provider });

        console.log('[aiSolutionGenerator] provider:', provider, '| model:', model);
        console.log('[aiSolutionGenerator] token count:', getTokenCount(prompt));

        const tokenCount = getTokenCount(prompt);
        if (tokenCount > 8192) throw new Error('Input prompt exceeds maximum token limit.');

        const messages = [
            {
                role: 'system',
                content: isAzure
                    ? 'You are a programming solution generator. Always return valid JSON only, no markdown.'
                    : 'You are a Compiler-based Problem Solution generator.',
            },
            { role: 'user', content: prompt },
        ];

        const resultText = await callLLM({ provider, model, messages, jsonMode: isAzure });
        console.log('[aiSolutionGenerator] raw response (first 500):', resultText.substring(0, 500));

        try {
            const jsonArrayText = extractJSONArray(resultText);
            let parsedJson;

            try {
                parsedJson = JSON.parse(jsonArrayText);
            } catch (parseError) {
                console.warn('[aiSolutionGenerator] Initial parse failed, repairing...');
                console.warn('[aiSolutionGenerator] Extracted JSON (first 1000):', jsonArrayText.substring(0, 1000));
                const repairedJson = jsonrepair(jsonArrayText);
                parsedJson = JSON.parse(repairedJson);
            }

            return parsedJson;
        } catch (e) {
            console.error('[aiSolutionGenerator] Failed to parse JSON:', e.message);
            console.error('[aiSolutionGenerator] Raw LLM response (first 2000):', resultText.substring(0, 2000));
            throw new Error('The AI response is not valid JSON.');
        }

    } catch (error) {
        console.error('Error in aiSolutionGenerator:', error);
        throw error;
    }
};
