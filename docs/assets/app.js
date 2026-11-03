/* DK-Polish vocabulary. No external libraries. Examples load from local site assets on demand. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const dataset = window.DK_POLISH_VOCABULARY;
  const PAGE_SIZE = 50;
  const number = new Intl.NumberFormat('ru-RU');
  const collator = new Intl.Collator('pl', { sensitivity: 'base' });
  const readPreference = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const writePreference = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable. */ } };
  const normalize = (value) => value.toLocaleLowerCase('pl').replaceAll('ł', 'l').replaceAll('ё', 'е').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const themeButton = $('theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let chosenTheme = readPreference('dk-polish-theme');
  const applyTheme = () => {
    const dark = chosenTheme ? chosenTheme === 'dark' : systemDark.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeButton.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  };
  applyTheme();
  themeButton.addEventListener('click', () => {
    chosenTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    writePreference('dk-polish-theme', chosenTheme);
    applyTheme();
  });
  systemDark.addEventListener('change', applyTheme);

  if (!dataset || !Array.isArray(dataset.words) || !dataset.words.length) {
    $('result-count').textContent = 'Не удалось загрузить словарь. Обнови страницу или скачай Excel.';
    $('pagination').hidden = true;
    $('word-table').hidden = true;
    return;
  }

  const groups = new Map(dataset.groups.map(group => [group.code, group]));
  const words = dataset.words.map((word, index) => ({ ...word, index, search: normalize(`${word.word}\n${word.translation}`) }));
  const params = new URLSearchParams(location.search);
  const state = {
    query: params.get('q') || '',
    pos: groups.has(params.get('pos')) ? params.get('pos') : 'all',
    sort: params.get('sort') === 'alpha' ? 'alpha' : 'deck',
    hidden: params.has('hidden') ? params.get('hidden') === '1' : readPreference('dk-polish-hide') === '1',
    page: 1,
  };
  const revealed = new Set();
  const openedExamples = new Set();
  const revealedExamples = new Set();
  const examplesCache = new Map();
  const search = $('search');
  const body = $('word-list');
  const toggle = $('translations-toggle');
  let filtered = words;
  let searchTimer;

  const wordEnding = count => {
    const last = count % 10, lastTwo = count % 100;
    return last === 1 && lastTwo !== 11 ? 'слово' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'слова' : 'слов';
  };
  const syncUrl = () => {
    const query = new URLSearchParams();
    if (state.query.trim()) query.set('q', state.query.trim());
    if (state.pos !== 'all') query.set('pos', state.pos);
    if (state.sort !== 'deck') query.set('sort', state.sort);
    if (state.hidden) query.set('hidden', '1');
    const suffix = query.toString();
    try { history.replaceState(null, '', `${location.pathname}${suffix ? `?${suffix}` : ''}${location.hash}`); } catch { /* file:// previews may restrict history. */ }
  };

  function categoryButton(code, label, count) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.dataset.pos = code;
    button.setAttribute('aria-pressed', String(state.pos === code));
    button.setAttribute('aria-controls', 'word-list');
    const title = document.createElement('span');
    title.textContent = label;
    const total = document.createElement('span');
    total.className = 'category-count';
    total.textContent = number.format(count);
    button.append(title, total);
    button.addEventListener('click', () => { state.pos = code; state.page = 1; update(); });
    return button;
  }
  $('category-buttons').append(categoryButton('all', 'Все слова', words.length));
  dataset.groups.forEach(group => $('category-buttons').append(categoryButton(group.code, group.label, group.count)));

  async function loadExamples(word) {
    if (!examplesCache.has(word.pos)) {
      const request = fetch(`assets/examples/${word.pos}.json`).then(response => {
        if (!response.ok) throw new Error('Examples are unavailable');
        return response.json();
      }).catch(error => {
        examplesCache.delete(word.pos);
        throw error;
      });
      examplesCache.set(word.pos, request);
    }
    const examples = (await examplesCache.get(word.pos))?.[word.id];
    if (!Array.isArray(examples) || !examples.length || examples.some(example =>
      !example || typeof example.pl !== 'string' || !example.pl.trim() || typeof example.ru !== 'string' || !example.ru.trim())) {
      // A successful response may still be incomplete; a retry must fetch it again.
      examplesCache.delete(word.pos);
      throw new Error('Examples for this word are unavailable');
    }
    return examples;
  }

  function makeExample(example, word, index) {
    const item = document.createElement('li');
    const polish = document.createElement('p');
    polish.className = 'example-polish';
    polish.lang = 'pl';
    polish.textContent = example.pl;
    const russian = document.createElement('p');
    russian.className = 'example-translation';
    russian.lang = 'ru';
    russian.textContent = example.ru;
    const key = `${word.id}-${index + 1}`;
    russian.id = `example-translation-${key}`;
    russian.hidden = state.hidden && !revealedExamples.has(key);
    item.append(polish, russian);
    if (state.hidden) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'example-reveal';
      button.setAttribute('aria-controls', russian.id);
      const sync = () => {
        const visible = revealedExamples.has(key);
        russian.hidden = !visible;
        button.textContent = visible ? 'Скрыть перевод' : 'Показать перевод';
        button.setAttribute('aria-expanded', String(visible));
        button.setAttribute('aria-label', `${visible ? 'Скрыть' : 'Показать'} перевод примера ${index + 1}: ${word.word}`);
      };
      sync();
      button.addEventListener('click', () => {
        if (revealedExamples.has(key)) revealedExamples.delete(key); else revealedExamples.add(key);
        sync();
      });
      item.append(button);
    }
    return item;
  }

  async function fillExamples(word, panel) {
    panel.setAttribute('aria-busy', 'true');
    const loading = document.createElement('p');
    loading.className = 'examples-message';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Загрузка примеров…';
    panel.replaceChildren(loading);
    try {
      const examples = await loadExamples(word);
      if (!panel.isConnected) return;
      const list = document.createElement('ol');
      list.className = 'examples-list';
      list.append(...examples.map((example, index) => makeExample(example, word, index)));
      panel.replaceChildren(list);
      panel.dataset.loaded = 'true';
    } catch {
      if (!panel.isConnected) return;
      const message = document.createElement('p');
      message.className = 'examples-message';
      message.setAttribute('role', 'status');
      message.textContent = 'Не удалось загрузить примеры. Проверь соединение и попробуй ещё раз.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button examples-retry';
      retry.textContent = 'Повторить загрузку';
      retry.addEventListener('click', () => {
        // Keep the disclosure button focused when the retry control is replaced.
        document.getElementById(`examples-toggle-${word.id}`)?.focus();
        fillExamples(word, panel);
      });
      panel.replaceChildren(message, retry);
    } finally {
      panel.removeAttribute('aria-busy');
    }
  }

  function makeRow(word) {
    const row = document.createElement('tr');
    row.className = 'word-row';
    row.dataset.wordId = word.id;
    const count = document.createElement('td');
    count.className = 'word-number';
    count.textContent = String(word.index + 1);
    const polishCell = document.createElement('td');
    const polish = document.createElement('span');
    polish.className = 'polish-word';
    polish.lang = 'pl';
    polish.textContent = word.word;
    polishCell.append(polish);
    if (state.pos === 'all') {
      const pos = document.createElement('span');
      pos.className = 'word-pos';
      pos.textContent = groups.get(word.pos).singular;
      polishCell.append(pos);
    }
    const examplesButton = document.createElement('button');
    examplesButton.type = 'button';
    examplesButton.className = 'examples-toggle';
    examplesButton.id = `examples-toggle-${word.id}`;
    examplesButton.setAttribute('aria-label', `Примеры употребления: ${word.word}`);
    examplesButton.textContent = 'Примеры';
    const chevron = document.createElement('span');
    chevron.className = 'examples-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    examplesButton.append(chevron);
    polishCell.append(examplesButton);

    const examplesRow = document.createElement('tr');
    examplesRow.className = 'examples-row';
    examplesRow.id = `examples-row-${word.id}`;
    examplesRow.hidden = !openedExamples.has(word.id);
    const examplesCell = document.createElement('td');
    examplesCell.colSpan = 3;
    const panel = document.createElement('div');
    panel.className = 'examples-panel';
    panel.id = `examples-${word.id}`;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', `Примеры употребления: ${word.word}`);
    examplesCell.append(panel);
    examplesRow.append(examplesCell);
    examplesButton.setAttribute('aria-controls', examplesRow.id);
    examplesButton.setAttribute('aria-expanded', String(!examplesRow.hidden));
    row.classList.toggle('examples-open', !examplesRow.hidden);
    examplesButton.addEventListener('click', () => {
      if (openedExamples.has(word.id)) openedExamples.delete(word.id); else openedExamples.add(word.id);
      examplesRow.hidden = !openedExamples.has(word.id);
      examplesButton.setAttribute('aria-expanded', String(!examplesRow.hidden));
      row.classList.toggle('examples-open', !examplesRow.hidden);
      if (!examplesRow.hidden && panel.dataset.loaded !== 'true' && panel.getAttribute('aria-busy') !== 'true') fillExamples(word, panel);
    });
    if (!examplesRow.hidden) fillExamples(word, panel);
    const translationCell = document.createElement('td');
    const translation = document.createElement('span');
    translation.id = `translation-${word.id}`;
    translation.className = 'translation-text';
    translation.lang = 'ru';
    translation.textContent = word.translation;
    translation.hidden = state.hidden && !revealed.has(word.id);
    translationCell.append(translation);
    if (state.hidden) {
      const revealButton = document.createElement('button');
      revealButton.type = 'button';
      revealButton.className = 'reveal-word';
      revealButton.setAttribute('aria-controls', translation.id);
      const sync = () => {
        const visible = revealed.has(word.id);
        translation.hidden = !visible;
        revealButton.textContent = visible ? 'Скрыть' : 'Показать перевод';
        revealButton.setAttribute('aria-expanded', String(visible));
        revealButton.setAttribute('aria-label', `${visible ? 'Скрыть' : 'Показать'} перевод: ${word.word}`);
      };
      sync();
      revealButton.addEventListener('click', () => {
        if (revealed.has(word.id)) revealed.delete(word.id); else revealed.add(word.id);
        sync();
      });
      translationCell.append(revealButton);
    }
    row.append(count, polishCell, translationCell);
    return [row, examplesRow];
  }

  function renderPage() {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    body.replaceChildren(...filtered.slice(start, start + PAGE_SIZE).flatMap(makeRow));
    $('word-table').hidden = !filtered.length;
    $('empty-state').hidden = !!filtered.length;
    $('pagination').hidden = !filtered.length;
    $('page-range').textContent = `${number.format(start + 1)}–${number.format(Math.min(start + PAGE_SIZE, filtered.length))} из ${number.format(filtered.length)}`;
    $('previous-page').disabled = state.page === 1;
    $('next-page').disabled = state.page === pages;
  }

  function update() {
    const tokens = normalize(state.query.trim()).split(/\s+/).filter(Boolean);
    filtered = words.filter(word => (state.pos === 'all' || word.pos === state.pos) && tokens.every(token => word.search.includes(token)));
    if (state.sort === 'alpha') filtered.sort((a, b) => collator.compare(a.word, b.word) || a.index - b.index);
    $('result-count').textContent = `${state.query.trim() ? 'Найдено' : 'Всего'} ${number.format(filtered.length)} ${wordEnding(filtered.length)}`;
    $('clear-search').hidden = !state.query;
    toggle.setAttribute('aria-pressed', String(state.hidden));
    toggle.querySelector('span').textContent = state.hidden ? 'Показать переводы' : 'Скрыть переводы';
    $('category-buttons').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pos === state.pos)));
    syncUrl();
    renderPage();
  }

  search.value = state.query;
  $('sort').value = state.sort;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    state.query = search.value;
    state.page = 1;
    searchTimer = setTimeout(update, 100);
  });
  $('clear-search').addEventListener('click', () => {
    clearTimeout(searchTimer);
    search.value = state.query = '';
    state.page = 1;
    update();
    search.focus();
  });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; update(); });
  toggle.addEventListener('click', () => {
    state.hidden = !state.hidden;
    revealed.clear();
    revealedExamples.clear();
    writePreference('dk-polish-hide', state.hidden ? '1' : '0');
    update();
  });
  $('reset-filters').addEventListener('click', () => {
    clearTimeout(searchTimer);
    state.query = search.value = '';
    state.pos = 'all';
    state.page = 1;
    update();
    search.focus();
  });
  const pageChange = delta => {
    state.page += delta;
    renderPage();
    body.querySelector('.examples-toggle')?.focus({ preventScroll: true });
    $('word-table').scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  $('previous-page').addEventListener('click', () => pageChange(-1));
  $('next-page').addEventListener('click', () => pageChange(1));
  window.addEventListener('pageshow', () => { if (search.value !== state.query) { state.query = search.value; update(); } });
  update();
})();
