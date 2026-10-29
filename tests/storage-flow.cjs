const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';
(async () => {
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const profile = engine === webkit ? fs.mkdtempSync(path.join(os.tmpdir(), 'words-in-life-webkit-')) : undefined;
  const browser = engine === chromium ? await engine.launch({ headless: true, executablePath: process.env.CHROME_PATH }) : undefined;
  const context = profile ? await webkit.launchPersistentContext(profile, { headless: true }) : await browser.newContext();
  try {
    await context.addInitScript(() => localStorage.setItem('words-in-life-camera-enabled-v1', 'false'));
    const page = await context.newPage(); await page.goto(baseURL);
    const result = await page.evaluate(async () => {
      const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
      const { libraryContract } = await import('/tests/helpers/libraryContract.ts');
      const { createLibraryUsecases } = await import('/src/usecases/createLibraryUsecases.ts');
      const { parseItem } = await import('/src/domain/validation.ts');
      const { createPhotoUrls } = await import('/src/repository/photos.ts');
      const check = (value, message) => { if (!value) throw Error(message); };
      const name = `storage-contract-${crypto.randomUUID()}`;
      const repo = new IndexedDbLibraryRepository(indexedDB, name);
      await libraryContract(repo);
      const deps = { now: () => new Date('2026-10-27T12:00:00').getTime(), createId: () => crypto.randomUUID() };
      const uc = createLibraryUsecases(repo, deps);
      const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10;
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const photo = { id: 'photo:shared', bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png' };
      const makeWord = word => ({ ...parseItem({ word, chinese: '物品' }), savedAt: 1, photo: { kind: 'stored', photoId: photo.id }, crop: { kind: 'stored', photoId: photo.id } });
      await uc.saveWord(makeWord('cup'), [photo]); await uc.saveWord(makeWord('book'), [photo]);
      const urls = createPhotoUrls(repo);
      const leaseA = urls.acquire({ kind: 'stored', photoId: photo.id });
      const leaseB = urls.acquire({ kind: 'stored', photoId: photo.id });
      check(await leaseA.ready === await leaseB.ready, 'shared URL');
      let photoReads = 0, photoWrites = 0;
      const get = IDBObjectStore.prototype.get, put = IDBObjectStore.prototype.put;
      const getAll = IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.get = function(...args) { if (this.name === 'photos') photoReads++; return get.apply(this, args); };
      IDBObjectStore.prototype.getAll = function(...args) { if (this.name === 'photos') photoReads++; return getAll.apply(this, args); };
      IDBObjectStore.prototype.put = function(...args) { if (this.name === 'photos') photoWrites++; return put.apply(this, args); };
      await uc.recordReview('word:cup', true);
      check(photoReads === 0 && photoWrites === 0, 'review read/wrote photo Blob');
      const before = await repo.read();
      IDBObjectStore.prototype.put = function(...args) { if (this.name === 'meta') throw new DOMException('Injected quota', 'QuotaExceededError'); return put.apply(this, args); };
      let failed = false;
      try { await uc.removeWord('word:cup'); } catch(e) { failed = e.code === 'QuotaExceeded'; }
      check(failed, 'quota must return structured error');
      check(JSON.stringify(await repo.read()) === JSON.stringify(before), 'quota must roll back metadata');
      IDBObjectStore.prototype.put = put;
      // Asynchronous failure and explicit abort must also preserve the old snapshot.
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'meta') { this.transaction.abort(); return put.apply(this, args); }
        return put.apply(this, args);
      };
      try { await uc.removeWord('word:cup'); } catch {}
      check(JSON.stringify(await repo.read()) === JSON.stringify(before), 'abort must roll back');
      IDBObjectStore.prototype.put = function(...args) {
        // Duplicate meta key fails asynchronously after earlier writes were queued.
        return this.name === 'meta' ? this.add(...args) : put.apply(this, args);
      };
      let asynchronousFailure = false;
      try { await uc.saveWord({ ...makeWord('new object'), photo: { kind: 'stored', photoId: 'photo:new-failed' }, crop: undefined }, [{ ...photo, id: 'photo:new-failed' }]); }
      catch { asynchronousFailure = true; }
      check(asynchronousFailure, 'asynchronous request error must reject');
      check(JSON.stringify(await repo.read()) === JSON.stringify(before), 'async error must roll back metadata');
      let orphan = false; try { await repo.readPhoto('photo:new-failed'); orphan = true; } catch {}
      check(!orphan, 'async error left an orphan photo');
      IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.get = get; IDBObjectStore.prototype.getAll = getAll;
      await uc.removeWord('word:cup');
      check((await repo.readPhoto(photo.id)).bytes.length > 0, 'shared photo disappeared');
      await uc.removeWord('word:book');
      check((await fetch(await leaseA.ready)).ok, 'open inspector URL revoked by delete');
      leaseA.release(); check((await fetch(await leaseB.ready)).ok, 'last lease must remain');
      const revoked = await leaseB.ready; leaseB.release();
      let expired = false; try { await fetch(revoked); } catch { expired = true; } check(expired, 'last lease did not revoke');
      urls.close(); repo.close();
      return { photoReads, photoWrites };
    });
    console.log('IndexedDB shared contract, incremental I/O, quota/abort rollback, references and URL leases passed.', result);

    // Two real pages share one database and receive revision notifications.
    const second = await context.newPage(); await second.goto(baseURL);
    for (const target of [page, second]) await target.evaluate(async () => {
      const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
      const { createLibraryUsecases } = await import('/src/usecases/createLibraryUsecases.ts');
      window.testRepo = new IndexedDbLibraryRepository(indexedDB, 'cross-tab-contract');
      window.testUc = createLibraryUsecases(window.testRepo, { now: () => Date.now(), createId: () => crypto.randomUUID() });
      await window.testUc.initialize(async () => ({ words: [], photos: [] }));
      window.notifications = []; window.testRepo.subscribe(revision => window.notifications.push(revision));
    });
    const save = (target, word) => target.evaluate(async word => {
      const { parseItem } = await import('/src/domain/validation.ts');
      await window.testUc.saveWord({ ...parseItem({ word, chinese: '物品' }), savedAt: Date.now() });
    }, word);
    await Promise.all([save(page, 'cup'), save(second, 'book')]);
    assert.equal(await page.evaluate(async () => (await window.testUc.load()).words.length), 2);
    await Promise.all([page.evaluate(() => window.testUc.recordReview('word:cup', true)), second.evaluate(() => window.testUc.recordReview('word:cup', false))]);
    assert.equal(await page.evaluate(async () => (await window.testUc.load()).words.find(w => w.id === 'word:cup').reviewCount), 2);
    await page.waitForFunction(() => window.notifications.length >= 2);
    await page.evaluate(() => window.testUc.removeWord('word:cup'));
    assert.equal(await second.evaluate(async () => { try { await window.testUc.recordReview('word:cup', true); return false; } catch(e) { return e.code === 'NotFound'; } }), true);
    await Promise.all([save(page, 'plant'), save(second, 'plant')]);
    assert.equal(await page.evaluate(async () => (await window.testUc.load()).words.filter(w => w.id === 'word:plant').length), 1);
    // Same analysis is idempotent across pages; completing the last mission increments streak once.
    const allItems = await page.evaluate(async () => {
      const state = await window.testUc.load();
      return state.daily.missions.map(m => ({ id: `word:${m.targetWord}`, word: m.targetWord, chinese: m.targetChinese, phonetic: '', partOfSpeech: '名詞', definition: '', exampleEn: '', exampleZh: '', collocations: [], emoji: '✨', position: { x: 50, y: 50 } }));
    });
    await Promise.all([page, second].map(target => target.evaluate(items => window.testUc.completeMission({ items, analysisId: 'same-analysis' }), allItems)));
    assert.equal(await page.evaluate(async () => (await window.testUc.load()).daily.missions.filter(m => m.isCompleted).length), 1);
    await Promise.all([page, second].map((target, i) => target.evaluate(({ items, id }) => window.testUc.completeMission({ items, analysisId: id }), { items: allItems, id: `next-${i}` })));
    await Promise.all([page, second].map((target, i) => target.evaluate(({ items, id }) => window.testUc.completeMission({ items, analysisId: id }), { items: allItems, id: `last-${i}` })));
    assert.equal(await page.evaluate(async () => (await window.testUc.load()).daily.streak), 1);
    if (process.env.STORAGE_BENCHMARK) {
      const benchmark = await page.evaluate(async () => {
        const { IndexedDbLibraryRepository } = await import('/src/repository/indexedDbRepository.ts');
        const { createLibraryUsecases } = await import('/src/usecases/createLibraryUsecases.ts');
        const { parseItem } = await import('/src/domain/validation.ts');
        const repo = new IndexedDbLibraryRepository(indexedDB, `benchmark-${crypto.randomUUID()}`);
        const uc = createLibraryUsecases(repo, { now: () => Date.now(), createId: () => crypto.randomUUID() });
        const photos = [];
        const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
        const context = canvas.getContext('2d');
        for (let n = 0; n < 100; n++) {
          const image = context.createImageData(100, 100); let seed = n + 1;
          for (let i = 0; i < image.data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; image.data[i] = i % 4 === 3 ? 255 : seed >>> 24; }
          context.putImageData(image, 0, 0);
          const blob = await new Promise(resolve => canvas.toBlob(resolve));
          photos.push({ id: `photo:bench-${n}`, bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png' });
        }
        const words = Array.from({ length: 1000 }, (_, i) => ({ ...parseItem({ word: `object ${i}`, chinese: '物品' }), savedAt: i, photo: { kind: 'stored', photoId: photos[i % 100].id } }));
        const elapsed = async fn => { const start = performance.now(); await fn(); return Math.round((performance.now() - start) * 100) / 100; };
        const initializeMs = await elapsed(() => uc.initialize(async () => ({ words, photos })));
        let blobReads = 0, blobWrites = 0;
        const get = IDBObjectStore.prototype.get, getAll = IDBObjectStore.prototype.getAll, put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.get = function(...args) { if (this.name === 'photos') blobReads++; return get.apply(this, args); };
        IDBObjectStore.prototype.getAll = function(...args) { if (this.name === 'photos') blobReads++; return getAll.apply(this, args); };
        IDBObjectStore.prototype.put = function(...args) { if (this.name === 'photos') blobWrites++; return put.apply(this, args); };
        const loadMs = await elapsed(() => uc.load());
        const reviewMs = await elapsed(() => uc.recordReview(words[0].id, true));
        const saveMs = await elapsed(() => uc.saveWord({ ...parseItem({ word: 'new object', chinese: '新物品' }), savedAt: 1001, photo: words[0].photo }));
        const removeMs = await elapsed(() => uc.removeWord('word:new object'));
        IDBObjectStore.prototype.get = get; IDBObjectStore.prototype.getAll = getAll; IDBObjectStore.prototype.put = put;
        repo.close();
        if (blobReads !== 0 || blobWrites !== 0) throw Error('Metadata operations touched Blobs');
        return { words: 1000, photos: 100, photoBytes: photos.reduce((n,p) => n + p.bytes.length, 0), initializeMs, loadMs, reviewMs, saveMs, removeMs, blobReads, blobWrites };
      });
      console.log('Storage benchmark:', JSON.stringify(benchmark));
    }
    await page.evaluate(() => window.testRepo.close()); await second.evaluate(() => window.testRepo.close());
    console.log('Real cross-page concurrent save, review, delete, deduplication and notifications passed.');
  } finally { await context.close(); await browser?.close(); if (profile) fs.rmSync(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
