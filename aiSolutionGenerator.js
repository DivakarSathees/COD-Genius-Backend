require('dotenv').config();
const fs = require('fs');
const path = require('path');
const encoder = require('gpt-3-encoder');
const { jsonrepair } = require('jsonrepair');
const { callLLM } = require('./llmClient');

function loadGuidelines() {
    const p = path.join(__dirname, 'questionGuidelines.md');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function getTokenCount(input) {
    const encoded = encoder.encode(input);
    return encoded.length;
}

function filterEmptyInputs(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter(tc => typeof tc.input === 'string' && tc.input.trim() !== '');
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
function buildPrompt({ question_data, inputformat, outputformat, constraints, language, provider, useGuidelines = false }) {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';

    const returnShape = isAzure
        ? `{ "items": [ { "solution_data": "...", "samples": [...], "io_spec": {...} } ] }`
        : `[ { "solution_data": "...", "samples": [...], "io_spec": {...} } ]`;

    const tcRules = useGuidelines
        ? `- Produce EXACTLY 12 distinct test cases ordered by ascending difficulty (Easy → Hard).
- Weightage MUST be in ascending order and total exactly 100. Use this pattern: Easy=10, Easy=10, Medium=15, Medium=15, Hard=25, Hard=25 (adjust if needed but total must be 100 and order must be ascending).
- From the 12 test cases, mark EXACTLY 2 to 3 as "isSampleIO": true — these are shown to students and must each cover a DIFFERENT output scenario (e.g. typical case, edge/boundary case, error/invalid case if applicable). Set "isSampleIO": false for the rest.
- No duplicate inputs or outputs across test cases.
- CRITICAL: Every test case "input" field MUST be non-empty and contain actual input values — never an empty string, never whitespace only.
- Manually verify each test case output against the solution logic.`
        : `- Produce 13 to 18 distinct sample input/output pairs (a few extra to account for any filtered-out empty inputs; the final valid set should be 10 to 15).
- CRITICAL: Every test case "input" field MUST be non-empty and contain actual input values — never an empty string, never whitespace only.
- Scores must sum to exactly 100 across all samples (Easy=low, Medium=normal, Hard=high score).
- Add "isSampleIO": false to all samples (user will select manually).`;

    const prompt = `You are an assistant that must return ONLY valid JSON (no Markdown, no code fences, no commentary).
Infer the most appropriate programming language from the question; if unclear, default to Java.

Requirements:
- Provide a COMPLETE, RUNNABLE solution with ALL required imports.
- The program must read dynamic user input from STDIN and print to STDOUT exactly as specified.
- Do NOT include any placeholder text like "...", "your code here", etc.
- All special characters inside JSON strings (newlines, tabs, backslashes, double quotes) MUST be properly escaped.
${tcRules}
- Ensure the JSON is syntactically valid.
- STRICT JAVA RULE: If the language is Java, the public class name MUST be exactly "Main" (i.e. "public class Main"). No other class name is allowed as the entry point.
- STRICT C++ RULE: If the language is C++, use a standard "int main()" entry point. Include necessary headers (e.g. #include <iostream>, #include <vector>, etc.) and use "using namespace std;" for simplicity. The program must compile with g++ without errors.

Return JSON in this exact shape:
${returnShape}

Where each item has:
- "solution_data": complete runnable source code as a properly escaped JSON string
- "samples": array of { "input": "...", "output": "...", "difficulty": "Easy|Medium|Hard", "score": number, "isSampleIO": boolean }
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

const TC_FILTER_BUFFER = 3;

function buildTestcasePrompt({ question_data, solution_data, language, count, provider, useGuidelines = false, targetN = null }) {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';
    const target = targetN ?? (useGuidelines ? 9 : Math.max(1, Math.min(50, parseInt(count) || 15)));
    const generateN = target + TC_FILTER_BUFFER;

    const returnShape = isAzure
        ? `{ "items": { "testcases": [...], "samples": [...] } }`
        : `{ "testcases": [...], "samples": [...] }`;

    const guidelinesRules = useGuidelines
        ? `- Generate EXACTLY ${generateN} test cases ordered by ascending difficulty (approximately ${Math.ceil(generateN / 3)} Easy, ${Math.ceil(generateN / 3)} Medium, ${Math.floor(generateN / 3)} Hard).
- Weightage in ASCENDING order totalling exactly 100. Easy tests get low scores, Medium get mid scores, Hard get high scores.
- No duplicate inputs or outputs across the test cases.
- Manually verify each test case output against the solution logic.
- Select EXACTLY 2 to 3 test cases as "samples" (shown to students). Each sample must cover a DIFFERENT output scenario (e.g. typical, edge/boundary, error/invalid). They must be a subset of testcases.`
        : `- Scores of ALL test cases must sum to exactly 100.
- Select 2 to 5 representative test cases as "samples" covering all possible input/output patterns.`;

    return `You are a test-case generator. Return ONLY valid JSON — no Markdown, no code fences, no commentary.

Task: Given the problem description and the reference solution below, generate exactly ${generateN} distinct test cases.
Note: ${TC_FILTER_BUFFER} extra test cases are requested as a buffer — any test case with an empty or whitespace-only "input" will be discarded, and exactly ${target} valid test cases are required after discarding.

Rules:
- Each test case must have: "input", "output", "difficulty" (Easy|Medium|Hard), "score" (number).
- The "output" must be the EXACT output produced by running the provided solution against the "input".
- CRITICAL: Every test case "input" field MUST be non-empty and contain actual input values — never an empty string, never whitespace only.
- Cover a wide range of scenarios: minimum values, maximum values, edge cases, typical cases, stress cases.
${guidelinesRules}
- The "samples" array must be a SUBSET of "testcases" (same input/output values).

Return this exact JSON shape:
${returnShape}

Where:
- "testcases": array of all ${generateN} test cases: [{ "input": "...", "output": "...", "difficulty": "Easy|Medium|Hard", "score": number }]
- "samples": array of selected sample I/O test cases (subset, same shape)

Problem:
${question_data}

Language: ${language || 'Java'}

Reference Solution:
${solution_data}

Return only valid JSON. No explanations.`;
}

exports.aiTestcaseGenerator = async ({ question_data, solution_data, language, count, provider = 'groq', model, useGuidelines = false, guidelinesContent: incomingGuidelines = null }) => {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';
    const targetN = useGuidelines ? 9 : Math.max(1, Math.min(50, parseInt(count) || 15));
    const prompt = buildTestcasePrompt({ question_data, solution_data, language, count, provider, useGuidelines, targetN });

    const guidelinesContent = useGuidelines ? (incomingGuidelines || loadGuidelines()) : null;
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

    const { text: resultText, usage } = await callLLM({ provider, model, messages, jsonMode: isAzure });
    console.log('[aiTestcaseGenerator] raw response (first 500):', resultText.substring(0, 500));

    try {
        let text = stripCodeFences(resultText);

        const applyFilters = (inner) => {
            inner.testcases = filterEmptyInputs(inner.testcases).slice(0, targetN);
            inner.samples = filterEmptyInputs(inner.samples);
            return inner;
        };

        try {
            const obj = JSON.parse(text);
            const inner = isAzure && obj?.items ? obj.items : obj;
            if (inner?.testcases) return { result: applyFilters(inner), usage };
        } catch (_) { /* fall through */ }

        const repairedText = jsonrepair(text);
        const parsed = JSON.parse(repairedText);
        const inner = isAzure && parsed?.items ? parsed.items : parsed;
        if (inner?.testcases) return { result: applyFilters(inner), usage };
        throw new Error('Response missing testcases field');
    } catch (e) {
        console.error('[aiTestcaseGenerator] parse error:', e.message);
        throw new Error('The AI response is not valid JSON.');
    }
};

function buildDebugPrompt({ solution_data, question_data, language, testcases = [], bug_count = 3, debug_prompt = '' }) {
    const n = Math.max(1, Math.min(10, parseInt(bug_count) || 3));
    const customRequirements = debug_prompt?.trim()
        ? `\n\nAdditional requirements from instructor:\n${debug_prompt.trim()}`
        : '';

    const tcSection = testcases?.length
        ? `\n\nTest Cases (your buggy code MUST produce WRONG output for at least 70% of these — use them to verify effectiveness):\n${
            testcases.slice(0, 10).map((tc, i) =>
                `TC${i + 1} [${tc.difficulty || 'Medium'}]:\n  Input: ${tc.input}\n  Expected (correct) output: ${tc.output}`
            ).join('\n')
          }`
        : '';

    return `You are a programming instructor creating a debugging exercise for students.

Given the CORRECT solution below, produce a BUGGY version that has EXACTLY ${n} intentional, subtle error(s) students must find and fix.

Rules:
- Introduce EXACTLY ${n} bug(s) — no more, no less.
- Preserve the overall structure, class names, method signatures, and all imports exactly.
- Introduce LOGICAL bugs only (wrong operator, off-by-one, wrong variable used, wrong condition, missing/extra step) — NOT syntax errors.
- The buggy code must still COMPILE successfully but produce WRONG output for most inputs.
- Do NOT add any comments, markers, or hints about where the bugs are.
- The bugs must be EFFECTIVE: when run against the provided test cases, the buggy code must produce incorrect output for the majority of them.
- Return ONLY valid JSON in this exact shape: { "debug_code": "..." }
  where "debug_code" is the complete buggy source code as a properly escaped JSON string.${tcSection}${customRequirements}

Language: ${language || 'Java'}

Problem:
${question_data}

Correct Solution:
${solution_data}

Return only valid JSON. No explanations, no markdown.`;
}

exports.aiDebugCodeGenerator = async ({ solution_data, question_data, language, testcases = [], bug_count = 3, debug_prompt = '', provider = 'groq', model }) => {
    const isAzure = (provider || 'groq').toLowerCase() === 'azure';
    const prompt = buildDebugPrompt({ solution_data, question_data, language, testcases, bug_count, debug_prompt });
    console.log("[aiDebugCodeGenerator] prompt:", prompt);
    
    const messages = [
        { role: 'system', content: 'You are a programming instructor creating debugging exercises. Return only valid JSON, no markdown.' },
        { role: 'user', content: prompt },
    ];

    const { text: resultText, usage } = await callLLM({ provider, model, messages, jsonMode: isAzure });
    console.log('[aiDebugCodeGenerator] raw response (first 500):', resultText.substring(0, 500));

    try {
        let text = stripCodeFences(resultText);

        try {
            const obj = JSON.parse(text);
            const inner = isAzure && obj?.items ? obj.items : obj;
            if (inner?.debug_code) return { debugCode: inner.debug_code, usage };
        } catch (_) { /* fall through */ }

        const repairedText = jsonrepair(text);
        const parsed = JSON.parse(repairedText);
        const inner = isAzure && parsed?.items ? parsed.items : parsed;
        if (inner?.debug_code) return { debugCode: inner.debug_code, usage };
        throw new Error('Response missing debug_code field');
    } catch (e) {
        console.error('[aiDebugCodeGenerator] parse error:', e.message);
        throw new Error('The AI response is not valid JSON.');
    }
};

exports.aiSolutionGenerator = async (req) => {
    try {
        const { question_data, inputformat, outputformat, constraints, language,
                provider = 'groq', model, useGuidelines = false, guidelinesContent: incomingGuidelines = null } = req;

        const isAzure = (provider || 'groq').toLowerCase() === 'azure';
        const prompt = buildPrompt({ question_data, inputformat, outputformat, constraints, language, provider, useGuidelines });

        console.log('[aiSolutionGenerator] provider:', provider, '| model:', model, '| useGuidelines:', useGuidelines);
        console.log('[aiSolutionGenerator] token count:', getTokenCount(prompt));

        const tokenCount = getTokenCount(prompt);
        const tokenLimit = useGuidelines ? 32000 : 8192;
        if (tokenCount > tokenLimit) throw new Error('Input prompt exceeds maximum token limit.');

        const guidelinesContent = useGuidelines ? (incomingGuidelines || loadGuidelines()) : null;
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

        const { text: resultText, usage } = await callLLM({ provider, model, messages, jsonMode: isAzure });
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

            if (Array.isArray(parsedJson)) {
                parsedJson.forEach(item => {
                    if (item.samples) item.samples = filterEmptyInputs(item.samples).slice(0, 15);
                });
            }

            return { result: parsedJson, usage };
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
