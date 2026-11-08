const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:4179';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const mode of ['zh', 'en', 'already-physical', 'unlabelled', 'enumeration-fails', 'physical-fails', 'cancel-enumeration', 'cancel-switch']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(mode => {
        window.requests = [];
        window.tracks = [];
        navigator.mediaDevices.getUserMedia = async options => {
          const exact = options.video.deviceId?.exact;
          window.requests.push(exact || 'default');
          if (exact && mode === 'physical-fails') throw new DOMException('device unavailable', 'NotReadableError');
          // Releasing the bootstrap stream before opening a physical camera is required on iOS.
          if (exact && window.tracks.some(track => track.readyState === 'live')) throw new Error('Previous camera still running');
          if (exact && mode === 'cancel-switch') await new Promise(resolve => { window.releaseSwitch = resolve; });
          const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200;
          const context = canvas.getContext('2d'); context.fillStyle = '#33aa55'; context.fillRect(0, 0, 900, 1200);
          const stream = canvas.captureStream(10);
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings.bind(track);
          track.getSettings = () => ({ ...settings(), deviceId: exact || (mode === 'already-physical' ? 'physical' : 'virtual') });
          window.tracks.push(track);
          return stream;
        };
        navigator.mediaDevices.enumerateDevices = async () => {
          window.enumerating = true;
          if (mode === 'enumeration-fails') throw new Error('enumeration unavailable');
          if (mode === 'cancel-enumeration') await new Promise(resolve => { window.releaseEnumeration = resolve; });
          return [
            { kind: 'videoinput', deviceId: 'virtual', label: '後置三相機' },
            { kind: 'videoinput', deviceId: 'front', label: 'Front Camera' },
            { kind: 'videoinput', deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
            { kind: 'videoinput', deviceId: 'physical', label: mode === 'unlabelled' ? '' : mode === 'en' ? 'Back Camera' : '後置相機' },
          ];
        };
      }, mode);
      await page.goto(baseURL);
      if (mode.startsWith('cancel')) {
        await page.waitForFunction(mode => mode === 'cancel-switch' ? !!window.releaseSwitch : window.enumerating, mode);
        await page.getByRole('switch', { name: '鏡頭', exact: true }).click();
        await page.getByText('鏡頭已暫時關閉').waitFor();
        await page.evaluate(mode => mode === 'cancel-switch' ? window.releaseSwitch() : window.releaseEnumeration(), mode);
        await page.waitForFunction(() => window.tracks.every(track => track.readyState === 'ended'));
        assert.equal(await page.evaluate(() => document.querySelector('video').srcObject), null);
        assert.equal(await page.getByRole('button', { name: '拍攝照片', exact: true }).isDisabled(), true);
      } else {
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        const expected = ['unlabelled', 'enumeration-fails', 'physical-fails'].includes(mode) ? 'virtual' : 'physical';
        assert.equal(await page.evaluate(() => document.querySelector('video').srcObject.getVideoTracks()[0].getSettings().deviceId), expected, `${mode}: prefer one physical rear lens over auto-switching virtual camera`);
        const requests = await page.evaluate(() => window.requests);
        const count = mode === 'physical-fails' ? 3 : ['zh', 'en'].includes(mode) ? 2 : 1;
        assert.equal(requests.length, count);
        await page.getByRole('button', { name: '目前 1 倍，切換至 2 倍' }).click();
        assert.equal(await page.evaluate(() => window.requests.length), count, 'digital zoom must keep the same lens');
        await page.getByRole('switch', { name: '鏡頭', exact: true }).click();
        assert.equal(await page.evaluate(() => window.tracks.every(track => track.readyState === 'ended')), true);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${mode}: physical rear selection, fallback or cancellation passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
