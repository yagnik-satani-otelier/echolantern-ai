'use strict';

// This small browser-only fallback lets the static Vercel preview work without
// exposing a local Node/Ollama service. It intentionally does not call a cloud AI.
window.EchoLanternFallback = {
  create(input) {
    const title = String(input.title || '').trim() || (input.subject ? `A little piece of ${input.subject}` : 'A little piece to keep');
    const memory = String(input.memory || '').trim();
    const details = String(input.details || '').trim();
    const meaning = String(input.meaning || '').trim();
    const place = String(input.dateOrPlace || '').trim();
    const sentences = [memory, details ? `Details you want to keep close: ${details}` : '', meaning ? `What matters about it: ${meaning}` : '', place ? `You noted: ${place}.` : ''].filter(Boolean);
    return {
      title,
      keepsake: sentences.join(' ').slice(0, 900),
      microStory: `This lantern holds the memory as you described it: ${sentences.join(' ')} There is no need to make the story bigger than the details you chose to keep.`.slice(0, 1500),
      inscription: (meaning || memory).split(/[.!?\n]/)[0].slice(0, 220),
      gentleQuestion: 'Is there one small detail, phrase, or ordinary moment you would like to add later?'
    };
  }
};
