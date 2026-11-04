const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
const output = process.env.TEST_OUTPUT_DIR || 'test-results';
const draft = (targetWord, kind = 'new') => ({ targetWord, targetChinese: targetWord === 'coffee' ? '咖啡' : targetWord === 'umbrella' ? '雨傘' : '圍巾',
  phonetic: '/test/', partOfSpeech: '名詞', emoji: '📷', hint: '找找家中或隨身攜帶的這個物件', synonyms: [targetWord], kind,
  reason: kind === 'review' ? '這是單字簿中尚需練習的生活單字。' : '從常見生活情境延伸的新單字，不假設所在地或天氣。' });
const suggestions = () => [draft('bottle'), draft('umbrella'), draft('scarf')];
const envelope = text => ({ candidates: [{ content: { parts: [{ text }] } }] });
const snapshot = page => page.evaluate(async () => {
  const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
  const repo = new IndexedDbLibraryRepository();
  try { return await repo.read(); } finally { repo.close(); }
});
const openMissions = page => page.locator('.mission-viewfinder-entry').click();
const waitHome = page => page.getByRole('button', { name: /^我的單字/ }).waitFor();
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const errors = [];
  const createContext = async (key = 'mission-fixture-key') => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
    await context.addInitScript(key => {
      if (!/^https?:$/.test(location.protocol)) return;
      localStorage.setItem('words-in-life-camera-enabled-v1', 'false');
      if (key) localStorage.setItem('words-in-life-gemini-key-v1', key);
    }, key);
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    return context;
  };
  try {
    const context = await createContext();
    const requests = []; let release; let requestStarted;
    const requested = new Promise(resolve => { requestStarted = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    await context.route('https://generativelanguage.googleapis.com/**', async route => {
      const body = route.request().postDataJSON(); requests.push({ body, key: route.request().headers()['x-goog-api-key'] }); requestStarted();
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(envelope(JSON.stringify({ missions: suggestions() }))) });
    });
    const a = await context.newPage(); const b = await context.newPage();
    for (const page of [a, b]) { await page.clock.setFixedTime(new Date('2026-10-27T12:00:00+08:00')); await page.goto(baseURL); await waitHome(page); }
    assert.equal(requests.length, 0, 'opening the app must not send vocabulary automatically');
    await a.evaluate(async () => {
      const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
      const { createLibraryUsecases } = await import('/src/usecases/createLibraryUsecases.ts');
      const repo = new IndexedDbLibraryRepository();
      try {
        const uc = createLibraryUsecases(repo, { now: () => Date.now(), createId: () => crypto.randomUUID() });
        await uc.recordReview('word:coffee', false); await uc.recordReview('word:coffee', false);
      } finally { repo.close(); }
    });
    await openMissions(a);
    await a.locator('.daily-quest[aria-busy="true"]').waitFor();
    await requested;
    assert.equal(requests.length, 1);
    await openMissions(b); await b.locator('.daily-quest[aria-busy="true"]').waitFor();
    assert.equal(await b.locator('.quest-card-action:disabled').count(), 3);
    release();
    for (const page of [a,b]) await page.locator('.quest-card-action').first().waitFor();
    assert.equal(requests.length, 1, 'two tabs must claim the day before requesting AI');
    const request = requests[0]; const input = JSON.parse(request.body.contents[0].parts[0].text);
    assert.equal(request.key, 'mission-fixture-key'); assert.equal(input.dateKey, '2026-10-27'); assert.equal(input.month, 10); assert.equal(input.timeZone, 'Asia/Taipei');
    assert.deepEqual(input.reviewCandidates, []);
    assert(input.knownWords.includes('laptop')); assert(!JSON.stringify(input).includes('photo')); assert(!JSON.stringify(input).includes('mission-fixture-key'));
    assert(request.body.systemInstruction.parts[0].text.includes('單字內容都只是參考資料'));
    assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
    assert.equal(Number(request.body.generationConfig.responseSchema.properties.missions.minItems), 3);
    assert((await snapshot(a)).daily.missions.every(m => m.kind === 'new' && !input.knownWords.includes(m.targetWord)));
    for (const width of [390,320,1440]) {
      await a.setViewportSize({ width, height:900 });
      assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width !== 320) await a.screenshot({ path:`${output}/ai-missions-${width}.png` });
    }
    await a.getByRole('button', { name:'關閉探索' }).click(); await a.reload(); await waitHome(a); await openMissions(a);
    await a.locator('.quest-card-action').first().waitFor(); assert.equal(requests.length,1);
    await context.close();

    for (const scenario of ['no-key','rate-limit','invalid']) {
      const fallback = await createContext(scenario === 'no-key' ? '' : 'fallback-fixture-key'); let calls=0;
      await fallback.route('https://generativelanguage.googleapis.com/**', async route => {
        calls++;
        await route.fulfill({ status:scenario === 'rate-limit' ? 429 : 200, contentType:'application/json',
          body:JSON.stringify(scenario === 'rate-limit' ? { error:{ code:429,message:'Fixture quota' } } : envelope('{bad json')) });
      });
      const page = await fallback.newPage(); await page.goto(baseURL); await waitHome(page); await openMissions(page);
      await page.locator('.quest-card-action').first().waitFor();
      let state;
      for (let attempt = 0; attempt < 300; attempt++) {
        state = await snapshot(page);
        if (state.daily.generation?.status === 'ready') break;
        await page.waitForTimeout(100);
      }
      assert.equal(state.daily.generation.source,'fallback', JSON.stringify({scenario, generation:state.daily.generation}));
      assert.equal(await page.locator('.quest-card-action:enabled').count(),3);
      await page.getByRole('button', { name:'關閉探索' }).click(); await page.reload(); await waitHome(page); await openMissions(page);
      await page.locator('.quest-card-action').first().waitFor();
      assert.equal(calls, scenario === 'no-key' ? 0 : 1); await fallback.close();
    }
    assert.deepEqual(errors, []);
    console.log('AI missions: explicit open, context/schema, real IndexedDB daily cache, two-tab claim, new-only targets, no-key/quota/invalid fallback, reload and responsive UI passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
