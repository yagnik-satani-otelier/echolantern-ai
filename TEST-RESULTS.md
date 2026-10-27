# EchoLantern test results

Validated in the build environment with Node.js 22.16.0.

- `node --check server.js` — passed
- `node --check lib/core.js` — passed
- `node --check public/app.js` — passed
- `npm test` — **19 passed, 0 failed**

Coverage includes:

- Bounded validation of user text and safe defaults
- Prompt instructions against fabricated facts and supernatural impersonation
- Treating user fields as source material rather than system instructions
- Structured JSON parsing, required fields, and output limits
- Template fallback anchored to the user's notes
- Basic normalization for an unsupported relationship when none was supplied
- HTTP app shell and security headers
- Ollama status and schema-constrained generation using a mocked Ollama endpoint
- Invalid JSON, unsupported methods, path traversal, and oversized requests
- Browser-only template fallback for static hosting

**Not yet verified here:** a full interactive browser walkthrough, real Gemma output quality, real-photo storage across browser restarts, and a public Vercel deployment. Run the local Gemma smoke test and check the deployed static preview on the target machine before claiming those checks.
