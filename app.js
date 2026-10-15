/* Squash Hub — privacy-first offline calendar (v1).
 * Records are on THIS device only; do not silently publish/sync client data.
 */
(() => {
  'use strict';
  const KEY = 'squash-hub-coach-v1';
  const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const MONTHS_HEAD = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const TYPES = {first:'Первичная',individual:'Индивидуальная',group:'Групповая'};
  const STATUSES = {planned:'Запланирована',done:'Проведена',cancelled:'Отменена'};
  const today = new Date();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pad = (n) => String(n).padStart(2,'0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dateObj = (s) => {let [y,m,d]=(s || dateKey(today)).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
  const addDays = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  const weekStart = (d) => addDays(d,-(d.getDay()+6)%7);
  const fmtDay = (s) => {const d=dateObj(s);return `${d.getDate()} ${MONTHS[d.getMonth()]}`};
  const dow = (s) => WEEKDAYS[(dateObj(s).getDay()+6)%7];
  const money = (n) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
  let data=load();
  let selected = dateKey(today);
  let cursor = new Date(today.getFullYear(),today.getMonth(),today.getDate());
  let view='month',modalOpen=false,toaster;

  function load(){try{let raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw && Array.isArray(raw.students)&&Array.isArray(raw.sessions))return raw;}catch(e){console.warn('Невозможно прочитать локальную базу',e)}return {version:1,students:[],sessions:[]}}
  function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
  function toast(s){clearTimeout(toaster);const node=$('toast');node.textContent=s;node.classList.add('visible');toaster=setTimeout(()=>node.classList.remove('visible'),3200)}
  function studentsById(studentId){return data.students.find(s=>s.id===studentId)}
  function nameOf(s){return (s.studentIds||[]).map(studentsById).filter(Boolean).map(x=>x.name).join(' + ')||s.label||((s.type==='group')?'Групповая тренировка':'Ученик не указан')}
  function titleOf(s){return nameOf(s)}
  function amountOf(s){if(s.type==='first')return 1200;if(s.type==='individual')return 1700;if(s.type==='group' && s.rateConfirmed && s.groupRate>0 && s.count>0)return s.groupRate*s.count;return null}
  function timeOf(s){return (s.start||'').slice(11,16) || '—:—'}
  function sessionsOn(k){return data.sessions.filter(s=>(s.start||'').slice(0,10)===k).sort((a,b)=>a.start.localeCompare(b.start))}
  function render(){renderCalendar();renderDay()}
  function renderCalendar(){const grid=$('calendar-grid');let days=[];let begin,end;
    if(view==='month'){
      const d=new Date(cursor.getFullYear(),cursor.getMonth(),1);
      begin=weekStart(d);const last=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
      const lastWeekStart=weekStart(last);
      end=addDays(lastWeekStart,6);
      $('period-label').textContent=`${MONTHS_HEAD[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }else{
      begin=weekStart(cursor);end=addDays(begin,6);
      $('period-label').textContent=begin.getMonth()===end.getMonth()?`${begin.getDate()}–${end.getDate()} ${MONTHS[begin.getMonth()]}`:`${begin.getDate()} ${MONTHS[begin.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
    }
    for(let d=begin;d<=end;d=addDays(d,1)){
      const key=dateKey(d),s=sessionsOn(key),isOutside=view==='month' && d.getMonth()!==cursor.getMonth();
      const balls=s.slice(0,3).map(x=>`<span class="event-ball ${x.status==='cancelled'?'cancelled':x.status==='done'?'done':''}" title="${esc(STATUSES[x.status]||STATUSES.planned)}"></span>`).join('');
      days.push(`<button class="calendar-day${key===selected?' selected':''}${key===dateKey(today)?' today':''}${isOutside?' outside':''}" role="gridcell" data-day="${key}" aria-label="${esc(fmtDay(key))}, тренировок: ${s.length}" aria-selected="${key===selected}"><span class="number">${d.getDate()}</span><span class="dotrow">${balls}${s.length>3?`<span class="count-label">+${s.length-3}</span>`:''}</span></button>`);
    }
    grid.innerHTML=days.join('');
    $('view-month').classList.toggle('active',view==='month');$('view-week').classList.toggle('active',view==='week');$('view-month').setAttribute('aria-pressed',String(view==='month'));$('view-week').setAttribute('aria-pressed',String(view==='week'));
  }
  function renderDay(){const group=sessionsOn(selected);$('selected-day-heading').textContent=`${fmtDay(selected)} · ${dow(selected)}`;
    if(!group.length){$('day-sessions').innerHTML='<div class="empty-state"><div><strong>В этот день нет тренировок</strong><br>Выбери другое число или создай запись.</div><span class="event-ball" aria-hidden="true"></span></div>';return}
    $('day-sessions').innerHTML=group.map(s=>{const amount=amountOf(s);const inf=[TYPES[s.type]||'Тренировка',STATUSES[s.status]||STATUSES.planned,amount===null?'Тариф не указан':money(amount)].join(' · ');
      return `<div class="session-card"><span class="event-ball ${s.status==='cancelled'?'cancelled':s.status==='done'?'done':''}" aria-hidden="true"></span><div class="session-time">${esc(timeOf(s))}</div><div class="session-info"><div class="session-title ${s.status==='cancelled'?'cancelled':''}">${esc(titleOf(s))}</div><div class="session-sub">${esc(inf)}</div></div><button type="button" class="session-more" aria-label="Действия с тренировкой" data-session="${esc(s.id)}">···</button></div>`}).join('');
  }
  function show(title,kicker,content){$('modal-title').textContent=title;$('modal-kicker').textContent=kicker||'SQUASH HUB';$('modal-content').innerHTML=`<div class="modal-body">${content}</div>`;$('modal-backdrop').hidden=false;document.body.classList.add('dialog-open');modalOpen=true;}
  function close(){if(!modalOpen)return;$('modal-backdrop').hidden=true;document.body.classList.remove('dialog-open');modalOpen=false}
  function field(label,control){return `<div class="field"><span>${label}</span>${control}</div>`}
  function actionRow(submitText='Сохранить',danger=false){return `<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Назад</button><button type="submit" class="btn ${danger?'btn-danger':'btn-primary'}">${esc(submitText)}</button></div>`}
  function typeOpts(current){return Object.keys(TYPES).map(k=>`<option value="${k}" ${k===current?'selected':''}>${TYPES[k]}</option>`).join('')}
  function pickerOptions(checked=[]){if(!data.students.length)return '<span class="muted">Учеников пока нет. Добавь первого ниже.</span>';
    return data.students.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(x=>`<label class="student-option"><input type="checkbox" name="student" value="${esc(x.id)}" ${checked.includes(x.id)?'checked':''}><span>${esc(x.name)}</span></label>`).join('');
  }
  function sessionForm(s){const edit=!!s;const start=s?.start||`${selected}T18:00`;const [date,time]=start.split('T');const currentType=s?.type||'individual';
    show(edit?'Изменить тренировку':'Записать тренировку','КАЛЕНДАРЬ / ТРЕНИРОВКА',`<form id="session-form" novalidate><div id="form-error"></div><div class="field-row">
      ${field('Дата',`<input id="session-date" type="date" required value="${esc(date)}">`)}
      ${field('Время',`<input id="session-time" type="time" required value="${esc(time||'18:00')}">`)}
    </div>${field('Тип занятия',`<select id="session-type">${typeOpts(currentType)}</select>`)}
    <div class="field"><span>Ученики</span><div class="student-picker" id="student-picker">${pickerOptions(s?.studentIds||[])}</div>
      <div class="student-tools"><button type="button" class="secondary-mini" id="inline-student-toggle">＋ Новый ученик</button><span class="muted" id="selection-hint">Для индивидуальной — до двух</span></div>
      <div class="inline-student" id="inline-student" hidden><label class="field"><span>Имя нового ученика</span><input id="new-inline-name" maxlength="90" placeholder="Например, Мила"></label><button type="button" class="btn btn-primary" id="inline-create">Создать и выбрать</button></div>
    </div>
    <div class="field-row" id="group-settings" ${currentType==='group'?'':'hidden'}>
      ${field('Человек в группе',`<input id="session-count" type="number" min="1" max="100" value="${s?.count||3}">`)}
      ${field('Ставка за человека, ₽',`<input id="session-rate" type="number" min="1" max="1000000" placeholder="Уточняется" value="${s?.groupRate||''}">`)}
    </div>
    <div class="field" id="group-approval" ${currentType==='group'?'':'hidden'}><label class="student-option"><input id="session-confirmed" type="checkbox" ${s?.rateConfirmed?'checked':''}>Ставка подтверждена</label><small>Без подтверждённой ставки групповой доход не начисляется.</small></div>
    ${field('Заметка к занятию (необязательно)',`<textarea id="session-notes" rows="2" placeholder="Что планировали или отработали">${esc(s?.notes||'')}</textarea>`)}
    ${actionRow(edit?'Сохранить изменения':'Записать')}
    </form>`);
    $('session-type').addEventListener('change',syncFormType);
    $('student-picker').addEventListener('change',e=>{if(e.target.name==='student'){const inputs=[...document.querySelectorAll('#student-picker input[name=student]:checked')];if($('session-type').value!=='group'&&inputs.length>2){e.target.checked=false;toast('На индивидуальную тренировку можно выбрать до двух учеников')}}});
    $('inline-student-toggle').addEventListener('click',()=>{$('inline-student').hidden=!$('inline-student').hidden;if(!$('inline-student').hidden)$('new-inline-name').focus()});
    $('inline-create').addEventListener('click',createInlineStudent);
    $('session-form').addEventListener('submit',e=>{e.preventDefault();submitSession(s?.id)});
    syncFormType();
  }
  function syncFormType(){let group=$('session-type').value==='group';$('group-settings').hidden=!group;$('group-approval').hidden=!group;$('selection-hint').textContent=group?'Можешь указать всех известных участников':'Для индивидуальной — до двух';}
  function createStudent(name,more={}){const trimmed=name.trim();if(!trimmed)return {error:'Введи имя ученика'};
    const existing=data.students.find(x=>x.name.toLocaleLowerCase('ru')===trimmed.toLocaleLowerCase('ru'));
    if(existing)return {error:'Ученик с таким именем уже есть'};
    const student={id:id(),name:trimmed,level:more.level||'',lastDrill:more.lastDrill||'',notes:more.notes||'',frequency:more.frequency||'',createdAt:new Date().toISOString()};data.students.push(student);save();return {student};
  }
  function createInlineStudent(){let res=createStudent($('new-inline-name').value);if(res.error){toast(res.error);return}const picker=$('student-picker');picker.insertAdjacentHTML('beforeend',`<label class="student-option"><input type="checkbox" name="student" value="${res.student.id}" checked><span>${esc(res.student.name)}</span></label>`);$('inline-student').hidden=true;$('new-inline-name').value='';toast('Ученик добавлен');}
  function submitSession(sessionId){const node=$('form-error');node.innerHTML='';const date=$('session-date').value,time=$('session-time').value,type=$('session-type').value,ids=[...document.querySelectorAll('#student-picker input[name=student]:checked')].map(x=>x.value);
    const showError=s=>{node.innerHTML=`<div class="error-message">${esc(s)}</div>`};
    if(!date||!time){showError('Укажи дату и время');return}if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!/^[0-9]{2}:[0-9]{2}$/.test(time)){showError('Некорректная дата или время');return}
    if(type!=='group'&&ids.length>2){showError('Можно выбрать максимум двух учеников');return}
    if(type!=='group'&&ids.length===0){showError('Выбери ученика или добавь нового');return}
    const count=type==='group'?Number($('session-count').value):ids.length;
    if(type==='group'&&(!Number.isInteger(count)||count<1||count>100||count<ids.length)){showError('Укажи верное число участников группы');return}
    const groupRate=type==='group'&&$('session-rate').value?Number($('session-rate').value):null,rateConfirmed=type==='group'&&$('session-confirmed').checked;
    if(rateConfirmed&&(!Number.isFinite(groupRate)||groupRate<=0)){showError('Для подтверждённого тарифа укажи ставку');return}
    const previous=data.sessions.find(s=>s.id===sessionId);
    const entry={id:previous?.id||id(),start:`${date}T${time}`,type,studentIds:ids,count,groupRate,rateConfirmed:!!rateConfirmed,status:previous?.status||'planned',notes:$('session-notes').value.trim(),label:previous?.label||'',createdAt:previous?.createdAt||new Date().toISOString()};
    if(previous)Object.assign(previous,entry);else data.sessions.push(entry);
    selected=date;cursor=dateObj(date);save();close();toast(previous?'Тренировка обновлена':'Тренировка добавлена в календарь');
  }
  function showAddStudent(){show('Добавить ученика','УЧЕНИКИ / НОВАЯ КАРТОЧКА',`<form id="student-form"><div id="form-error"></div>
    ${field('Имя ученика',`<input id="student-name" maxlength="90" placeholder="Как зовут ученика?" required autofocus>`)}
    ${field('Уровень (необязательно)',`<select id="student-level"><option value="">Не указан</option><option>Начинающий</option><option>Продвинутый начинающий</option><option>Средний</option><option>Продвинутый</option></select>`)}
    ${field('Последний материал',`<input id="student-drill" maxlength="180" placeholder="Например, боусты">`)}
    ${field('Как часто занимается',`<input id="student-frequency" maxlength="100" placeholder="Например, раз в 10 дней">`)}
    ${field('Заметки (необязательно)',`<textarea id="student-notes" rows="2" placeholder="Что важно помнить"></textarea>`)}
    ${actionRow('Добавить ученика')}</form><div class="simple-note">Ученик сразу появится в списке выбора при записи тренировки.</div><div id="existing-students"></div>`);
    $('student-form').addEventListener('submit',e=>{e.preventDefault();const v=createStudent($('student-name').value,{level:$('student-level').value,lastDrill:$('student-drill').value.trim(),frequency:$('student-frequency').value.trim(),notes:$('student-notes').value.trim()});if(v.error){$('form-error').innerHTML=`<div class="error-message">${esc(v.error)}</div>`;return}toast('Ученик добавлен');close()});
    $('existing-students').innerHTML=data.students.length?`<span class="muted">Уже в списке: ${data.students.length}</span><div class="student-list" style="margin-top:9px">${data.students.map(s=>`<button data-student-detail="${esc(s.id)}"><strong>${esc(s.name)}</strong><small>${esc(s.level||'Уровень не указан')}</small></button>`).join('')}</div>`:'';
    document.querySelectorAll('[data-student-detail]').forEach(b=>b.onclick=()=>studentDetail(b.dataset.studentDetail));
  }
  function studentDetail(studentId){const s=studentsById(studentId);if(!s)return;const ss=data.sessions.filter(x=>(x.studentIds||[]).includes(studentId));show(s.name,'КАРТОЧКА УЧЕНИКА',`<div class="simple-note">${esc(s.level||'Уровень не указан')} ${s.frequency?` · ${esc(s.frequency)}`:''}</div><p><strong>Последний материал:</strong> ${esc(s.lastDrill||'—')}</p><p><strong>Заметки:</strong> ${esc(s.notes||'—')}</p><p><strong>Тренировок:</strong> ${ss.length}</p><div class="student-list">${ss.slice().sort((a,b)=>b.start.localeCompare(a.start)).map(x=>`<button data-session="${esc(x.id)}"><strong>${esc(fmtDay(x.start))} · ${esc(timeOf(x))}</strong><small>${esc(TYPES[x.type])} · ${esc(STATUSES[x.status])}</small></button>`).join('')}</div><div class="modal-actions"><button class="btn btn-secondary" data-close>Закрыть</button></div>`);
    document.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>sessionDetail(b.dataset.session));
  }
  function pickFor(kind){const entries=data.sessions.filter(x=>kind==='cancel'?x.status==='planned':true).sort((a,b)=>b.start.localeCompare(a.start));const title=kind==='cancel'?'Отменить тренировку':'Удалить тренировку';const sub=kind==='cancel'?'Выбери запись, которая не состоится. Она останется в истории.':'Удаление необратимо. Отмена сохраняет историю.';
    show(title,'КАЛЕНДАРЬ / УПРАВЛЕНИЕ',`<p class="muted">${sub}</p>${entries.length?entries.map(x=>`<button class="list-choice" data-action-pick="${kind}" data-session-id="${esc(x.id)}"><strong>${esc(fmtDay(x.start))} · ${esc(timeOf(x))} — ${esc(titleOf(x))}</strong><small>${esc(TYPES[x.type]||'Тренировка')} · ${esc(STATUSES[x.status]||'Запланирована')}</small></button>`).join(''):'<div class="simple-note">Подходящих тренировок нет</div>'}<div class="modal-actions"><button class="btn btn-secondary" data-close>Закрыть</button></div>`);
    document.querySelectorAll('[data-action-pick]').forEach(b=>b.onclick=()=>confirmAction(kind,b.dataset.sessionId));
  }
  function confirmAction(kind,sessionId){const s=data.sessions.find(x=>x.id===sessionId);if(!s)return;const removing=kind==='delete';show(removing?'Удалить запись?':'Отменить тренировку?','ПОДТВЕРЖДЕНИЕ',`<p><strong>${esc(fmtDay(s.start))}, ${esc(timeOf(s))}</strong><br>${esc(titleOf(s))}</p><div class="simple-note">${removing?'Запись будет удалена из календаря и истории без возможности восстановления.':'Запись останется в истории со статусом «Отменена». В доход она не войдёт.'}</div><div class="modal-actions"><button class="btn btn-secondary" data-close>Назад</button><button class="btn ${removing?'btn-danger':'btn-primary'}" id="confirm-action">${removing?'Удалить':'Отменить тренировку'}</button></div>`);
    $('confirm-action').onclick=()=>{if(removing)data.sessions=data.sessions.filter(x=>x.id!==sessionId);else s.status='cancelled';save();close();toast(removing?'Тренировка удалена':'Тренировка отменена')};
  }
  function sessionDetail(sessionId){const s=data.sessions.find(x=>x.id===sessionId);if(!s)return;const amount=amountOf(s);show('Тренировка','ДЕТАЛИ ЗАНЯТИЯ',`<div class="detail-top"><h3>${esc(titleOf(s))}</h3><span class="status-pill">${esc(STATUSES[s.status]||'Запланирована')}</span></div><p>${esc(fmtDay(s.start))} · <strong>${esc(timeOf(s))}</strong> · ${esc(TYPES[s.type])}</p><p class="muted">${amount===null?'Групповой тариф пока не указан':money(amount)} ${s.type==='group'?` · ${s.count} чел.`:''}</p>${s.notes?`<div class="detail-notes">${esc(s.notes)}</div>`:''}<div class="line-actions"><button class="btn btn-secondary" id="edit-session">Изменить</button>${s.status!=='done'?`<button class="btn btn-primary" id="finish-session">Проведена</button>`:''}${s.status==='planned'?`<button class="btn btn-secondary" id="cancel-detail">Отменить</button>`:''}<button class="btn btn-danger" id="delete-detail">Удалить</button></div>`);
    $('edit-session').onclick=()=>sessionForm(s);if($('finish-session'))$('finish-session').onclick=()=>{s.status='done';save();close();toast('Тренировка отмечена проведённой')};if($('cancel-detail'))$('cancel-detail').onclick=()=>confirmAction('cancel',s.id);$('delete-detail').onclick=()=>confirmAction('delete',s.id);
  }
  function downloadJSON(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),students:data.students,sessions:data.sessions},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`squash-hub-backup-${dateKey(today)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Резервная копия подготовлена')}
  function showTools(){const monday=weekStart(today),to=addDays(monday,7);let done=0,planned=0;for(const s of data.sessions){if(s.start.slice(0,10)<dateKey(monday)||s.start.slice(0,10)>=dateKey(to))continue;const m=amountOf(s)||0;if(s.status==='done')done+=m;if(s.status==='planned')planned+=m}
    show('Настройки','ДАННЫЕ / УСТАНОВКА',`<div class="simple-note"><strong>Эта неделя:</strong> заработано ${money(done)} · в плане ${money(planned)}</div><p class="muted">Важно: пока записи хранятся только в браузере на этом телефоне. Они не синхронизируются автоматически с другим устройством или ChatGPT. Рекомендуем сохранять резервную копию.</p><div class="line-actions"><button class="btn btn-primary" id="backup-download">Скачать копию</button><button class="btn btn-secondary" id="backup-import">Восстановить из файла</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><div class="simple-note"><strong>iPhone:</strong> Safari → Поделиться → На экран «Домой».<br><strong>Android:</strong> Chrome → меню ⋮ → Установить приложение.</div><div class="modal-actions"><button class="btn btn-secondary" data-close>Закрыть</button></div>`);
    $('backup-download').onclick=downloadJSON;
    $('backup-import').onclick=()=>$('backup-file').click();
    $('backup-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());if(!Array.isArray(raw.students)||!Array.isArray(raw.sessions)||raw.students.length>10000||raw.sessions.length>100000)throw Error('Неверный формат');if(!raw.students.every(x=>typeof x.id==='string'&&typeof x.name==='string')||!raw.sessions.every(x=>typeof x.id==='string'&&typeof x.start==='string'&&TYPES[x.type]&&STATUSES[x.status]))throw Error('Неверный формат записей');if(!confirm('Заменить текущие записи данными из файла? Текущие записи будут перезаписаны.'))return;data={version:1,students:raw.students,sessions:raw.sessions};save();close();toast('Данные восстановлены')}catch(err){toast('Не удалось прочитать резервную копию')}};
  }
  function bind(){
    $('add-session').onclick=()=>sessionForm();$('add-on-selected').onclick=()=>sessionForm();$('cancel-session').onclick=()=>pickFor('cancel');$('delete-session').onclick=()=>pickFor('delete');$('add-student').onclick=showAddStudent;$('tools-btn').onclick=showTools;
    $('view-month').onclick=()=>{view='month';cursor=dateObj(selected);renderCalendar()};$('view-week').onclick=()=>{view='week';cursor=dateObj(selected);renderCalendar()};
    $('prev-period').onclick=()=>{cursor=view==='month'?new Date(cursor.getFullYear(),cursor.getMonth()-1,1):addDays(cursor,-7);renderCalendar()};$('next-period').onclick=()=>{cursor=view==='month'?new Date(cursor.getFullYear(),cursor.getMonth()+1,1):addDays(cursor,7);renderCalendar()};$('today').onclick=()=>{selected=dateKey(today);cursor=new Date(today.getFullYear(),today.getMonth(),today.getDate());render()};
    $('calendar-grid').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;selected=b.dataset.day;cursor=dateObj(selected);render()});$('day-sessions').addEventListener('click',e=>{const b=e.target.closest('[data-session]');if(b)sessionDetail(b.dataset.session)});
    $('close-modal').onclick=close;$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop')||e.target.closest('[data-close]'))close()};document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    if('serviceWorker' in navigator && window.isSecureContext)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  bind();render();
  // Safe, non-mutating diagnostics for development; not exposed in the UI.
  window.__squashDiagnostics=Object.freeze({sessionCount:()=>data.sessions.length,studentCount:()=>data.students.length,priceOf:(type,count=1,rate=null)=>amountOf({type,count,groupRate:rate,rateConfirmed:!!rate})});
})();