const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('words-in-life-camera-enabled-v1', 'false'));
    let mode = 'success'; const calls = [];
    const payload = text => ({ candidates: [{ content: { parts: [{ text }] } }] });
    const boundingBox = { left: 30, top: 10, right: 70, bottom: 90 };
    const recognized = { isRecognizable: true, sceneTitle: '咖啡桌', items: [{ word: 'cup', chinese: '杯子', position: { x: .5, y: 80 }, boundingBox }] };
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
      const request = route.request();
      calls.push({ url: request.url(), key: request.headers()['x-goog-api-key'], body: request.postDataJSON() });
      const status = mode === 'unauthorized' ? 403 : mode === 'rate' ? 429 : mode === 'input' ? 400 : mode === 'outage' ? 503 : mode === 'fallback' && request.url().includes('missing') ? 404 : 200;
      const body = status !== 200 ? { error: { code: status, message: 'Fixture error' } } : payload(mode === 'invalid' ? '{bad json' : JSON.stringify(recognized));
      if (mode === 'cancel') await new Promise(resolve => setTimeout(resolve, 400));
      try { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); } catch { /* request cancelled */ }
    });
    await page.goto(baseURL);
    await page.evaluate(async () => {
      const { createGeminiRepository } = await import('/src/repository/gemini/geminiRepository.ts');
      window.providerKey = 'fixture-key';
      window.provider = createGeminiRepository(() => window.providerKey, ['missing', 'available']);
      window.analyze = async () => {
        try { return await window.provider.analyze({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', language: 'zh-TW', maxItems: 8 }, { signal: new AbortController().signal }); }
        catch (e) { return { code: e.code }; }
      };
    });
    const result = await page.evaluate(() => window.analyze());
    assert(result.success); assert.equal(result.data.items[0].id, 'word:cup');
    assert.deepEqual(result.data.items[0].boundingBox, boundingBox);
    assert.equal(calls[0].key, 'fixture-key');
    assert.equal(calls[0].body.contents[0].parts[0].inlineData.data, 'AQID');
    assert.equal(calls[0].body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
    assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
    const itemSchema = calls[0].body.generationConfig.responseSchema.properties.items.items;
    assert(itemSchema.required.includes('boundingBox'));
    assert.deepEqual(itemSchema.properties.boundingBox.required, ['left', 'top', 'right', 'bottom']);
    await page.evaluate(() => { window.providerKey = 'updated-key'; });
    await page.evaluate(() => window.analyze()); assert.equal(calls.at(-1).key, 'updated-key');
    for (const [scenario, code, count] of [['unauthorized', 'Unauthorized', 1], ['rate', 'RateLimited', 1], ['input', 'InvalidInput', 1], ['outage', 'Unavailable', 2], ['invalid', 'InvalidResponse', 1]]) {
      mode = scenario; const before = calls.length;
      assert.equal((await page.evaluate(() => window.analyze())).code, code);
      assert.equal(calls.length - before, count, `${scenario} must not multiply SDK and app retries`);
    }
    mode = 'fallback'; let before = calls.length;
    assert((await page.evaluate(() => window.analyze())).success);
    assert.equal(calls.length - before, 2); assert(calls.at(-1).url.includes('available'));
    await page.evaluate(() => { window.providerKey = ''; }); before = calls.length;
    assert.equal((await page.evaluate(() => window.analyze())).code, 'MissingCredential'); assert.equal(calls.length, before);
    await page.evaluate(() => { window.providerKey = 'fixture-key'; });
    mode = 'cancel'; before = calls.length;
    const cancelled = await page.evaluate(async () => {
      const abort = new AbortController();
      const pending = window.provider.analyze({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg', language: 'zh-TW', maxItems: 8 }, { signal: abort.signal });
      setTimeout(() => abort.abort(), 30);
      try { await pending; return false; } catch { return true; }
    });
    assert(cancelled); await page.waitForTimeout(500); assert(calls.length - before <= 1);
    console.log('Gemini request/response contract, current credentials, error mapping, bounded retries, model fallback and cancellation passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
