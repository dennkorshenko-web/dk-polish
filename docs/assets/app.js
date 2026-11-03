/* DK-Polish vocabulary. No external libraries or network requests. */
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

  function makeRow(word) {
    const row = document.createElement('tr');
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
    return row;
  }

  function renderPage() {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    body.replaceChildren(...filtered.slice(start, start + PAGE_SIZE).map(makeRow));
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
    $('word-table').scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  $('previous-page').addEventListener('click', () => pageChange(-1));
  $('next-page').addEventListener('click', () => pageChange(1));
  window.addEventListener('pageshow', () => { if (search.value !== state.query) { state.query = search.value; update(); } });
  update();
})();
