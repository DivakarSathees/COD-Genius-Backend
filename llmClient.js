require('dotenv').config();
const { AzureOpenAI } = require('openai');
const Groq = require('groq-sdk');
const axios = require('axios');

const GEMINI_BASE_URL  = 'https://generativelanguage.googleapis.com/v1beta/models';
const GITHUB_ENDPOINT  = 'https://models.github.ai/inference';

const AZURE_ENDPOINT    = process.env.AZURE_OPENAI_ENDPOINT  || 'https://iamneo-qb.openai.azure.com/';
const AZURE_API_KEY     = process.env.AZURE_OPENAI_API_KEY   || '';
const AZURE_API_VERSION = process.env.AZURE_API_VERSION      || '2024-12-01-preview';
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY         || '';
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN           || '';

const DEFAULT_GROQ_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_AZURE_MODEL  = 'gpt-5-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GITHUB_MODEL = 'openai/gpt-5';

const AVAILABLE_MODELS = {
  groq: [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (Default)' },
    { id: 'llama-3.3-70b-versatile',                   name: 'Llama 3.3 70B Versatile' },
    { id: 'llama3-8b-8192',                            name: 'Llama 3 8B' },
    { id: 'gemma2-9b-it',                              name: 'Gemma 2 9B' },
  ],
  azure: [
    { id: 'gpt-5-mini',  name: 'GPT-5 Mini (Default)' },
    { id: 'gpt-4o',      name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4',       name: 'GPT-4' },
  ],
  gemini: [
    // { id: 'gemini-2.5-flash',         name: 'Gemini 2.5 Flash (Default)' },
    // { id: 'gemini-2.5-flash-lite',    name: 'Gemini 2.5 Flash Lite' },
    // { id: 'gemini-1.5-pro',           name: 'Gemini 1.5 Pro' },
    // { id: 'gemini-1.5-flash',         name: 'Gemini 1.5 Flash' },
    // { id: 'gemini-1.5-flash-8b',      name: 'Gemini 1.5 Flash 8B' },
    { id: 'gemini-flash-latest',      name: 'Gemini Flash Latest' },
  ],
  github: [
    { id: 'openai/gpt-4o',                        name: 'GPT-4o (Default)' },
    { id: 'openai/gpt-4o-mini',                   name: 'GPT-4o Mini' },
    { id: 'openai/gpt-5-mini',                    name: 'GPT-5 Mini' },
    { id: 'meta/Llama-3.3-70B-Instruct',          name: 'Llama 3.3 70B Instruct' },
    { id: 'mistral-ai/Mistral-small',             name: 'Mistral Small' },
  ],
};

/**
 * Convert OpenAI-style messages to Gemini REST API `contents` array.
 * System messages are prepended as a user turn with a model acknowledgement.
 * Roles: 'user' | 'model'  (Gemini does not accept 'assistant' or 'system')
 */
function toGeminiContents(messages) {
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      // Inject system prompt as the first user turn + dummy model ack
      contents.push({ role: 'user',  parts: [{ text: msg.content }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }
  return contents;
}

/**
 * Call LLM with provider abstraction.
 *
 * Supported providers: 'groq' | 'azure' | 'gemini'
 *
 * For Azure, jsonMode uses response_format: json_object.
 * For Gemini, jsonMode uses responseMimeType: 'application/json'.
 *
 * @param {object} opts
 * @param {'groq'|'azure'|'gemini'} opts.provider
 * @param {string}  [opts.model]
 * @param {Array}   opts.messages  - OpenAI-style { role, content }[]
 * @param {boolean} [opts.jsonMode=false]
 * @returns {Promise<string>} raw text content from the model
 */
async function callLLM({ provider = 'groq', model, messages, jsonMode = false }) {
  const prov = (provider || 'groq').toLowerCase().trim();

  // ── Azure ──────────────────────────────────────────────────────────────────
  if (prov === 'azure') {
    const deployment = model || DEFAULT_AZURE_MODEL;
    const azureClient = new AzureOpenAI({
      endpoint: AZURE_ENDPOINT,
      apiKey: AZURE_API_KEY,
      apiVersion: AZURE_API_VERSION,
      deployment,
    });
    const params = { model: deployment, messages };
    if (jsonMode) params.response_format = { type: 'json_object' };
    const response = await azureClient.chat.completions.create(params);
    return response.choices[0].message.content;

  // ── Gemini (REST API) ──────────────────────────────────────────────────────
  } else if (prov === 'gemini') {
    const chosenModel = model || DEFAULT_GEMINI_MODEL;
    const url = `${GEMINI_BASE_URL}/${chosenModel}:generateContent`;

    const body = {
      contents: toGeminiContents(messages),
      ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    };

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
    });

    return response.data.candidates[0].content.parts[0].text;

  // ── GitHub Models ──────────────────────────────────────────────────────────
  } else if (prov === 'github') {
    const chosenModel = model || DEFAULT_GITHUB_MODEL;
    const response = await axios.post(`${GITHUB_ENDPOINT}/chat/completions`, {
      messages,
      model: chosenModel,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
    });
    return response.data.choices[0].message.content;

  // ── Groq (default) ─────────────────────────────────────────────────────────
  } else {
    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chosenModel = model || DEFAULT_GROQ_MODEL;
    const response = await groqClient.chat.completions.create({ model: chosenModel, messages });
    return response.choices[0].message.content;
  }
}

module.exports = { callLLM, AVAILABLE_MODELS, DEFAULT_GROQ_MODEL, DEFAULT_AZURE_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_GITHUB_MODEL };
