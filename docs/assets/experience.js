/* Five real examples from the main deck. This preview does not record Anki progress. */
(() => {
  'use strict';
  const examples = [
    { id: 't2k-n-0018', word: 'przyjaciel', translation: 'друг', sentence: 'Przyjaciel pomógł mi naprawić rower.', sentenceTranslation: 'Друг помог мне починить велосипед.' },
    { id: 't2k-n-0031', word: 'dom', translation: 'дом', sentence: 'Wracam do domu po pracy.', sentenceTranslation: 'Я возвращаюсь домой после работы.' },
    { id: 't2k-v-0019', word: 'czytać', translation: 'читать', sentence: 'Czytam książkę.', sentenceTranslation: 'Я читаю книгу.' },
    { id: 't2k-adv-0091', word: 'razem', translation: 'вместе; совместно', sentence: 'Chodźmy razem.', sentenceTranslation: 'Пойдём вместе.' },
    { id: 't2k-n-0001', word: 'człowiek', translation: 'человек', sentence: 'Człowiek uczy się całe życie.', sentenceTranslation: 'Человек учится всю жизнь.' },
  ];
  const $ = id => document.getElementById(id);
  const flip = $('demo-flip');
  if (!flip) return;
  const tabs = [...document.querySelectorAll('.demo-tabs [role="tab"]')];
  const audio = $('demo-audio');
  const audioButton = $('demo-audio-button');
  const audioError = $('demo-audio-error');
  let index = 0, mode = 'word', reverse = false, revealed = false;
  let audioState = 'idle', playbackRequest = 0;

  const polishVisible = () => reverse === revealed;
  const polishText = () => examples[index][mode === 'word' ? 'word' : 'sentence'];

  function updateAudioButton() {
    const active = audioState === 'loading' || audioState === 'playing';
    audioButton.hidden = !polishVisible();
    audioButton.disabled = !polishVisible();
    audioButton.setAttribute('aria-pressed', String(active));
    audioButton.setAttribute('aria-label', active ? 'Остановить озвучку' : `Озвучка: ${polishText()}`);
    audioButton.title = active ? 'Остановить озвучку' : 'Прослушать по-польски';
  }

  function stopAudio() {
    // Invalidate pending play() promises when the card or direction changes.
    playbackRequest += 1;
    audioState = 'idle';
    audio.pause();
    if (audio.readyState > 0) audio.currentTime = 0;
    audioError.hidden = true;
    updateAudioButton();
  }

  function audioFailed() {
    if (audioState === 'idle') return;
    stopAudio();
    audioError.hidden = false;
  }

  audioButton.addEventListener('click', async () => {
    if (!polishVisible()) return;
    if (audioState !== 'idle') { stopAudio(); return; }
    stopAudio();
    const request = playbackRequest;
    const source = `assets/audio/${examples[index].id}-${mode}.mp3`;
    // No audio is requested before a deliberate press of the sound button.
    if (audio.getAttribute('src') !== source || audio.error) audio.src = source;
    audioState = 'loading';
    updateAudioButton();
    try {
      await audio.play();
      if (request !== playbackRequest) return;
      audioState = 'playing';
      updateAudioButton();
    } catch (error) {
      if (request === playbackRequest) audioFailed();
    }
  });
  audio.addEventListener('ended', stopAudio);
  audio.addEventListener('error', () => { if (audio.error) audioFailed(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
  window.addEventListener('pagehide', stopAudio);

  function setSide(announce = true) {
    stopAudio();
    flip.classList.toggle('is-flipped', revealed);
    flip.setAttribute('aria-pressed', String(revealed));
    $('demo-front').setAttribute('aria-hidden', String(revealed));
    $('demo-back').setAttribute('aria-hidden', String(!revealed));
    const text = $(revealed ? 'demo-answer' : 'demo-question').textContent;
    flip.setAttribute('aria-label', revealed ? `Ответ: ${text}. Вернуться к вопросу` : `Показать перевод: ${text}`);
    if (announce) $('demo-status').textContent = `${revealed ? 'Ответ' : 'Вопрос'}: ${text}`;
  }

  function render(announce = true) {
    const item = examples[index];
    const polish = mode === 'word' ? item.word : item.sentence;
    const russian = mode === 'word' ? item.translation : item.sentenceTranslation;
    flip.classList.add('is-resetting');
    revealed = false;
    flip.classList.toggle('is-sentence', mode === 'sentence');
    $('demo-question').textContent = reverse ? russian : polish;
    $('demo-answer').textContent = reverse ? polish : russian;
    $('demo-question').lang = reverse ? 'ru' : 'pl';
    $('demo-answer').lang = reverse ? 'pl' : 'ru';
    $('demo-question-language').textContent = reverse ? 'Русский' : 'Polski';
    $('demo-answer-language').textContent = reverse ? 'Polski' : 'Русский';
    $('demo-direction-label').textContent = reverse ? 'RU → PL' : 'PL → RU';
    $('demo-direction').setAttribute('aria-label', `Сменить направление: сейчас ${reverse ? 'с русского на польский' : 'с польского на русский'}`);
    $('demo-current').textContent = String(index + 1).padStart(2, '0');
    $('demo-dictionary-link').href = `?q=${encodeURIComponent(item.word)}#dictionary`;
    tabs.forEach(tab => {
      const selected = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) $('demo-panel').setAttribute('aria-labelledby', tab.id);
    });
    setSide(announce);
    // A new item starts on its question side, without briefly displaying the old answer.
    requestAnimationFrame(() => requestAnimationFrame(() => flip.classList.remove('is-resetting')));
  }

  flip.addEventListener('click', () => { revealed = !revealed; setSide(); });
  $('demo-next').addEventListener('click', () => { index = (index + 1) % examples.length; render(); });
  $('demo-previous').addEventListener('click', () => { index = (index + examples.length - 1) % examples.length; render(); });
  $('demo-direction').addEventListener('click', () => { reverse = !reverse; render(); });
  tabs.forEach(tab => tab.addEventListener('click', () => { mode = tab.dataset.mode; render(); }));
  document.querySelector('.demo-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex(tab => tab.dataset.mode === mode);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    mode = tabs[next].dataset.mode;
    render();
    tabs[next].focus();
  });
  document.querySelectorAll('.demo-widget button[disabled]').forEach(button => { button.disabled = false; });
  render(false);

  document.addEventListener('keydown', event => {
    const target = event.target;
    if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented || target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    $('search').focus();
  });
})();
