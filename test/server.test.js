'use strict';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
let appProcess, appBase, ollamaServer, ollamaBase, output = '';
async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const p = socket.address().port; socket.close(err => err ? reject(err) : resolve(p)); });
  });
}
async function waitFor(url) {
  const end = Date.now() + 7000;
  while (Date.now() < end) {
    if (appProcess?.exitCode !== null && appProcess?.exitCode !== undefined) throw new Error(`App exited: ${output}`);
    try { const r = await fetch(url, { signal: AbortSignal.timeout(300) }); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
  throw new Error(`App did not start: ${output}`);
}
before(async () => {
  ollamaServer = http.createServer(async (req, res) => {
    res.setHeader('content-type','application/json; charset=utf-8');
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models:[{ name:'test-model' }] })); return; }
    if (req.url === '/api/generate' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk.toString(); const request = JSON.parse(raw);
      assert.equal(typeof request.format, 'object');
      assert.deepEqual(request.format.required, ['title','keepsake','microStory','inscription','gentleQuestion']);
      res.end(JSON.stringify({ response:JSON.stringify({ title:'The shared table', keepsake:'Your note about a shared table.', microStory:'The user remembers time at the table.', inscription:'Keep the ordinary moments.', gentleQuestion:'Is there one more detail to add?' }), done:true }));
      return;
    }
    res.writeHead(404); res.end(JSON.stringify({ error:'not found' }));
  });
  await new Promise((resolve,reject) => { ollamaServer.once('error',reject); ollamaServer.listen(0,'127.0.0.1',resolve); });
  ollamaBase = `http://127.0.0.1:${ollamaServer.address().port}`;
  const port = await freePort(); appBase = `http://127.0.0.1:${port}`;
  appProcess = spawn(process.execPath, [path.join(__dirname,'..','server.js')], { env:{ ...process.env, PORT:String(port), OLLAMA_URL:ollamaBase, OLLAMA_MODEL:'test-model' }, stdio:['ignore','pipe','pipe'] });
  appProcess.stdout.on('data', b => output += b.toString()); appProcess.stderr.on('data', b => output += b.toString());
  await waitFor(`${appBase}/`);
});
after(async () => {
  if (appProcess && appProcess.exitCode === null) appProcess.kill('SIGTERM');
  if (ollamaServer) await new Promise(resolve => ollamaServer.close(resolve));
});
test('serves the app shell with security headers', async () => {
  const r = await fetch(`${appBase}/`); assert.equal(r.status,200); assert.match(r.headers.get('content-type'),/text\/html/); assert.equal(r.headers.get('x-content-type-options'),'nosniff'); assert.match(await r.text(),/EchoLantern/);
});
test('reports the configured model as installed through the Ollama bridge', async () => {
  const r = await fetch(`${appBase}/api/status`); const body = await r.json(); assert.equal(r.status,200); assert.equal(body.ready,true); assert.equal(body.installed,true); assert.equal(body.model,'test-model');
});
test('sends a schema-constrained prompt and returns local-ai mode', async () => {
  const r = await fetch(`${appBase}/api/keepsake`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ title:'The shared table', memory:'I remember rainy evenings around the kitchen table.' }) });
  const body = await r.json(); assert.equal(r.status,200); assert.equal(body.mode,'local-ai'); assert.equal(body.result.title,'The shared table'); assert.match(body.notice,/local Ollama/i);
});
test('rejects invalid JSON', async () => {
  const r = await fetch(`${appBase}/api/keepsake`, { method:'POST', headers:{'content-type':'application/json'}, body:'{not-json' }); assert.equal(r.status,400); assert.match((await r.json()).error,/Invalid JSON/);
});
test('rejects non-POST generation methods', async () => {
  const r = await fetch(`${appBase}/api/keepsake`, { method:'PUT' }); assert.equal(r.status,405);
});
test('rejects path traversal', async () => {
  const r = await fetch(`${appBase}/..%2Fserver.js`); assert.equal(r.status,403);
});
test('rejects oversized API request', async () => {
  const r = await fetch(`${appBase}/api/keepsake`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ memory:'A'.repeat(40000) }) }); assert.equal(r.status,413); assert.match((await r.json()).error,/too large/i);
});
