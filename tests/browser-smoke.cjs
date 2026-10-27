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
  // Reproduce an iPhone-like top inset and check that the modal close
  // control is fully reachable below the status bar.
  await page.evaluate(()=>document.documentElement.style.setProperty('--app-safe-top','59px'));
  await page.locator('#close-modal').waitFor({state:'visible'});
  const closeRect=await page.locator('#close-modal').boundingBox();
  const modalRect=await page.locator('.modal').boundingBox();
  const appTopPadding=await page.locator('.app-shell').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));
  if(!closeRect||!modalRect||closeRect.y<59||modalRect.y<59||appTopPadding<59){
    throw Error('iPhone status bar overlaps app/modal: '+JSON.stringify({closeRect,modalRect,appTopPadding}));
  }
  if(closeRect.width<44||closeRect.height<44)throw Error('Close button is too small');
  await page.locator('#close-modal').click();
  if(await page.locator('#modal-backdrop').isVisible())throw Error('Close button failed on mobile');
  await page.locator('#add-session').click();
  const lessonLabel=await page.locator('#session-type option[value="first"]').innerText();
  if(lessonLabel!=='Вводное')throw Error('Wrong first lesson label: '+lessonLabel);
  const price=await page.evaluate(()=>window.__squashDiagnostics?.priceOf('individual'));
  if(price!==1900)throw Error('Wrong individual price: '+price);

  // Session notes must be visible, multiline, safe, and identical across
  // the daily training list and the linked student's workout history.
  await page.locator('#close-modal').click();
  const fixtureDate = await page.evaluate(()=>{
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  });
  const originalNote='Боусты и выпад\nНужна работа с ногами <b>без HTML</b>';
  const secondNote='Повторить подготовку\nПроверить подачу';
  await page.evaluate(({day,note1,note2})=>{
    localStorage.setItem('squash-hub-coach-v1',JSON.stringify({
      version:1,
      students:[{id:'qa-mila',name:'Мила',level:'Beginner',lastDrill:'Боусты',frequency:'раз в неделю',notes:''}],
      sessions:[
        {id:'qa-session-1',studentIds:['qa-mila'],start:day+'T18:00',status:'done',type:'individual',notes:note1},
        {id:'qa-session-2',studentIds:['qa-mila'],start:day+'T19:00',status:'planned',type:'individual',notes:note2},
        {id:'qa-session-3',studentIds:['qa-mila'],start:day+'T20:00',status:'planned',type:'individual',notes:''}
      ]
    }));
  },{day:fixtureDate,note1:originalNote,note2:secondNote});
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#view-month').click();
  await page.locator('[data-day="'+fixtureDate+'"]').click();
  const notesInDay=page.locator('#day-sessions .session-note-text');
  if(await notesInDay.count()!==2)throw Error('Daily list has wrong number of notes');
  const dayNotes=await notesInDay.allTextContents();
  if(dayNotes[0]!==originalNote||dayNotes[1]!==secondNote)throw Error('Daily notes differ from saved session notes: '+JSON.stringify(dayNotes));
  if(await page.locator('#day-sessions b').count()!==0)throw Error('Session note was interpreted as HTML');
  const cssWhiteSpace=await notesInDay.first().evaluate(el=>getComputedStyle(el).whiteSpace);
  if(cssWhiteSpace!=='pre-wrap')throw Error('Session notes lose line breaks: '+cssWhiteSpace);
  await page.locator('#add-student').click();
  await page.locator('[data-student-detail="qa-mila"]').click();
  const studentNotes=page.locator('.student-list .session-note-text');
  if(await studentNotes.count()!==2)throw Error('Student history has wrong number of notes');
  const historyNotes=await studentNotes.allTextContents();
  if(!historyNotes.includes(originalNote)||!historyNotes.includes(secondNote))throw Error('Student notes do not match session notes');
  if(await page.locator('.student-list b').count()!==0)throw Error('Student note interpreted as HTML');
  console.log('PASS: full session comments in daily workout list and student history; line breaks preserved and HTML escaped.');
  if(errors.length)throw Error('Browser console errors: '+errors.join('|'));
  console.log('PASS: Calendar '+month+', '+count+' days, 2 equally sized side-by-side buttons, custom range, booking, price 1900 RUB.');
  await browser.close();
})().catch(err=>{console.error('FAIL:',err);process.exit(1)});
