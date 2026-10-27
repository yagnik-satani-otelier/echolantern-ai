---
title: "EchoLantern: A Private Little Archive for Memories"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

A memory doesn't always arrive as a grand story. Sometimes it's a rattling ceiling fan, a pet waiting at the door, a phrase someone always used, or a small ritual that made an ordinary day feel like home. I built **EchoLantern** to give those details a place to stay.

## What I built

EchoLantern is a local-first keepsake maker for everyday memories, people, places, pets, family stories, and meaningful objects or traditions. A user writes a few rough notes, optionally adds one photo, and creates an editable keepsake card, a short reflective paragraph, a card inscription, and a gentle question for another day. Saved keepsakes live in a searchable archive in the current browser and can be exported as Markdown or JSON.

The app intentionally does not pretend to speak for someone who is gone or contact spirits. It doesn't assume that a person has died. It helps the user shape their own words, and the final copy remains editable. The model is instructed not to invent dates, people, events, favorite things, or exact quotes; generated prose still needs human review.

## Demo

**Live demo:** https://echolantern-ai.vercel.app/

The static deployment shows the interface and browser-based template fallback. It cannot access Ollama running on a user's computer, so it is not a live hosted Gemma demo. The local version runs the Node server alongside Ollama and can generate keepsakes with Gemma 3 1B.

## Code

**Repository:** https://github.com/yagnik-satani-otelier/echolantern-ai

## How I built it

EchoLantern uses Node.js's built-in HTTP server, vanilla JavaScript, CSS, browser localStorage, and the Ollama API. When run locally, the server uses **Gemma 3 1B** with an explicit JSON schema to return a consistent keepsake structure. When Ollama is missing or the static Vercel route has no local API, the app marks its output as `TEMPLATE MODE` rather than pretending that it came from the model.

The app has no user account or hosted AI endpoint. In local mode, the notes go to the Ollama service configured on the user's machine. A browser-side photo step compresses an optional image before it is saved with the entry in local storage. The archive can be exported, but browser storage is not encrypted and needs backups.

## Why open innovation matters

Memories can be personal in a way ordinary app data isn't. A local model lets a person try AI-assisted writing without sending their notes to a separate hosted writing API, while the prompts, response handling, and storage logic remain inspectable and modifiable. People can switch models or change the rules rather than having their keepsakes depend on a closed service that might change or disappear.

The trade-off is that local inference requires installing a model and using your own machine's resources. Smaller models can get details wrong or add unsupported flourishes. EchoLantern keeps the original note visible, labels the output as a draft, and asks the user to check it. Open weights are not automatically the same as OSI-approved open-source software; model terms should be reviewed separately.

## What I tested

The current automated suite has 19 passing Node.js tests covering input validation, prompt boundaries, output parsing, template fallback, mocked Ollama integration, and HTTP error/security cases. These tests use a mocked model endpoint and do not establish real Gemma output quality.

Before publishing, I will run the local app with Gemma 3 1B, confirm that the generated entry is labelled `LOCAL AI`, check save/reopen/export, verify the static demo URL, and update this section to report only the checks I actually complete. I have not conducted a user study, so I make no claim about measured time savings or user outcomes.

## Prize category

Potential category: **Best Use of Gemma**, if I verify the local Gemma path on the final version and the entry meets that category's current rules. I will only include this category if the implementation meaningfully uses Gemma and the test is complete.

---

EchoLantern's promise is intentionally small: keep the story, leave the shadows to the imagination, and let a person choose what deserves another light.
