const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#demo-next')).toBeEnabled();
  await expect(page.locator('.word-row')).toHaveCount(50);
});

test('responsive controls fit and icons stay centered', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const failures = await page.locator('.theme-button, .icon-button, .demo-audio').evaluateAll(buttons => buttons.filter(b => b.getBoundingClientRect().width).flatMap(button => {
      const box = button.getBoundingClientRect();
      const icon = [...button.querySelectorAll('svg')].find(svg => svg.getBoundingClientRect().width);
      if (!icon) return [button.id + ': missing icon'];
      const rect = icon.getBoundingClientRect();
      return box.width < 43 || box.height < 43 || Math.abs(box.x + box.width / 2 - rect.x - rect.width / 2) > 1 || Math.abs(box.y + box.height / 2 - rect.y - rect.height / 2) > 1 ? [button.id] : [];
    }));
    expect(failures).toEqual([]);
    expect(await page.locator('button:visible').evaluateAll(buttons => buttons.filter(b => b.scrollWidth > b.clientWidth + 2).map(b => b.id || b.textContent))).toEqual([]);
  }
});

test('five demo words and sentences have playable sound and correct sides', async ({ page }) => {
  for (const mode of ['word', 'sentence']) {
    await page.locator('#demo-' + mode + '-tab').click();
    for (let i = 0; i < 5; i++) {
      if (mode === 'word') await expect.poll(() => page.locator('#demo-question-image').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      else await expect(page.locator('#demo-question-image')).toBeHidden();
      await page.locator('#demo-audio-button').click();
      await expect.poll(() => page.locator('#demo-audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
      await expect(page.locator('#demo-audio-error')).toBeHidden();
      await expect(page.locator('#demo-flip')).toHaveAttribute('aria-pressed', 'false');
      await page.locator('#demo-flip').click();
      await expect(page.locator('#demo-audio-button')).toBeHidden();
      expect(await page.locator('#demo-audio').evaluate(audio => audio.paused)).toBe(true);
      await page.locator('#demo-next').click();
      await expect(page.locator('#demo-flip')).toHaveAttribute('aria-pressed', 'false');
    }
  }
  await page.locator('#demo-word-tab').click();
  await page.locator('#demo-direction').click();
  await expect(page.locator('#demo-question')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#demo-audio-button')).toBeHidden();
  await page.locator('#demo-flip').press('Space');
  await expect(page.locator('#demo-answer')).toHaveAttribute('lang', 'pl');
  await expect(page.locator('#demo-audio-button')).toBeVisible();
  await expect.poll(() => page.locator('#demo-answer-image').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
});

test('search handles Polish letters, empty results and reset', async ({ page }) => {
  await page.locator('#search').fill('czlowiek');
  await expect(page.locator('.word-row')).toHaveCount(1);
  await expect(page.locator('.polish-word')).toHaveText('człowiek');
  await page.locator('#clear-search').click();
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('.word-row')).toHaveCount(50);
  await page.locator('#search').fill('zzzzzzzzzz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#pagination')).toBeHidden();
  await page.locator('#reset-filters').click();
  await expect(page.locator('.word-row')).toHaveCount(50);
});

test('category filters, examples, sorting and pagination work together', async ({ page }) => {
  for (const code of ['N', 'V', 'ADJ', 'ADV', 'PRON', 'PREP', 'CONJ', 'NUM', 'PART']) {
    await page.locator(`[data-pos="${code}"]`).click();
    await expect(page.locator(`[data-pos="${code}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.examples-toggle').first().click();
    await expect(page.locator('.examples-list').first().locator('li')).toHaveCount(3);
    await expect(page.locator('.word-row').first()).toHaveAttribute('data-word-id', new RegExp(`^T2K-${code}-`));
  }
  await expect(page.locator('#next-page')).toBeDisabled();
  await page.locator('[data-pos="all"]').click();
  await page.locator('#sort').selectOption('alpha');
  const first = await page.locator('.polish-word').first().textContent();
  await page.locator('#next-page').click();
  await expect(page.locator('#page-range')).toContainText('51–100');
  await expect(page.locator('.examples-toggle').first()).toBeFocused();
  await page.locator('#previous-page').click();
  await expect(page.locator('.polish-word').first()).toHaveText(first);
});

test('hidden translations and theme survive reload', async ({ page }) => {
  await page.locator('#theme-toggle').click();
  await page.locator('#translations-toggle').click();
  await expect(page.locator('.translation-text').first()).toBeHidden();
  await page.locator('.reveal-word').first().click();
  await expect(page.locator('.translation-text').first()).toBeVisible();
  await page.locator('.examples-toggle').first().click();
  await expect(page.locator('.example-translation').first()).toBeHidden();
  await page.locator('.example-reveal').first().click();
  await expect(page.locator('.example-translation').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#translations-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.translation-text').first()).toBeHidden();
});

test('gallery supports both themes, keyboard navigation and focus restoration', async ({ page }) => {
  await page.locator('#gallery-words-tab').press('Control+ArrowRight');
  await expect(page.locator('#gallery-words-tab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#gallery-words-tab').press('ArrowRight');
  await page.locator('.screenshot-themes [data-screenshot-theme="dark"]').click();
  const opener = page.locator('#gallery-sentences .screenshot-link').first();
  await opener.click();
  await expect(page.locator('#screenshot-dialog')).toBeVisible();
  await expect(page.locator('#screenshot-full')).toHaveAttribute('src', /EX2_Dark_Front/);
  await expect.poll(() => page.locator('#screenshot-full').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#screenshot-close').press('/');
  await expect(page.locator('#screenshot-close')).toBeFocused();
  await page.locator('#screenshot-close').press('ArrowRight');
  await expect(page.locator('#screenshot-counter')).toHaveText('2 / 2');
  await page.locator('#screenshot-close').press('Escape');
  await expect(page.locator('#screenshot-dialog')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('html')).not.toHaveClass(/gallery-open/);
  await page.locator('.screenshot-themes [data-screenshot-theme="light"]').click();
  await opener.click();
  await expect(page.locator('#screenshot-full')).toHaveAttribute('src', /EX1_Light_Front/);
  await page.locator('#screenshot-close').click();
  await expect(page.locator('#screenshot-dialog')).toBeHidden();
});

test('audio and example loading failures can be retried', async ({ page }) => {
  await page.route('**/assets/audio/*-word.mp3', route => route.fulfill({ status: 503, body: '' }));
  await page.locator('#demo-audio-button').click();
  await expect(page.locator('#demo-audio-error')).toBeVisible();
  await page.unroute('**/assets/audio/*-word.mp3');
  await page.locator('#demo-audio-button').click();
  await expect.poll(() => page.locator('#demo-audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await expect(page.locator('#demo-audio-error')).toBeHidden();
  await page.route('**/assets/examples/PART.json', route => route.fulfill({ status: 503, body: '' }));
  await page.locator('[data-pos="PART"]').click();
  await page.locator('.examples-toggle').first().click();
  await expect(page.locator('.examples-retry')).toBeVisible();
  await page.unroute('**/assets/examples/PART.json');
  await page.locator('.examples-retry').click();
  await expect(page.locator('.examples-list li')).toHaveCount(3);
});

test('late audio never starts after moving to another card', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/audio/*-word.mp3', async route => { await gate; await route.continue().catch(() => {}); });
  const request = page.waitForRequest('**/assets/audio/*-word.mp3');
  await page.locator('#demo-audio-button').click();
  await request;
  await page.locator('#demo-next').click();
  release();
  await expect(page.locator('#demo-audio-button')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.locator('#demo-audio').evaluate(audio => audio.readyState)).toBeGreaterThan(0);
  expect(await page.locator('#demo-audio').evaluate(audio => audio.paused)).toBe(true);
  await expect(page.locator('#demo-audio-error')).toBeHidden();
});

test('FAQ, Excel download and navigation work without JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  for (let i = 0; i < 3; i++) {
    const summary = page.locator('.faq-list summary').nth(i);
    await summary.press('Enter');
    await expect(page.locator('.faq-list details').nth(i)).toHaveAttribute('open', '');
    await summary.press('Space');
    await expect(page.locator('.faq-list details').nth(i)).not.toHaveAttribute('open');
  }
  const download = page.waitForEvent('download');
  await page.locator('.download-button').click();
  expect((await download).suggestedFilename()).toBe('DK-Polish_Words_RU.xlsx');
  await page.locator('.back-top').click();
  await expect(page).toHaveURL(/#page-title$/);
  await page.locator('#theme-toggle').press('/');
  await expect(page.locator('#search')).toBeFocused();
  expect(errors).toEqual([]);
});
