const output = process.env.TEST_OUTPUT_DIR || 'test-results';
require('node:fs').mkdirSync(output, { recursive: true });
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('words-in-life-camera-enabled-v1', 'false'));
    let requests = 0;
    let recognizable = false;
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) errors.push('Unexpected backend request'); });
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
      requests++;
      assert.equal(route.request().headers()['x-goog-api-key'], 'test-user-key');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(recognizable ? {isRecognizable:true,sceneTitle:'測試場景',items:[{id:'cup',word:'cup',chinese:'杯子',position:{x:0.5,y:50}}]} : {isRecognizable:false,unrecognizableReason:'測試辨識回應',items:[]})}]}}]}) });
    });
    await page.goto(baseURL);
    await page.getByRole('button', { name: '尚未設定 API key，前往設定' }).waitFor();
    await page.locator('input[type=file]').setInputFiles('public/sample-images/cafe_scene.jpg');
    await page.getByRole('heading', { name: '設定', exact: true }).waitFor();
    assert.equal(requests, 0);
    await page.getByText('請先設定 Gemini API key，再回到首頁選擇或拍攝照片。').waitFor();
    await page.getByRole('button', { name: '儲存設定' }).click();
    await page.getByRole('alert').waitFor();
    const input = page.getByLabel('API key', { exact: true });
    await input.fill(' test-user-key ');
    assert.equal(await input.getAttribute('type'), 'password');
    await page.getByRole('button', { name: '顯示 API key' }).click();
    assert.equal(await input.getAttribute('type'), 'text');
    await page.getByRole('button', { name: '儲存設定' }).click();
    await page.getByText('已儲存 API key，可以返回首頁辨識照片。').waitFor();
    assert.equal(await input.getAttribute('type'), 'password');
    await page.reload();
    await page.getByRole('button', { name: '開啟設定' }).click();
    assert.equal(await input.inputValue(), 'test-user-key');
    await page.getByRole('button', { name: '返回首頁' }).click();
    await page.locator('input[type=file]').setInputFiles('public/sample-images/cafe_scene.jpg');
    await page.getByRole('heading', { name: '測試辨識回應' }).waitFor();
    assert.equal(requests, 1);
    recognizable = true;
    await page.getByRole('button', { name: '重新辨識本圖' }).click();
    await page.getByRole('heading', { name: /發現了/ }).waitFor();
    assert.equal(requests, 2);
    assert.equal(await page.locator('.scene-page').count(), 1);
    await page.reload();
    await page.getByRole('button', { name: '開啟設定' }).click();
    await page.getByRole('button', { name: '清除 API key', exact: true }).click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await page.evaluate(() => localStorage.getItem('words-in-life-gemini-key-v1')), null);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo(0, 0);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await page.getByRole('heading', { name: '設定', exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width !== 320) await page.screenshot({ path: `${output}/settings-${width}.png`, fullPage: true });
    }
    await page.reload();
    await page.getByRole('button', { name: '尚未設定 API key，前往設定' }).click();
    await input.fill('test-key');
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage blocked'); }; });
    await page.getByRole('button', { name: '儲存設定' }).click();
    await page.getByRole('alert').filter({ hasText: '瀏覽器無法儲存設定' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Settings: missing-key guard, validation, mask, save, reload, request header, clear, storage failure, mobile/desktop and direct Google calls passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
