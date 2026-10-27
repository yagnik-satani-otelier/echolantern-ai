'use strict';

(() => {
  const STORAGE_KEY = 'echolantern-keepsakes-v1';
  const MAX_ITEMS = 18;
  const MAX_PHOTO_DATA_LENGTH = 200_000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const form = $('#memoryForm');
  const photoInput = $('#photoInput');
  const photoPreviewWrap = $('#photoPreviewWrap');
  const photoPreview = $('#photoPreview');
  const photoHelp = $('#photoHelp');
  let photoData = '';
  let currentEntry = null;
  let statusInfo = { ready: false, installed: false, model: 'gemma3:1b' };
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }
  function safeText(value, cap = 1500) { return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, cap); }
  function nowIso() { return new Date().toISOString(); }
  function loadEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(x => x && typeof x === 'object' && x.id && x.output && x.input) : [];
    } catch { return []; }
  }
  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
    updateCounts();
  }
  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 2800);
  }
  function updateCounts() {
    const count = loadEntries().length;
    $('#archiveCount').textContent = String(count);
    $('#savedCount').textContent = String(count);
    $('#archiveTotal').textContent = `${count} ${count === 1 ? 'keepsake' : 'keepsakes'}`;
  }
  function switchView(view) {
    const archive = view === 'archive';
    $('#createView').classList.toggle('active', !archive);
    $('#createView').hidden = archive;
    $('#archiveView').classList.toggle('active', archive);
    $('#archiveView').hidden = !archive;
    $$('.nav-item[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    $('#breadcrumbCurrent').textContent = archive ? 'Memory archive' : 'Create a keepsake';
    if (archive) renderArchive();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setStatus(status) {
    statusInfo = status;
    const ready = Boolean(status.ready && status.installed);
    $('#statusLed').classList.toggle('ready', ready);
    $('#modelStatus').textContent = ready ? 'Gemma ready' : 'Template mode available';
    $('#modelDetail').textContent = ready ? `${status.model || 'gemma3:1b'} · local inference` : (status.reason || 'Ollama not connected');
    $('#engineCard').textContent = ready ? 'Gemma ready' : 'Template mode';
    $('#engineSub').textContent = ready ? `${status.model || 'gemma3:1b'} · local inference` : 'A simple fallback is ready.';
  }
  async function checkStatus() {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('status endpoint unavailable');
      setStatus(await response.json());
    } catch {
      setStatus({ ready: false, installed: false, model: 'gemma3:1b', reason: 'Hosted/template mode. Local Ollama is not connected.' });
    }
  }
  function inputPayload() {
    const fd = new FormData(form);
    return {
      title: safeText(fd.get('title'), 100),
      subject: safeText(fd.get('subject'), 100),
      context: safeText(fd.get('context'), 40),
      memory: safeText(fd.get('memory'), 2200),
      details: safeText(fd.get('details'), 1000),
      meaning: safeText(fd.get('meaning'), 600),
      dateOrPlace: safeText(fd.get('dateOrPlace'), 160),
      tone: safeText(fd.get('tone'), 30),
      language: safeText(fd.get('language'), 30)
    };
  }
  function getEditableOutput() {
    return {
      title: safeText($('#outputTitle').value, 140),
      keepsake: safeText($('#outputKeepsake').value, 900),
      microStory: safeText($('#outputStory').value, 1500),
      inscription: safeText($('#outputInscription').value, 240),
      gentleQuestion: safeText($('#outputQuestion').value, 280)
    };
  }
  function showResult(response, input) {
    const result = response.result || response.capsule || response;
    currentEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: nowIso(),
      mode: response.mode || 'template',
      model: response.model || null,
      input: { ...input },
      output: { ...result },
      photo: photoData || ''
    };
    $('#emptyResult').hidden = true;
    $('#generatedResult').hidden = false;
    const isAI = currentEntry.mode === 'local-ai';
    $('#modeNotice').className = `mode-notice ${isAI ? 'local-ai' : 'template'}`;
    $('#modeNotice').innerHTML = `<strong>${isAI ? '✦ LOCAL AI' : '◌ TEMPLATE MODE'}</strong><span>${escapeHtml(response.notice || (isAI ? 'Drafted with local Ollama inference.' : 'Used a built-in template.'))}</span>`;
    $('#outputTitle').value = result.title || '';
    $('#outputKeepsake').value = result.keepsake || '';
    $('#outputStory').value = result.microStory || '';
    $('#outputInscription').value = result.inscription || '';
    $('#outputQuestion').value = result.gentleQuestion || '';
    $('#saveButton').disabled = false;
    $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: window.innerWidth < 960 ? 'start' : 'nearest' });
  }
  async function generate(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const input = inputPayload();
    if (input.memory.length < 8) { toast('Add a few words about the memory first.'); return; }
    const button = $('#generateButton'); const original = button.innerHTML;
    button.disabled = true; button.innerHTML = '<span class="spinner"></span> Tending the lantern…';
    try {
      let response;
      try {
        const request = await fetch('/api/keepsake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        if (!request.ok) throw new Error('Local generation endpoint unavailable.');
        response = await request.json();
        if (!request.ok || response.error) throw new Error(response.error || 'Local generation failed.');
      } catch {
        response = { mode: 'template', model: null, result: window.EchoLanternFallback.create(input), notice: 'Browser template mode. The hosted page cannot reach Ollama on your computer.' };
      }
      showResult(response, input);
      toast(response.mode === 'local-ai' ? 'A keepsake draft is ready.' : 'Template keepsake ready.');
    } catch (error) {
      toast(error.message || 'Could not create a keepsake.');
    } finally {
      button.disabled = false; button.innerHTML = original;
    }
  }
  function markdownFor(entry) {
    const input = entry.input || {}; const out = entry.output || {};
    return `# ${out.title || 'A little piece to keep'}\n\n> ${out.inscription || ''}\n\n## Keepsake\n\n${out.keepsake || ''}\n\n## Memory in a few lines\n\n${out.microStory || ''}\n\n## A question for another day\n\n${out.gentleQuestion || ''}\n\n---\n\n**Original notes**\n\n${input.memory || ''}\n\n${input.details ? `**Details to keep close:** ${input.details}\n\n` : ''}${input.meaning ? `**Why it matters:** ${input.meaning}\n\n` : ''}${input.dateOrPlace ? `**Date or place:** ${input.dateOrPlace}\n\n` : ''}Created with EchoLantern on ${new Date(entry.createdAt || nowIso()).toLocaleString()}. ${entry.mode === 'local-ai' ? 'Drafted with local AI; verify details before sharing.' : 'Built-in template; no AI generation claimed.'}\n`;
  }
  function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveCurrent() {
    if (!currentEntry) { toast('Create a keepsake first.'); return; }
    currentEntry.output = getEditableOutput();
    currentEntry.photo = photoData || '';
    currentEntry.savedAt = nowIso();
    try {
      const items = loadEntries().filter(item => item.id !== currentEntry.id);
      saveEntries([currentEntry, ...items].slice(0, MAX_ITEMS));
      toast('Saved to your lantern.');
      renderArchive();
    } catch {
      toast('Browser storage is full. Export or remove an older keepsake, then try again.');
    }
  }
  async function copyCurrent() {
    if (!currentEntry) return;
    currentEntry.output = getEditableOutput();
    const text = markdownFor(currentEntry);
    try { await navigator.clipboard.writeText(text); toast('Keepsake copied.'); }
    catch { downloadFile('echolantern-keepsake.md', text); toast('Clipboard unavailable; downloaded Markdown instead.'); }
  }
  function downloadCurrent() {
    if (!currentEntry) return;
    currentEntry.output = getEditableOutput();
    const slug = (currentEntry.output.title || 'keepsake').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'keepsake';
    downloadFile(`${slug}.md`, markdownFor(currentEntry), 'text/markdown;charset=utf-8');
  }
  function renderArchive() {
    const entries = loadEntries(); const query = safeText($('#archiveSearch').value, 100).toLowerCase();
    const filtered = entries.filter(item => [item.output?.title, item.input?.subject, item.input?.memory, item.input?.details].some(value => String(value || '').toLowerCase().includes(query)));
    const grid = $('#archiveGrid');
    $('#archiveEmpty').hidden = entries.length > 0;
    grid.innerHTML = '';
    filtered.forEach(entry => {
      const card = document.createElement('article'); card.className = 'archive-card';
      if (entry.photo) { const img = document.createElement('img'); img.className = 'archive-card-photo'; img.src = entry.photo; img.alt = 'Photo saved with this keepsake'; card.appendChild(img); }
      const kicker = document.createElement('span'); kicker.className = 'archive-card-kicker'; kicker.textContent = entry.input?.context || 'keepsake'; card.appendChild(kicker);
      const heading = document.createElement('h3'); heading.textContent = entry.output?.title || 'A little piece to keep'; card.appendChild(heading);
      const p = document.createElement('p'); p.textContent = entry.output?.keepsake || entry.input?.memory || ''; card.appendChild(p);
      const time = document.createElement('time'); time.dateTime = entry.createdAt; time.textContent = new Date(entry.createdAt).toLocaleString(); card.appendChild(time);
      const actions = document.createElement('div'); actions.className = 'archive-card-actions';
      const open = document.createElement('button'); open.className = 'small-action'; open.textContent = 'Open'; open.addEventListener('click', () => openEntry(entry.id)); actions.appendChild(open);
      const dl = document.createElement('button'); dl.className = 'small-action'; dl.textContent = 'Download'; dl.addEventListener('click', () => downloadFile('echolantern-keepsake.md', markdownFor(entry), 'text/markdown;charset=utf-8')); actions.appendChild(dl);
      const del = document.createElement('button'); del.className = 'small-action danger'; del.textContent = 'Delete'; del.addEventListener('click', () => deleteEntry(entry.id)); actions.appendChild(del);
      card.appendChild(actions); grid.appendChild(card);
    });
    if (entries.length > 0 && filtered.length === 0) {
      const noResult = document.createElement('p'); noResult.className = 'archive-no-results'; noResult.textContent = 'No keepsakes match that search.'; grid.appendChild(noResult);
    }
    updateCounts();
  }
  function openEntry(id) {
    const entry = loadEntries().find(item => item.id === id); if (!entry) return;
    currentEntry = JSON.parse(JSON.stringify(entry));
    const input = entry.input || {};
    for (const [key, value] of Object.entries(input)) { const control = form.elements.namedItem(key); if (control && typeof value === 'string') control.value = value; }
    photoData = entry.photo || '';
    updatePhotoPreview();
    $('#emptyResult').hidden = true; $('#generatedResult').hidden = false;
    const isAI = entry.mode === 'local-ai';
    $('#modeNotice').className = `mode-notice ${isAI ? 'local-ai' : 'template'}`;
    $('#modeNotice').innerHTML = `<strong>${isAI ? '✦ LOCAL AI' : '◌ TEMPLATE MODE'}</strong><span>Saved keepsake. Review the content before sharing.</span>`;
    $('#outputTitle').value = entry.output.title || '';
    $('#outputKeepsake').value = entry.output.keepsake || '';
    $('#outputStory').value = entry.output.microStory || '';
    $('#outputInscription').value = entry.output.inscription || '';
    $('#outputQuestion').value = entry.output.gentleQuestion || '';
    $('#saveButton').disabled = false;
    switchView('create');
    $('#resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function deleteEntry(id) {
    if (!confirm('Delete this keepsake from this browser? This cannot be undone unless you exported a backup.')) return;
    saveEntries(loadEntries().filter(item => item.id !== id)); renderArchive(); toast('Keepsake deleted from this browser.');
  }
  function exportAll() {
    const entries = loadEntries();
    if (!entries.length) { toast('There are no saved keepsakes to export yet.'); return; }
    downloadFile(`echolantern-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: nowIso(), app: 'EchoLantern', version: 1, entries }, null, 2), 'application/json;charset=utf-8');
  }
  function updatePhotoPreview() {
    if (photoData) {
      photoPreview.src = photoData; photoPreviewWrap.hidden = false; photoHelp.textContent = 'Photo stored with this draft in this browser.';
    } else {
      photoPreview.removeAttribute('src'); photoPreviewWrap.hidden = true; photoHelp.textContent = 'Choose a photo to keep with this memory.'; photoInput.value = '';
    }
  }
  async function compressPhoto(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 12 * 1024 * 1024) throw new Error('That photo is over 12 MB. Choose a smaller one.');
    const source = await createImageBitmap(file);
    const scale = Math.min(1, 800 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0, canvas.width, canvas.height); source.close?.();
    let quality = 0.68; let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > MAX_PHOTO_DATA_LENGTH && quality > 0.34) { quality -= 0.07; result = canvas.toDataURL('image/jpeg', quality); }
    if (result.length > MAX_PHOTO_DATA_LENGTH) throw new Error('That photo is still too large after compression. Try a smaller image.');
    return result;
  }
  function useSample() {
    form.elements.namedItem('title').value = 'The rainy-day kitchen';
    form.elements.namedItem('subject').value = 'My family';
    form.elements.namedItem('context').value = 'family story';
    form.elements.namedItem('tone').value = 'gentle';
    form.elements.namedItem('language').value = 'English';
    form.elements.namedItem('memory').value = 'I remember rainy afternoons when everyone drifted into the kitchen. The old ceiling fan rattled above us, and somebody always put the kettle on. Nobody needed a special reason to stay at the table a little longer.';
    form.elements.namedItem('details').value = 'Rain against the window; the old ceiling fan; tea shared at the kitchen table.';
    form.elements.namedItem('meaning').value = 'It reminds me that feeling at home was often made from ordinary moments together.';
    form.elements.namedItem('dateOrPlace').value = 'Rainy afternoons at home';
    photoData = ''; updatePhotoPreview(); $('#memoryCount').textContent = `${form.elements.namedItem('memory').value.length} / 2200`; toast('Sample notes added. Make them your own.');
  }

  form.addEventListener('submit', generate);
  form.elements.namedItem('memory').addEventListener('input', event => { $('#memoryCount').textContent = `${event.target.value.length} / 2200`; });
  $('#startButton').addEventListener('click', () => { $('#workbench').scrollIntoView({ behavior: 'smooth', block: 'start' }); form.elements.namedItem('memory').focus({ preventScroll: true }); });
  $('#sampleButton').addEventListener('click', useSample);
  $('#saveButton').addEventListener('click', saveCurrent);
  $('#copyButton').addEventListener('click', copyCurrent);
  $('#downloadButton').addEventListener('click', downloadCurrent);
  $('#exportAll').addEventListener('click', exportAll);
  $('#archiveSearch').addEventListener('input', renderArchive);
  $('#firstKeepsakeButton').addEventListener('click', () => switchView('create'));
  $$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  $('#aboutButton').addEventListener('click', () => $('#aboutDialog').showModal());
  $('#closeAbout').addEventListener('click', () => $('#aboutDialog').close());
  $('#closeAboutButton').addEventListener('click', () => $('#aboutDialog').close());
  $('#removePhoto').addEventListener('click', () => { photoData = ''; updatePhotoPreview(); });
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0]; if (!file) return;
    photoHelp.textContent = 'Compressing photo locally…';
    try { photoData = await compressPhoto(file); updatePhotoPreview(); toast('Photo ready. It has not been uploaded.'); }
    catch (error) { photoData = ''; updatePhotoPreview(); toast(error.message || 'Could not load photo.'); }
  });
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { updateCounts(); renderArchive(); } });
  updateCounts(); checkStatus();
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) { navigator.serviceWorker.register('/sw.js').catch(() => {}); }
})();
