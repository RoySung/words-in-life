const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('Denied','NotAllowedError');}}));
    await page.goto(process.env.TEST_BASE_URL || 'http://localhost:3000');
    await page.getByRole('button',{name:/^我的單字/}).click();
    await page.getByRole('button',{name:'開始選擇題複習'}).click();
    for (let round = 0; round < 4; round++) {
      const options = page.locator('.quiz-options button');
      assert.equal(await options.count(), 4);
      const answer = options.first();
      await answer.evaluate(button => { button.click(); button.click(); });
      await page.locator('.quiz-feedback h2').waitFor();
      assert(await answer.isDisabled());
      await page.getByRole('button',{name:round === 3 ? '查看結果' : '下一題',exact:true}).click();
      if (round === 1) await page.emulateMedia({reducedMotion:'reduce'});
    }
    await page.locator('.quiz-result-score').waitFor();
    assert.equal(await page.locator('.quiz-result-score > span').textContent(), '／ 4');
    await page.getByRole('button',{name:'再挑戰 4 題'}).click();
    assert(await page.locator('.quiz-options button').first().isEnabled());
    assert.equal(await page.locator('.quiz-feedback').count(),0);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:['answer options','double-click protection','answer locking','reduced motion','final score','restart'],errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
