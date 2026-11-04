/* Real illustrations, words and recordings from the main deck. No Anki progress is recorded. */
(() => {
  'use strict';
  const examples = [
    { id: 't2k-adj-0054', word: 'ostatni', translation: 'последний; крайний (по очереди/порядку).', sentence: 'To jest ostatni dzień urlopu.', sentenceTranslation: 'Это последний день отпуска.', imageAlt: 'Енот у коробки с последним кусочком пиццы' },
    { id: 't2k-v-0379', word: 'tęsknić', translation: 'скучать (по кому-либо, чему-либо)', sentence: 'Tęsknię za tobą.', sentenceTranslation: 'Я скучаю по тебе.', imageAlt: 'Грустный тюлень смотрит на фотографию у окна' },
    { id: 't2k-adj-0016', word: 'dziwny', translation: 'странный; необычный', sentence: 'To jest dziwny zbieg okoliczności.', sentenceTranslation: 'Это странное совпадение.', imageAlt: 'Лягушка под зонтом и дождём из разноцветных предметов' },
    { id: 't2k-n-0863', word: 'cień', translation: 'тень', sentence: 'Usiądźmy w cieniu drzewa.', sentenceTranslation: 'Давай сядем в тени дерева.', imageAlt: 'Дерево отбрасывает длинную тень на песок' },
    { id: 't2k-v-0148', word: 'uśmiechać się', translation: 'улыбаться', sentence: 'Uśmiecham się do ciebie.', sentenceTranslation: 'Я улыбаюсь тебе.', imageAlt: 'Улыбающаяся морская звезда' },
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
    const illustration = mode === 'word' && polishVisible() ? `. Иллюстрация: ${examples[index].imageAlt}` : '';
    flip.setAttribute('aria-label', (revealed ? `Ответ: ${text}. Вернуться к вопросу` : `Показать перевод: ${text}`) + illustration);
    if (announce) $('demo-status').textContent = `${revealed ? 'Ответ' : 'Вопрос'}: ${text}`;
  }

  function renderIllustration(side, visible, item) {
    const picture = $(side === 'front' ? 'demo-question-image' : 'demo-answer-image');
    picture.hidden = !visible;
    picture.alt = visible ? item.imageAlt : '';
    $(`demo-${side}`).classList.toggle('has-illustration', visible);
    if (visible) {
      const source = `assets/demo-images/${item.id}.jpg`;
      if (picture.getAttribute('src') !== source || (picture.complete && !picture.naturalWidth)) {
        // Keep the reserved space, without showing the previous word's picture while loading.
        picture.classList.add('is-loading');
        picture.src = source;
      }
    } else {
      picture.removeAttribute('src');
    }
  }

  ['demo-question-image', 'demo-answer-image'].forEach(id => {
    $(id).addEventListener('load', () => $(id).classList.remove('is-loading'));
    $(id).addEventListener('error', () => {
      $(id).classList.remove('is-loading');
      $(id).hidden = true;
      $(id).parentElement.classList.remove('has-illustration');
    });
  });

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
    renderIllustration('front', mode === 'word' && !reverse, item);
    renderIllustration('back', mode === 'word' && reverse, item);
    $('demo-question-language').textContent = reverse ? 'Русский' : 'Polski';
    $('demo-answer-language').textContent = reverse ? 'Polski' : 'Русский';
    $('demo-direction-label').textContent = reverse ? 'RU → PL' : 'PL → RU';
    $('demo-direction').setAttribute('aria-label', `Сменить направление: сейчас ${reverse ? 'с русского на польский' : 'с польского на русский'}`);
    $('demo-current').textContent = String(index + 1).padStart(2, '0');
    $('demo-total').textContent = String(examples.length).padStart(2, '0');
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
