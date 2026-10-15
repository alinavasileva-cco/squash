const { chromium } = require('playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
  const month=await page.locator('#period-label').innerText();
  const count=await page.locator('.calendar-day').count();
  if(count<28||!month)throw Error('Calendar blank: month='+month+', dayCells='+count);
  const actionCount=await page.locator('.actions > button').count();
  if(actionCount!==2)throw Error('Expected 2 actions, got '+actionCount);
  const addTraining=await page.locator('#add-session').boundingBox();
  const addStudent=await page.locator('#add-student').boundingBox();
  if(!addTraining||!addStudent||Math.abs(addTraining.y-addStudent.y)>8
    ||Math.abs(addTraining.width-addStudent.width)>6){
    throw Error('Actions not side by side: '+JSON.stringify({addTraining,addStudent}));
  }
  if(await page.locator('#delete-session').count())throw Error('Delete button still exists');
  await page.locator('#view-custom').click();
  if(!await page.locator('#calendar-custom-pickers').isVisible())throw Error('Custom date range is not visible');
  await page.locator('#calendar-from').fill('2026-10-01');
  await page.locator('#calendar-to').fill('2026-10-18');
  if(!await page.locator('#period-label').innerText()||await page.locator('.calendar-day').count()<14)throw Error('Custom date rendering failed');
  await page.locator('#add-session').click();
  if(!await page.locator('#modal-backdrop').isVisible())throw Error('Booking modal does not open');
  const price=await page.evaluate(()=>window.__squashDiagnostics?.priceOf('individual'));
  if(price!==1900)throw Error('Wrong individual price: '+price);
  if(errors.length)throw Error('Browser console errors: '+errors.join('|'));
  console.log('PASS: Calendar '+month+', '+count+' days, 2 equally sized side-by-side buttons, custom range, booking, price 1900 RUB.');
  await browser.close();
})().catch(err=>{console.error('FAIL:',err);process.exit(1)});
