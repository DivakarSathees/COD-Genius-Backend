require('dotenv').config();
const { AzureOpenAI } = require('openai');
const Groq = require('groq-sdk');

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://iamneo-qb.openai.azure.com/';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AZURE_API_VERSION = process.env.AZURE_API_VERSION || '2024-12-01-preview';

const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_AZURE_MODEL = 'gpt-5-mini';

const AVAILABLE_MODELS = {
  groq: [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (Default)' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  azure: [
    { id: 'gpt-5-mini', name: 'GPT-5 Mini (Default)' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4', name: 'GPT-4' },
  ],
};

/**
 * Call LLM with provider abstraction.
 *
 * For Azure, jsonMode wraps the prompt so the response is a JSON object
 * { "items": [...] } — Azure's response_format requires an object, not a bare array.
 *
 * @param {object} opts
 * @param {'groq'|'azure'} opts.provider
 * @param {string} [opts.model]
 * @param {Array}  opts.messages
 * @param {string} [opts.systemContent]
 * @param {boolean} [opts.jsonMode=false] - Force JSON output (Azure only, Groq ignores)
 * @returns {Promise<string>} raw text content from the model
 */
async function callLLM({ provider = 'groq', model, messages, jsonMode = false }) {
  const prov = (provider || 'groq').toLowerCase().trim();

  if (prov === 'azure') {
    const deployment = model || DEFAULT_AZURE_MODEL;
    const azureClient = new AzureOpenAI({
      endpoint: AZURE_ENDPOINT,
      apiKey: AZURE_API_KEY,
      apiVersion: AZURE_API_VERSION,
      deployment,
    });

    const params = {
      model: deployment,
      messages,
    };

    if (jsonMode) {
      params.response_format = { type: 'json_object' };
    }

    const response = await azureClient.chat.completions.create(params);
    return response.choices[0].message.content;

  } else {
    // Groq
    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chosenModel = model || DEFAULT_GROQ_MODEL;

    const response = await groqClient.chat.completions.create({
      model: chosenModel,
      messages,
    });
    return response.choices[0].message.content;
  }
}

module.exports = { callLLM, AVAILABLE_MODELS, DEFAULT_GROQ_MODEL, DEFAULT_AZURE_MODEL };
