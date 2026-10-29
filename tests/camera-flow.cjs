const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH, args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}, reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('words-in-life-gemini-key-v1', 'test-key');
      window.cameraTest = { streams: [], requests: [] };
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => {
        window.cameraTest.requests.push(options);
        const stream = await original(options);
        window.cameraTest.streams.push(stream);
        return stream;
      };
    });
    let captured = false;
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
      const payload = route.request().postDataJSON();
      const image = payload.contents[0].parts.find(part => part.inlineData)?.inlineData;
      captured = image?.mimeType === 'image/jpeg' && image.data.length > 1000;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({isRecognizable:false,unrecognizableReason:'測試相機已成功拍攝',items:[]})}]}}]})});
    });
    await page.goto(baseURL);
    const shutter = page.getByRole('button',{name:'拍攝照片',exact:true});
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    assert(await shutter.isEnabled());
    assert.equal(await page.evaluate(() => window.cameraTest.requests[0].video.facingMode.ideal), 'environment');
    const cameraToggle = page.getByRole('switch', {name:'鏡頭',exact:true});
    await cameraToggle.click();
    assert.equal(await cameraToggle.getAttribute('aria-checked'), 'false');
    assert(await shutter.isDisabled());
    await page.getByText('鏡頭已暫時關閉').waitFor();
    assert(await page.evaluate(()=>window.cameraTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
    await page.getByRole('button',{name:/^我的單字/}).click();
    const requestsWhilePaused = await page.evaluate(()=>window.cameraTest.requests.length);
    await page.getByRole('button',{name:'拍攝照片',exact:true}).click();
    await page.getByText('鏡頭已暫時關閉').waitFor();
    assert.equal(await page.evaluate(()=>window.cameraTest.requests.length), requestsWhilePaused);
    await page.reload();
    await page.getByText('鏡頭已暫時關閉').waitFor();
    assert.equal(await cameraToggle.getAttribute('aria-checked'), 'false');
    assert(await shutter.isDisabled());
    assert.equal(await page.evaluate(()=>window.cameraTest.requests.length), 0, 'paused camera must not request a stream on reload');
    await cameraToggle.click();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    assert(await shutter.isEnabled());
    assert.equal(await cameraToggle.getAttribute('aria-checked'), 'true');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    assert.equal(await cameraToggle.getAttribute('aria-checked'), 'true');
    assert(await shutter.isEnabled());
    await page.getByRole('button',{name:/今日尋寶/}).click();
    const target = await page.locator('.mission-list button').first().locator('strong').textContent();
    await page.locator('.mission-list button').first().click();
    await page.getByRole('button',{name:'取消目前任務'}).waitFor(); // Selection now durably locks the day's missions first.
    assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'取消目前任務'}).click();
    await page.getByRole('button',{name:/^我的單字/}).click();
    assert(await page.evaluate(()=>window.cameraTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
    await page.getByRole('button',{name:'拍攝照片',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    await shutter.click();
    await page.getByRole('heading',{name:'測試相機已成功拍攝'}).waitFor();
    assert(captured,'capture did not submit a JPEG');
    assert(await page.evaluate(()=>window.cameraTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:['on and off survive reload','paused reload never requests camera','pause stops tracks and disables shutter','pause survives navigation','resume starts camera','automatic rear camera','ready shutter','mission selection and cancellation','direct capture JPEG','stream stopped on collection/capture','stream restarted on return'],mission:target,errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
