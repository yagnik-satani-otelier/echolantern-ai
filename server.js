'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { validatePayload, buildPrompt, parseModelJson, fallbackOutput, normalizeAgainstInput } = require('./lib/core');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 4176;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';
const MAX_BODY = 32_000;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    keepsake: { type: 'string' },
    microStory: { type: 'string' },
    inscription: { type: 'string' },
    gentleQuestion: { type: 'string' }
  },
  required: ['title', 'keepsake', 'microStory', 'inscription', 'gentleQuestion'],
  additionalProperties: false
};

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; let bytes = 0; let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY) {
        settled = true;
        const e = new Error('Request is too large.'); e.statusCode = 413; reject(e); req.resume(); return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', e => { if (!settled) { settled = true; reject(e); } });
  });
}

async function ollamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1600) });
    if (!response.ok) return { ready: false, installed: false, model: MODEL, reason: 'Ollama did not respond successfully.' };
    const body = await response.json();
    const models = (body.models || []).map(m => m.name || '');
    const installed = models.some(name => name === MODEL || name.startsWith(`${MODEL}:`) || name.startsWith(MODEL));
    return { ready: true, installed, model: MODEL, reason: installed ? '' : `Model ${MODEL} is not installed.` };
  } catch {
    return { ready: false, installed: false, model: MODEL, reason: 'Ollama is unavailable. The keepsake template is ready.' };
  }
}

async function generateKeepsake(input) {
  const payload = validatePayload(input);
  const status = await ollamaStatus();
  if (!status.ready || !status.installed) {
    return { mode: 'template', model: null, result: fallbackOutput(payload), notice: status.reason || 'Used the built-in keepsake template.' };
  }
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: buildPrompt(payload), stream: false, format: OUTPUT_SCHEMA, options: { temperature: 0.25, num_predict: 900 } }),
      signal: AbortSignal.timeout(90_000)
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const body = await response.json();
    const result = normalizeAgainstInput(parseModelJson(body.response), payload);
    return { mode: 'local-ai', model: MODEL, result, notice: 'Drafted with local Ollama inference. Check names and details against your own memory.' };
  } catch (error) {
    return { mode: 'template', model: null, result: fallbackOutput(payload), notice: `Local AI output could not be used (${String(error.message).slice(0, 100)}). Used the built-in template instead.` };
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`); }
  catch { send(res, 400, { error: 'Invalid URL.' }); return; }
  if (req.method === 'GET' && url.pathname === '/api/status') { send(res, 200, await ollamaStatus()); return; }
  if (req.method === 'POST' && url.pathname === '/api/keepsake') {
    try { send(res, 200, await generateKeepsake(await readJson(req))); }
    catch (e) { send(res, e.statusCode || 400, { error: e.message || 'Could not make the keepsake.' }); }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { error: 'Method not allowed.' }); return; }
  let requestPath;
  try { requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); }
  catch { send(res, 400, { error: 'Malformed URL path.' }); return; }
  const resolved = path.resolve(ROOT, `.${requestPath}`);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== path.join(ROOT, 'index.html')) { send(res, 403, { error: 'Forbidden.' }); return; }
  fs.readFile(resolved, (error, buffer) => {
    if (error) { send(res, 404, { error: 'Not found.' }); return; }
    const ext = path.extname(resolved).toLowerCase();
    send(res, 200, req.method === 'HEAD' ? '' : buffer, MIME[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`EchoLantern running at http://127.0.0.1:${PORT} · model=${MODEL} · local-only server`));
