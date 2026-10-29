const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const snapshot = page => page.evaluate(async () => {
  const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
  const repo = new IndexedDbLibraryRepository();
  try { return { state: await repo.read() }; } finally { repo.close(); }
});
const home = page => page.getByRole('button', { name: /^我的單字/ }).waitFor();
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const errors = [];
  const create = async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('words-in-life-camera-enabled-v1', 'false'));
    return page;
  };
  try {
    // Write failures must preserve the current collection and allow retry.
    const existing = await create();
    await existing.goto(baseURL); await home(existing);
    await existing.getByRole('button', { name: /^我的單字/ }).click();
    await existing.getByRole('button', { name: '切換列表檢視' }).click();
    await existing.evaluate(() => {
      window.failWrites = true;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) { if (window.failWrites && this.name === 'meta') throw new DOMException('Injected quota', 'QuotaExceededError'); return put.apply(this, args); };
    });
    await existing.getByRole('button', { name: '移除 coffee', exact: true }).click();
    await existing.getByRole('alert').filter({ hasText: '這次變更尚未保存' }).waitFor();
    assert.equal(await existing.locator('.collection-card').count(), 4);
    await existing.evaluate(() => { window.failWrites = false; });
    await existing.getByRole('button', { name: '移除 coffee', exact: true }).click();
    await existing.waitForFunction(() => document.querySelectorAll('.collection-card').length === 3);
    await existing.getByRole('button', { name: '開始翻卡複習' }).click();
    await existing.getByRole('button', { name: '記住了', exact: true }).click();
    await existing.waitForFunction(() => document.querySelector('.quiz-dialog .page-header > span')?.textContent === '2 / 3');
    assert.equal((await snapshot(existing)).state.words.find(w => w.word === 'laptop').reviewCount, 1);
    await existing.reload(); await home(existing);
    assert.equal((await snapshot(existing)).state.words.length, 3);
    assert.equal((await snapshot(existing)).state.words.find(w => w.word === 'laptop').reviewCount, 1);
    await existing.close();
    console.log('UI write failure rollback, retry and review persistence passed.');

    // A -> B network failure -> retry must retain B, including the actual request payload.
    const retry = await create();
    await retry.addInitScript(() => localStorage.setItem('words-in-life-gemini-key-v1', 'test-key'));
    let first = true;
    const payloads = [];
    await retry.route('https://generativelanguage.googleapis.com/**', route => {
      payloads.push(route.request().postDataJSON().contents[0].parts.find(p => p.inlineData).inlineData.data);
      if (first) {
        first = false;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ isRecognizable: false, unrecognizableReason: '第一張回應', items: [] }) }] } }] }) });
      }
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'Injected failure' } }) });
    });
    await retry.goto(baseURL); await home(retry);
    await retry.locator('input[type=file]').setInputFiles('public/sample-images/cafe_scene.jpg');
    await retry.getByRole('heading', { name: '第一張回應' }).waitFor();
    await retry.locator('input[type=file]').setInputFiles('public/sample-images/food_scene.jpg');
    await retry.getByRole('heading', { name: '辨識服務暫時中斷' }).waitFor();
    const expected = 'data:image/jpeg;base64,' + fs.readFileSync('public/sample-images/food_scene.jpg').toString('base64');
    assert.equal(await retry.getByAltText('未能順利辨識的照片').getAttribute('src'), expected);
    await retry.getByRole('button', { name: '重新辨識本圖' }).click();
    await retry.getByRole('heading', { name: '辨識服務暫時中斷' }).waitFor();
    assert.notEqual(payloads[0], payloads[1]); assert.equal(payloads[1], payloads[2]);
    await retry.close();
    // Date rollover runs in an already-open page, without a reload.
    const midnight = await create();
    await midnight.clock.setFixedTime(new Date('2026-10-27T23:59:50'));
    await midnight.goto(baseURL); await home(midnight);
    assert.equal((await snapshot(midnight)).state.daily.dateKey, '2026-10-27');
    await midnight.getByRole('button', { name: /今日尋寶/ }).click();
    await midnight.locator('.mission-list button').first().click();
    await midnight.getByRole('button', { name: '取消目前任務' }).waitFor();
    await midnight.clock.setFixedTime(new Date('2026-10-28T00:00:10'));
    await midnight.waitForFunction(async () => {
      const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
      const repo = new IndexedDbLibraryRepository();
      try { return (await repo.read()).daily.dateKey === '2026-10-28'; } finally { repo.close(); }
    });
    await midnight.getByRole('button', { name: '取消目前任務' }).waitFor({ state: 'hidden' });
    assert.equal(await midnight.getByRole('button', { name: '取消目前任務' }).count(), 0);
    const day = (await snapshot(midnight)).state.daily;
    assert(day.missions.every(m => m.id.startsWith('2026-10-28') && !m.isCompleted));
    await midnight.close();
    console.log('Already-open page midnight rollover and stale quest cleanup passed.');
    assert.deepEqual(errors, []);
    console.log('Second-photo failure and retry payload regression passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
