require('dotenv').config();
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const mongoClient = new MongoClient(process.env.MONGO_URI);
const dbName = 'aiMemoryDB';
const COLLECTION = 'generatedQuestions'; // renamed — tracks ALL generated, not just uploaded

async function connectDB() {
    if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
        await mongoClient.connect();
    }
    return mongoClient.db(dbName).collection(COLLECTION);
}

// ─── Scenario extraction ──────────────────────────────────────────────────────

/**
 * Strip HTML tags and decode basic entities from a string.
 */
function stripHtml(html = '') {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract the problem title from question_data HTML.
 * Looks for first <h1>–<h4>, then <strong><u>, then <strong>, then first 100 chars.
 */
function extractTitle(html = '') {
    let m = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    if (!m) m = html.match(/<strong[^>]*><u[^>]*>([\s\S]*?)<\/u>/i);
    if (!m) m = html.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const raw = m ? m[1] : html.substring(0, 150);
    return stripHtml(raw).replace(/^(Problem Statement:|Title:|Objective:)/i, '').trim().substring(0, 120);
}

/**
 * Extract the scenario — title + first meaningful paragraph of problem description.
 * This is what gets sent to the LLM as "do not repeat" context.
 */
function extractScenario(html = '') {
    const title = extractTitle(html);

    // Find first <p> with real content after the title
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    let firstDesc = '';
    for (const p of paragraphs) {
        const text = stripHtml(p[1]).trim();
        // Skip very short paragraphs or ones that are just the title repeated
        if (text.length > 40 && !text.toLowerCase().includes(title.toLowerCase().substring(0, 20))) {
            firstDesc = text.substring(0, 180);
            break;
        }
    }

    return firstDesc ? `${title} — ${firstDesc}` : title;
}

/**
 * Build a stable content fingerprint for duplicate detection.
 * Uses MD5 of normalized scenario text (not HTML).
 */
function buildFingerprint(question_data = '') {
    const normalized = stripHtml(question_data).toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 600);
    return crypto.createHash('md5').update(normalized).digest('hex');
}

// ─── Registry operations ──────────────────────────────────────────────────────

/**
 * Save a generated question immediately after LLM generation.
 * Called for every question generated — prevents re-generation even if never uploaded.
 */
async function saveGeneratedQuestion({
    question_data, inputformat = '', outputformat = '', constraints = '', prompt = '',
    language, topic, generatedBy = 'unknown', sessionId = '',
}) {
    const col = await connectDB();
    const fingerprint = buildFingerprint(question_data);
    const title = extractTitle(question_data);
    const scenario = extractScenario(question_data);

    await col.updateOne(
        { fingerprint },
        {
            $setOnInsert: {
                fingerprint, title, scenario,
                question_data, inputformat, outputformat, constraints, prompt,
                language, topic, generatedBy, sessionId,
                uploadedAt: null, generatedAt: new Date(),
            }
        },
        { upsert: true }
    );
    return { fingerprint, title, scenario };
}

/**
 * Mark a question as uploaded to the platform.
 * Called from /upload-to-platform after a successful upload.
 */
async function markAsUploaded({
    question_data, inputformat = '', outputformat = '', constraints = '',
    solution_data = null, testcases = null, debug_code = null,
    language = '', topic = '', sessionId = '', generatedBy = 'unknown', uploadedBy = 'unknown',
}) {
    const col = await connectDB();
    const fingerprint = buildFingerprint(question_data);
    const title = extractTitle(question_data);
    const scenario = extractScenario(question_data);

    const setFields = { uploadedAt: new Date(), uploadedBy };
    if (solution_data !== null) setFields.solution_data = solution_data;
    if (testcases !== null) setFields.testcases = testcases;
    if (debug_code !== null) setFields.debug_code = debug_code;

    await col.updateOne(
        { fingerprint },
        {
            $set: setFields,
            $setOnInsert: {
                fingerprint, title, scenario,
                question_data, inputformat, outputformat, constraints,
                language, topic, sessionId, generatedBy, generatedAt: new Date(),
            },
        },
        { upsert: true }
    );
    return { fingerprint };
}

/**
 * Get scenario summaries for a given user to inject into LLM exclusion list.
 * Scoped per user (generatedBy) — each user gets their own exclusion history.
 * Returns concise scenario strings: "Title — first 180 chars of description"
 */
async function getGeneratedScenarios({ generatedBy, language } = {}) {
    const col = await connectDB();

    const filter = {};
    if (generatedBy) filter.generatedBy = generatedBy;
    // Optionally narrow by language for very large registries
    if (language) filter.language = { $regex: new RegExp(`^${language}$`, 'i') };

    const docs = await col
        .find(filter, { projection: { scenario: 1, title: 1 } })
        .sort({ generatedAt: -1 })
        .limit(100) // cap at 100 to avoid bloating the prompt
        .toArray();

    return docs.map(d => d.scenario || d.title).filter(Boolean);
}

/**
 * Check if a specific question has already been generated (by fingerprint).
 */
async function isAlreadyGenerated(question_data) {
    const col = await connectDB();
    const fingerprint = buildFingerprint(question_data);
    const doc = await col.findOne({ fingerprint }, { projection: { _id: 1 } });
    return !!doc;
}

/**
 * Update the solution and testcases for an already-registered question.
 */
async function updateSolution({ question_data, solution_data, testcases = [] }) {
    const col = await connectDB();
    const fingerprint = buildFingerprint(question_data);
    await col.updateOne(
        { fingerprint },
        { $set: { solution_data, testcases, solutionGeneratedAt: new Date() } }
    );
}

/**
 * Update the debug code for an already-registered question.
 */
async function updateDebugCode({ question_data, debug_code }) {
    const col = await connectDB();
    const fingerprint = buildFingerprint(question_data);
    await col.updateOne(
        { fingerprint },
        { $set: { debug_code, debugGeneratedAt: new Date() } }
    );
}

module.exports = {
    saveGeneratedQuestion,
    markAsUploaded,
    getGeneratedScenarios,
    isAlreadyGenerated,
    extractTitle,
    extractScenario,
    buildFingerprint,
    updateSolution,
    updateDebugCode,
};
