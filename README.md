# EchoLantern 🕯️

**A little light for what we keep.**

EchoLantern is a private, local-first keepsake maker for everyday memories, people, places, pets, family stories, and meaningful objects or traditions. It turns a few user-provided notes into an editable keepsake card, a short reflective paragraph, an inscription, and a gentle question for another day.

Built for the Hacktoberfest 2026 DEV Challenge Week 4 theme **Ghost in the Machine**.

## What it does

- **Memory capture:** record a short memory, details you want to preserve, why they matter, and an optional date or place.
- **Optional photo:** attach one compressed photo to a keepsake. The image is stored with the entry in this browser, not uploaded to a service by the app.
- **Local AI:** when run locally, the Node server sends the notes to Gemma 3 1B through Ollama. It asks for a structured, schema-constrained response.
- **Honest template fallback:** when running on a static host or when Ollama is unavailable, the app clearly labels output `TEMPLATE MODE`. It does not pretend that a template is AI-generated.
- **Memory archive:** save keepsakes, reopen them, search the archive, download a Markdown copy, delete individual items, and export a JSON backup.
- **Respectful boundaries:** the prompt asks the model not to invent events, relationships, dates, quotes, or favorite things, and not to claim it can contact or speak for the dead. AI text is an editable draft, not a verified transcript.

## Run it locally with Gemma

Requirements: Node.js 18.18+ and [Ollama](https://ollama.com/download). This app has no npm runtime dependencies.

```powershell
# One-time model download (skip if already installed)
ollama pull gemma3:1b

# In the EchoLantern project directory
npm run check
npm test
npm start
```

Open <http://127.0.0.1:4176>.

The sidebar reports **Gemma ready** when Ollama responds and the model is installed. Generate a keepsake and look for **LOCAL AI**. If you see **TEMPLATE MODE**, read the notice; the built-in template was used instead.

Optional environment variables:

```powershell
$env:OLLAMA_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "gemma3:1b"
$env:PORT = "4176"
npm start
```

The server binds to `127.0.0.1` only. It is intended for one person's local computer and should not be exposed to the public internet as-is.

## Deploy a Vercel preview

EchoLantern can be deployed as a **static interface preview**. Import the repository into Vercel and use:

- Framework preset: **Other**
- Build command: leave empty
- Output directory: `public`

The static Vercel page works with the browser-only template fallback. It cannot access Ollama running on your PC, so it will not perform live Gemma inference. The local version does. Make that distinction clear in any demo or challenge submission.

## Tests

```powershell
npm run check
npm test
```

The current suite has **19 passing tests**. It tests input bounds, prompt boundaries, JSON parsing, fallback behavior, the Ollama API bridge with a mocked endpoint, security headers, and malformed/oversized HTTP requests. The mocked Ollama test does not establish the quality of the real model's writing. A separate local Gemma smoke test is still needed on the machine used for the demo.

## Privacy notes

- Keepsakes and photos are stored in this browser's `localStorage`. They are not encrypted, and clearing site data can erase them. Export backups regularly.
- When using local inference, prompts are sent to the Ollama service configured by `OLLAMA_URL` (localhost by default). If you point that variable to another computer, the notes are sent there.
- The hosted static preview does not send notes to a cloud AI provider; it uses a browser-only template fallback.
- Do not store passwords, credentials, or details you would not want saved in the browser.
- EchoLantern does not claim to verify memories, recreate an exact voice, or communicate with spirits. Review all generated text and edit anything inaccurate.
- Gemma is an open-weight model. Open weights do not automatically mean OSI-approved open-source software; review model terms separately.

## Challenge concept

The theme asks for something spooky or something honoring memories around Halloween and Día de los Muertos. EchoLantern takes the memory-keeping route: a lantern/archive for stories a person chooses to preserve, while keeping personal notes on their own device in the local setup. The AI helps shape a draft; the human remains the source of truth.

## License

MIT. See [`LICENSE`](LICENSE).
