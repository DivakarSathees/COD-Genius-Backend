require('dotenv').config();
const fs = require('fs');
const path = require('path');
const encoder = require('gpt-3-encoder');
const { jsonrepair } = require('jsonrepair');
const { callLLM } = require('./llmClient');

let _guidelinesCache = null;
function loadGuidelines() {
    if (!_guidelinesCache) {
        const p = path.join(__dirname, 'questionGuidelines.md');
        _guidelinesCache = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    }
    return _guidelinesCache;
}

function getTokenCount(input) {
    const encoded = encoder.encode(input);
    return encoded.length;
}

function stripCodeFences(text) {
    return text.replace(/^```(?:json|javascript|js|cpp|c\+\+)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
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
function buildPrompt({ question_data, inputformat, outputformat, constraints, language, provider }) {
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
- STRICT C++ RULE: If the language is C++, use a standard "int main()" entry point. Include necessary headers (e.g. #include <iostream>, #include <vector>, etc.) and use "using namespace std;" for simplicity. The program must compile with g++ without errors.

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
constraints: ${constraints || ''}
language: ${language || 'Java'}

Return only valid JSON. No explanations, no markdown.`;

    return prompt;
}

function buildTestcasePrompt({ question_data, solution_data, language, count, provider }) {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';
    const n = Math.max(1, Math.min(50, parseInt(count) || 15));

    const returnShape = isAzure
        ? `{ "items": { "testcases": [...], "samples": [...] } }`
        : `{ "testcases": [...], "samples": [...] }`;

    return `You are a test-case generator. Return ONLY valid JSON — no Markdown, no code fences, no commentary.

Task: Given the problem description and the reference solution below, generate exactly ${n} distinct test cases.

Rules:
- Each test case must have: "input", "output", "difficulty" (Easy|Medium|Hard), "score" (number).
- The "output" must be the EXACT output produced by running the provided solution against the "input".
- Cover a wide range of scenarios: minimum values, maximum values, edge cases, typical cases, stress cases.
- Scores of ALL test cases in "testcases" array must sum to exactly 100.
- From the ${n} test cases, the AI must select the BEST representative ones as "samples" (sample I/O shown to users). Choose samples that together cover ALL possible input/output patterns and edge cases. Include at least 2 and at most 5 samples.
- The "samples" array must be a SUBSET of "testcases" (same input/output values).

Return this exact JSON shape:
${returnShape}

Where:
- "testcases": array of all ${n} test cases: [{ "input": "...", "output": "...", "difficulty": "Easy|Medium|Hard", "score": number }]
- "samples": array of selected sample I/O test cases (subset, same shape, score field can be 0)

Problem:
${question_data}

Language: ${language || 'Java'}

Reference Solution:
${solution_data}

Return only valid JSON. No explanations.`;
}

exports.aiTestcaseGenerator = async ({ question_data, solution_data, language, count, provider = 'groq', model, useGuidelines = false }) => {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';
    const prompt = buildTestcasePrompt({ question_data, solution_data, language, count, provider });

    const guidelinesContent = useGuidelines ? loadGuidelines() : null;
    const systemContent = [
        isAzure
            ? 'You are a test-case generator. Always return valid JSON only, no markdown.'
            : 'You are a test-case generator for programming problems.',
        guidelinesContent ? `\n\nFOLLOW THESE QUESTION CREATION GUIDELINES STRICTLY (especially Parameter 5: Sample Input, Parameter 6: Sample Output, Parameter 8: Hidden Test Cases rules):\n\n${guidelinesContent}` : '',
    ].join('');

    const messages = [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
    ];

    const resultText = await callLLM({ provider, model, messages, jsonMode: isAzure });
    console.log('[aiTestcaseGenerator] raw response (first 500):', resultText.substring(0, 500));

    try {
        let text = stripCodeFences(resultText);

        // Azure wraps in { "items": { ... } }
        try {
            const obj = JSON.parse(text);
            const inner = isAzure && obj?.items ? obj.items : obj;
            if (inner?.testcases) return inner;
        } catch (_) { /* fall through */ }

        const repairedText = jsonrepair(text);
        const parsed = JSON.parse(repairedText);
        const inner = isAzure && parsed?.items ? parsed.items : parsed;
        if (inner?.testcases) return inner;
        throw new Error('Response missing testcases field');
    } catch (e) {
        console.error('[aiTestcaseGenerator] parse error:', e.message);
        throw new Error('The AI response is not valid JSON.');
    }
};

exports.aiSolutionGenerator = async (req) => {
    try {
        const { question_data, inputformat, outputformat, constraints, language,
                provider = 'groq', model, useGuidelines = false } = req;

        const isAzure = (provider || 'groq').toLowerCase() === 'azure';
        const prompt = buildPrompt({ question_data, inputformat, outputformat, constraints, language, provider });

        console.log('[aiSolutionGenerator] provider:', provider, '| model:', model, '| useGuidelines:', useGuidelines);
        console.log('[aiSolutionGenerator] token count:', getTokenCount(prompt));

        const tokenCount = getTokenCount(prompt);
        const tokenLimit = useGuidelines ? 32000 : 8192;
        if (tokenCount > tokenLimit) throw new Error('Input prompt exceeds maximum token limit.');

        const guidelinesContent = useGuidelines ? loadGuidelines() : null;
        const systemContent = [
            isAzure
                ? 'You are a programming solution generator. Always return valid JSON only, no markdown.'
                : 'You are a Compiler-based Problem Solution generator.',
            guidelinesContent ? `\n\nFOLLOW THESE QUESTION CREATION GUIDELINES STRICTLY (especially Parameter 7: Solution rules, Parameter 8: Hidden Test Cases rules):\n\n${guidelinesContent}` : '',
        ].join('');

        const messages = [
            { role: 'system', content: systemContent },
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
