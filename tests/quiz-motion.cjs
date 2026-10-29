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
    await page.getByRole('button',{name:'開始翻卡複習'}).click();
    await page.getByRole('button',{name:'翻卡查看解答'}).click();
    const remembered=page.getByRole('button',{name:'記住了',exact:true});
    await remembered.evaluate(button=>{button.click();button.click();});
    await page.locator('.quiz-card.is-advancing').waitFor();
    const motion=await page.locator('.quiz-next-card').evaluate(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration}));
    assert.equal(motion.name,'quiz-draw-next');
    assert.equal(motion.duration,'0.6s');
    const path=await page.locator('.quiz-next-card').evaluate(el=>{
      const animation=el.getAnimations()[0];
      animation.pause();
      animation.currentTime=0;
      const start=el.getBoundingClientRect().left;
      animation.currentTime=300;
      const middle=el.getBoundingClientRect().left;
      animation.play();
      return {start,middle,viewport:innerWidth};
    });
    assert(path.start>=path.viewport,'next card must start outside the right viewport');
    assert(path.middle<path.start,'next card must travel left');
    assert(await remembered.isDisabled());
    await page.waitForFunction(()=>document.querySelector('.quiz-dialog .page-header > span')?.textContent==='2 / 4');
    assert(await page.getByRole('button',{name:'翻卡查看解答'}).isEnabled());
    assert.equal(await page.getByRole('dialog').getByRole('heading',{name:'laptop',exact:true}).count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'還不熟',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.quiz-dialog .page-header > span')?.textContent==='3 / 4');
    await page.getByRole('button',{name:'記住了',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.quiz-dialog .page-header > span')?.textContent==='4 / 4');
    await page.getByRole('button',{name:'還不熟',exact:true}).click();
    await page.getByRole('heading',{name:'今天又多記住了一點。'}).waitFor();
    assert(await page.getByText('4 個單字中，你記住了 2 個。',{exact:true}).isVisible());
    await page.getByRole('button',{name:'再複習一次'}).click();
    assert(await page.getByRole('button',{name:'翻卡查看解答'}).isEnabled());
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:['right-to-left entrance from outside viewport','double-click protection','new card photo front','reduced motion','final score','restart'],errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
