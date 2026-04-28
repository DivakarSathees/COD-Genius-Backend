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
const PUTER_API_KEY     = process.env.PUTER_API_KEY          || '';
const PUTER_API_URL     = 'https://api.puter.com';

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
  puter: [
    { id: 'anthropic/claude-haiku-4.5',           name: 'Claude Haiku 4.5 (Fast)' },
    { id: 'anthropic/claude-sonnet-4-6',           name: 'Claude Sonnet 4.6' },
    { id: 'openai/gpt-5.4-mini',                   name: 'GPT-5.4 Mini' },
    { id: 'openai/gpt-5.4-nano',                   name: 'GPT-5.4 Nano' },
    { id: 'google/gemini-3.1-flash-lite-preview',  name: 'Gemini 3.1 Flash Lite' },
    { id: 'qwen/qwen3.6-plus-preview:free',        name: 'Qwen 3.6 Plus (Free)' },
    { id: 'liquid/lfm-2.5-1.2b-instruct:free',     name: 'LFM 2.5 1.2B (Free)' },
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
function normalizeUsage(raw, provider, modelId) {
  return {
    provider,
    model: modelId,
    prompt_tokens:     raw?.prompt_tokens     ?? raw?.promptTokenCount     ?? 0,
    completion_tokens: raw?.completion_tokens ?? raw?.candidatesTokenCount ?? 0,
    total_tokens:      raw?.total_tokens      ?? raw?.totalTokenCount      ?? 0,
  };
}

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
    return {
      text: response.choices[0].message.content,
      usage: normalizeUsage(response.usage, 'azure', deployment),
    };

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

    return {
      text: response.data.candidates[0].content.parts[0].text,
      usage: normalizeUsage(response.data.usageMetadata, 'gemini', chosenModel),
    };

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
    return {
      text: response.data.choices[0].message.content,
      usage: normalizeUsage(response.data.usage, 'github', chosenModel),
    };

  // ── Puter (free tier) ──────────────────────────────────────────────────────
  } else if (prov === 'puter') {
    const chosenModel = model || 'anthropic/claude-haiku-4.5';
    const response = await axios.post(`${PUTER_API_URL}/drivers/call`, {
      interface: 'puter-chat-completion',
      driver: 'openai-completion',
      test_mode: false,
      method: 'complete',
      args: { model: chosenModel, messages, stream: false },
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(PUTER_API_KEY ? { 'Authorization': `Bearer ${PUTER_API_KEY}` } : {}),
      },
      timeout: 90000,
    });

    const result = response.data?.result || {};
    const text = result.choices?.[0]?.message?.content
              || result.message?.content
              || '';
    return {
      text,
      usage: normalizeUsage(result.usage || {}, 'puter', chosenModel),
    };

  // ── Groq (default) ─────────────────────────────────────────────────────────
  } else {
    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chosenModel = model || DEFAULT_GROQ_MODEL;
    const response = await groqClient.chat.completions.create({ model: chosenModel, messages });
    return {
      text: response.choices[0].message.content,
      usage: normalizeUsage(response.usage, 'groq', chosenModel),
    };
  }
}

module.exports = { callLLM, AVAILABLE_MODELS, DEFAULT_GROQ_MODEL, DEFAULT_AZURE_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_GITHUB_MODEL };
