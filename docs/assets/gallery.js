/* Progressive enhancement: screenshot links also work without JavaScript. */
(() => {
  'use strict';
  const gallery = document.getElementById('cards');
  if (!gallery) return;
  const tabs = [...gallery.querySelectorAll('[data-gallery-tab]')];
  const panels = [...gallery.querySelectorAll('.gallery-panel')];
  const themes = [...gallery.querySelectorAll('[data-screenshot-theme]')];
  const sentenceLinks = [...gallery.querySelectorAll('[data-sentence-side]')];
  const dialog = document.getElementById('screenshot-dialog');
  const fullImage = document.getElementById('screenshot-full');
  const imageBody = document.getElementById('screenshot-dialog-body');
  const error = document.getElementById('screenshot-error');
  let selected = 'words', activeLinks = [], activeIndex = 0, opener = null;

  function selectPanel(name) {
    selected = name;
    tabs.forEach(tab => {
      const active = tab.dataset.galleryTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== `gallery-${name}`; });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => selectPanel(tab.dataset.galleryTab)));
  gallery.querySelector('.gallery-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex(tab => tab.dataset.galleryTab === selected);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectPanel(tabs[next].dataset.galleryTab);
    tabs[next].focus();
  });
  themes.forEach(button => button.addEventListener('click', () => {
    const dark = button.dataset.screenshotTheme === 'dark';
    themes.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    gallery.querySelector('.sentence-screenshots').dataset.screenshotTheme = dark ? 'dark' : 'light';
    sentenceLinks.forEach(link => {
      const img = link.querySelector('img');
      const title = link.dataset.sentenceSide === 'front' ? 'Вопрос' : 'Ответ';
      const theme = dark ? 'тёмная' : 'светлая';
      const source = dark ? img.dataset.darkSrc : img.dataset.lightSrc;
      img.src = source;
      img.height = link.dataset.sentenceSide === 'front' ? (dark ? 2481 : 2483) : (dark ? 2503 : 2473);
      img.alt = img.alt.replace(/(?:светлая|тёмная) тема/, `${theme} тема`);
      link.href = source;
      link.dataset.caption = `${title} · ${theme} тема`;
      link.setAttribute('aria-label', `Увеличить скриншот: ${title.toLowerCase()} в ${dark ? 'тёмной' : 'светлой'} теме`);
    });
  }));

  function renderImage() {
    const link = activeLinks[activeIndex];
    const thumb = link.querySelector('img');
    error.hidden = true;
    fullImage.hidden = false;
    fullImage.alt = thumb.alt;
    fullImage.width = thumb.width;
    fullImage.height = thumb.height;
    fullImage.src = link.href;
    document.getElementById('screenshot-dialog-title').textContent = link.dataset.caption;
    document.getElementById('screenshot-dialog-detail').textContent = link.dataset.detail;
    document.getElementById('screenshot-original').href = link.href;
    document.getElementById('screenshot-counter').textContent = `${activeIndex + 1} / ${activeLinks.length}`;
    imageBody.scrollTop = 0;
  }
  function move(step) {
    activeIndex = (activeIndex + step + activeLinks.length) % activeLinks.length;
    renderImage();
  }
  fullImage.addEventListener('error', () => { fullImage.hidden = true; error.hidden = false; });
  gallery.querySelectorAll('.screenshot-link').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    opener = link;
    activeLinks = [...link.closest('.gallery-panel').querySelectorAll('.screenshot-link')];
    activeIndex = activeLinks.indexOf(link);
    renderImage();
    dialog.showModal();
    document.documentElement.classList.add('gallery-open');
  }));
  document.getElementById('screenshot-close').addEventListener('click', () => dialog.close());
  document.getElementById('screenshot-previous').addEventListener('click', () => move(-1));
  document.getElementById('screenshot-next').addEventListener('click', () => move(1));
  dialog.addEventListener('keydown', event => {
    // Keep the page's dictionary shortcuts out of the modal viewer.
    event.stopPropagation();
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('gallery-open');
    opener?.focus({ preventScroll: true });
  });
  gallery.classList.add('is-enhanced');
  selectPanel(selected);
  gallery.querySelector('.gallery-tabs').hidden = false;
  gallery.querySelector('.screenshot-themes').hidden = false;
})();
