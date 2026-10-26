import {APP_NAME,GAMES,DEFAULT_SETTINGS,makeId,now} from './config.js';
import {all,get,put,remove,transact,loadAll,exportBackup,importBackup,validateBackup} from './storage.js';
import {parseSheet,namesFromColumn,findDuplicates,cleanName,csvField} from './parsing.js';
import {drawPreview,RaceEngine} from './game.js';
import {IslandEngine,ClawEngine,previewMini} from './mini-games.js';
import {avatarSvg,AVATAR_PRESETS} from './avatar.js';
import {drawWinners} from './random.js';
import {playTone} from './audio.js';

const root=document.querySelector('#app');
const toastEl=document.querySelector('#toast');
const classSwitch=document.querySelector('#classSwitch');
let state={classes:[],students:[],sessions:[],history:[],settings:{...DEFAULT_SETTINGS},activeClassId:null};
let screen='home';let selectedGameId='racing';let avatarStudentId=null;let engine=null;let busy=false;let rankingTimer=null;let searchText='';let toastTimer=null;let importedText='';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AVATAR_PRESET_MAP=new Map(AVATAR_PRESETS.map(p=>[p.seed,p]));
const gameById=id=>GAMES.find(g=>g.id===id)||GAMES[0];
const activeGame=()=>gameById(currentSession()?.pending?.gameId||selectedGameId);
const fmtDate=s=>{try{return new Date(s).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'});}catch{return s;}};
const studentsOf=(id=state.activeClassId)=>state.students.filter(s=>s.classId===id);
const classroom=()=>state.classes.find(c=>c.id===state.activeClassId);
const sessionsOf=(id=state.activeClassId)=>state.sessions.filter(s=>s.classId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const currentSession=()=>sessionsOf()[0];
const icon=(name)=>{const paths={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',play:'<path d="m8 5 12 7-12 7z"/>',plus:'<path d="M12 5v14M5 12h14"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',back:'<path d="m15 18-6-6 6-6"/>',edit:'<path d="m16 4 4 4-12 12H4v-4L16 4Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',check:'<path d="m5 12 5 5L20 7"/>',refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',trash:'<path d="M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 3-5 6-5s6 2 6 5v2M17 5a3 3 0 0 1 0 6m1 3c2 1 3 2 3 4v2"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.arrow}</svg>`;};
function notify(message,error=false){clearTimeout(toastTimer);toastEl.textContent=message;toastEl.className='toast visible'+(error?' error':'');toastTimer=setTimeout(()=>toastEl.className='toast',4400);}
async function refresh(){state=await loadAll();if(state.classes.length && !state.classes.some(c=>c.id===state.activeClassId)){state.activeClassId=state.classes[0].id;await put('meta',{id:'activeClass',value:state.activeClassId});}if(!state.classes.length)state.activeClassId=null;}
function setNav(){document.body.classList.toggle('in-game',screen==='game');root.classList.toggle('game-mode',screen==='game');
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===screen));
  classSwitch.innerHTML=state.classes.length?state.classes.map(c=>`<option value="${escapeHTML(c.id)}" ${c.id===state.activeClassId?'selected':''}>${escapeHTML(c.name)}</option>`).join(''):'<option value="">Chưa có lớp</option>';
  classSwitch.disabled=!state.classes.length;document.title=`${APP_NAME} — ${screen==='game'?activeGame().name:screen==='classes'?'Lớp học':screen==='history'?'Lịch sử':screen==='settings'?'Cài đặt':'Trò chơi'}`;
}
function render(){if(rankingTimer){clearTimeout(rankingTimer);rankingTimer=null;}if(engine){engine.destroy();engine=null;}setNav();
  if(screen==='home')root.innerHTML=renderHome();
  else if(screen==='classes')root.innerHTML=renderClasses();
  else if(screen==='history')root.innerHTML=renderHistory();
  else if(screen==='settings')root.innerHTML=renderSettings();
  else if(screen==='game'){root.innerHTML=renderGame();mountRace();}
  if(screen==='home'&&classroom()){const canvas=root.querySelector('#racePreview'),participants=studentsOf().filter(s=>s.isActive),previewId=activeGame().id;if(previewId==='racing')drawPreview(canvas,participants);else previewMini(canvas,previewId,participants.length?participants:[{id:'preview',fullName:'Thú cưng',avatarSeed:'preset-5'}]);}
  root.querySelectorAll('[data-avatar]').forEach(el=>{const seed=el.dataset.avatar;el.src=avatarSvg(seed,80);});
}
function navigate(next){if(screen==='game'&&next!=='game'&&currentSession()?.pending)notify('Lượt chơi được giữ lại. Bạn có thể tiếp tục từ trang Trò chơi.');screen=next;location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});}
function createClassMarkup(first=false){return `<form id="createClassForm" class="create-form stack">
  <h2>Tạo lớp học</h2><label class="field">Tên lớp <input name="className" maxlength="120" placeholder="Ví dụ: 7A1" autocomplete="off" required></label>
  <label class="field">Danh sách học sinh <small>Mỗi dòng một tên. Có thể thêm sau.</small><textarea name="students" id="newClassStudents" placeholder="Nguyễn Văn An&#10;Trần Minh Anh&#10;Lê Gia Bảo"></textarea></label>
  <div id="newClassColumns"></div><p class="note" style="margin:0">Tên trùng được giữ nguyên, mỗi học sinh có mã riêng.</p><button class="button primary large" type="submit">${icon('plus')} Tạo lớp</button>
  ${first?'<p class="note" style="margin:0">Dữ liệu lớp được lưu trên trình duyệt của thiết bị này.</p>':''}
</form>`;}
function welcomeArt(){return `<svg viewBox="0 0 320 180" role="img" aria-label="Minh họa các nhân vật thú cưng trên đường đua"><ellipse cx="160" cy="150" rx="140" ry="23" fill="#d5e3ce"/><path d="M46 105C31 82 66 52 94 65c26-39 58-39 85 2 33-23 61-12 72 23 21 0 40 18 29 41H45Z" fill="#b6d1ad"/><g stroke="#466b57" stroke-width="4" stroke-linejoin="round"><path d="M78 72 67 32l36 19 14-29 11 47" fill="#eab48c"/><ellipse cx="100" cy="109" rx="52" ry="48" fill="#f5d99d"/><path d="m192 71-12-41 40 14 28-20-2 48" fill="#9bc9ba"/><ellipse cx="213" cy="112" rx="52" ry="46" fill="#79b19c"/></g><g fill="#304f43"><ellipse cx="83" cy="104" rx="5" ry="7"/><ellipse cx="113" cy="104" rx="5" ry="7"/><ellipse cx="197" cy="103" rx="5" ry="7"/><ellipse cx="229" cy="103" rx="5" ry="7"/></g><path d="M90 124q9 11 18 0M204 121q9 11 18 0" fill="none" stroke="#304f43" stroke-width="4" stroke-linecap="round"/></svg>`;}
function renderHome(){const c=classroom();
  if(!c)return `<section class="blank-panel"><div class="welcome-copy"><p class="eyebrow">Bắt đầu từ lớp học</p><h1>Chào mừng đến<br>${APP_NAME}.</h1><p>Thêm danh sách học sinh, chọn Đua Thú Cưng và gọi tên bằng một cuộc đua vui nhộn.</p><div class="welcome-illustration">${welcomeArt()}</div></div>${createClassMarkup(true)}</section>`;
  const people=studentsOf(),active=people.filter(s=>s.isActive),session=currentSession(),used=session?.calledIds||[],remaining=active.filter(s=>!state.settings.avoidRepeats||!used.includes(s.id));
  const game=activeGame();const pending=!!session?.pending,exhausted=active.length>0&&remaining.length===0,shortage=!pending&&remaining.length>0&&remaining.length<state.settings.selectedCount;
  return `<div class="page-head"><div><p class="eyebrow">Hôm nay mình chơi gì?</p><h1>${escapeHTML(c.name)} <span class="muted">· ${active.length} học sinh</span></h1><p>Chọn một trò chơi để gọi học sinh tham gia hoạt động.</p></div><div class="page-actions"><button class="button light" data-action="manage">${icon('people')} Quản lý lớp</button></div></div>
  <div class="game-picker" role="group" aria-label="Chọn trò chơi">${GAMES.map((g,i)=>`<button type="button" data-action="chooseGame" data-id="${g.id}" class="game-choice ${game.id===g.id?'selected':''}" aria-pressed="${game.id===g.id}"><span class="game-choice-number">0${i+1}</span><strong>${escapeHTML(g.name)}</strong><small>${escapeHTML(g.tagline)}</small></button>`).join('')}</div>
  <div class="hero-layout">
    <div class="game-feature"><canvas id="racePreview" aria-label="Minh họa trò chơi đang chọn"></canvas><div class="feature-label">Đang chọn · ${escapeHTML(game.name)}</div></div>
    <section class="play-panel" aria-label="Cài đặt trò chơi"><div class="panel-heading"><span class="pill">${game.id==='racing'?'01':game.id==='survival'?'02':'03'} / Trò chơi</span><span class="subtle">2D · ${escapeHTML(game.tagline)}</span></div><h2>${escapeHTML(game.name)}</h2><p class="game-summary">${escapeHTML(game.description)} Kết quả được xác định ngẫu nhiên trước khi hoạt ảnh bắt đầu.</p>
    <div class="game-stat"><span>Đang tham gia</span><strong>${active.length} / ${people.length}</strong></div>
    <div class="game-stat"><span>Đã gọi trong buổi này</span><strong>${active.filter(s=>used.includes(s.id)).length} / ${active.length}</strong></div>
    <div class="controls-row"><label class="field">Số học sinh<select data-setting="selectedCount" ${pending?'disabled':''}>${[1,2,3,4,5].map(n=>`<option value="${n}" ${state.settings.selectedCount===n?'selected':''}>${n} bạn</option>`).join('')}</select></label>
    <label class="field">Thời lượng<select data-setting="duration" ${pending?'disabled':''}><option value="quick" ${state.settings.duration==='quick'?'selected':''}>Nhanh</option><option value="normal" ${state.settings.duration==='normal'?'selected':''}>Tiêu chuẩn</option></select></label></div>
    <label class="check-row" style="margin:0"><input type="checkbox" data-setting="avoidRepeats" ${state.settings.avoidRepeats?'checked':''} ${pending?'disabled':''}> Không lặp trong buổi học</label>
    ${pending?'<div class="inline-message">Có lượt chơi chưa công bố kết quả. Tiếp tục để giữ đúng người đã chọn.</div>':''}
    ${exhausted&&!pending?'<div class="inline-message">Đã gọi hết học sinh trong buổi này. Hãy bắt đầu vòng mới.</div>':''}${shortage?`<div class="inline-message">Chỉ còn ${remaining.length} học sinh đủ điều kiện. Hãy giảm số cần chọn.</div>`:''}
    <button class="button primary large" data-action="startRace" ${(!active.length||exhausted&&!pending||shortage)?'disabled':''}>${icon('play')}${pending?' Tiếp tục lượt chơi':' Bắt đầu chơi'} ${icon('arrow')}</button>
    ${pending?'<button class="button light" data-action="cancelPending">Hủy lượt chưa công bố</button>':''}
    ${exhausted&&!pending?'<button class="button light" data-action="newSession">Bắt đầu vòng mới</button>':''}
    ${!active.length?'<p class="error-message">Chưa có học sinh tham gia. Hãy thêm hoặc đánh dấu có mặt.</p>':''}
    <div class="note">${state.settings.avoidRepeats?'Ngẫu nhiên · Không lặp':'Ngẫu nhiên · Có thể lặp'}. Mọi học sinh đủ điều kiện có xác suất như nhau.</div></section></div>
    <section class="roster-section"><div class="roster-head"><h2 class="section-title">Các nhân vật</h2><button class="button text" data-action="manage">Xem cả lớp ${icon('arrow')}</button></div>
    <div class="avatar-strip">${people.slice(0,8).map(s=>`<div class="person-chip ${s.isActive?'':'absent'}"><img data-avatar="${escapeHTML(s.avatarSeed)}" alt=""><span title="${escapeHTML(s.fullName)}">${escapeHTML(s.displayName||s.fullName)}</span></div>`).join('')}${people.length>8?`<div class="strip-count">+${people.length-8} bạn khác</div>`:''}${!people.length?'<div class="empty-list" style="width:100%">Chưa có học sinh. Vào Quản lý lớp để thêm.</div>':''}</div></section>
    <p class="privacy-note">Dữ liệu lớp học được lưu trên trình duyệt của thiết bị này. Xóa dữ liệu trình duyệt có thể làm mất danh sách; hãy sao lưu ở Cài đặt.</p>`;
}
function renderClasses(){
  const c=classroom();return `<div class="page-head"><div><p class="eyebrow">Danh sách lớp học</p><h1>Quản lý lớp</h1><p>Tạo lớp, thêm học sinh và đánh dấu vắng mặt.</p></div></div>
  <div class="manage-layout"><aside class="classes-side"><h2 class="section-title">Lớp của tôi</h2><div class="class-links">${state.classes.map(cls=>`<button class="class-item ${cls.id===state.activeClassId?'selected':''}" data-action="selectClass" data-id="${escapeHTML(cls.id)}"><span><strong>${escapeHTML(cls.name)}</strong><small>${studentsOf(cls.id).length} học sinh</small></span><span>${icon('arrow')}</span></button>`).join('')}</div><details ${!state.classes.length?'open':''} style="margin-top:15px"><summary class="button light" style="cursor:pointer">${icon('plus')} Tạo lớp khác</summary><div style="padding-top:15px">${createClassMarkup()}</div></details></aside>
  <div class="manager-body">${c?renderClassDetails(c):'<div class="empty-list">Chưa có lớp. Hãy tạo lớp mới để bắt đầu.</div>'}</div></div>${avatarPickerDialog()}`;
}
function avatarPickerDialog(){return `<dialog id="avatarDialog" class="avatar-dialog" aria-labelledby="avatarDialogTitle"><div class="avatar-dialog-top"><div><p class="eyebrow">Tủ nhân vật</p><h2 id="avatarDialogTitle">Chọn thú cưng</h2><p id="avatarDialogStudent" class="subtle"></p></div><button type="button" class="button light" data-action="closeAvatar">Đóng</button></div><p class="note">Chạm vào nhân vật muốn sử dụng. Mẫu đã chọn sẽ được lưu cho học sinh ở tất cả trò chơi.</p><div class="avatar-grid" id="avatarGrid">${AVATAR_PRESETS.map(p=>`<button type="button" class="avatar-tile" data-action="pickAvatar" data-seed="${escapeHTML(p.seed)}"><img data-avatar="${escapeHTML(p.seed)}" alt=""><span>${escapeHTML(p.name)}</span></button>`).join('')}</div><div class="avatar-dialog-actions"><button type="button" class="button light" data-action="randomAvatarFromGrid">Chọn ngẫu nhiên</button></div></dialog>`;}
function renderClassDetails(c){const people=studentsOf(),filter=searchText.toLocaleLowerCase('vi');const filtered=people.filter(s=>(s.fullName+' '+s.displayName).toLocaleLowerCase('vi').includes(filter));const duplicateCount=findDuplicates(people.map(s=>s.fullName));
  return `<div class="manager-top"><div><p class="eyebrow">Đang quản lý</p><h2>${escapeHTML(c.name)}</h2><p class="subtle">${people.length} học sinh · ${people.filter(s=>s.isActive).length} có mặt</p></div><div class="manager-actions"><button class="button light small" data-action="renameClass">${icon('edit')} Sửa tên lớp</button><button class="button warning small" data-action="deleteClass">${icon('trash')} Xóa lớp</button></div></div>
  <section class="entry-panel"><h3>Thêm học sinh</h3><form id="addStudentsForm" class="entry-layout"><label class="field">Nhập hoặc dán danh sách<textarea id="studentInput" name="studentInput" placeholder="Mỗi dòng một họ tên..." required></textarea><small>Hỗ trợ dán nhiều dòng từ Excel và Google Sheets.</small></label><div class="stack"><div id="studentColumns"></div><label class="field">Nhập danh sách từ tệp <small>TXT hoặc CSV (UTF-8)</small><input id="studentFile" type="file" accept=".txt,.csv,text/plain,text/csv" style="padding:9px"></label><button class="button primary" type="submit">${icon('plus')} Thêm vào lớp</button></div></form></section>
  ${duplicateCount?`<div class="inline-message">Có ${duplicateCount} nhóm trùng họ tên. Dùng nút <strong>Sửa</strong> để đặt tên hiển thị riêng cho từng bạn, ví dụ: “An 1”, “An 2”.</div>`:''}
  <div class="list-toolbar"><h3 class="section-title" style="margin:0">Học sinh <span class="subtle">(${people.length}/50)</span></h3><label class="field"><span class="screen-reader-only">Tìm học sinh</span><input id="studentSearch" placeholder="Tìm theo tên…" value="${escapeHTML(searchText)}"></label></div>
  ${people.length?`<div style="overflow-x:auto"><table class="roster-table"><thead><tr><th>HỌ TÊN</th><th>TÊN HIỂN THỊ</th><th>NHÂN VẬT</th><th>TRẠNG THÁI</th><th style="text-align:right">THAO TÁC</th></tr></thead><tbody id="studentRows">${filtered.map(renderStudentRow).join('')}</tbody></table></div>`:'<div class="empty-list">Lớp này chưa có học sinh. Hãy dán danh sách ở trên.</div>'}
  <p class="note">Học sinh vắng mặt sẽ không tham gia lựa chọn. Lịch sử đã gọi vẫn được giữ nếu học sinh đổi tên hoặc bị xóa.</p>`;
}
function renderStudentRow(s){return `<tr class="${s.isActive?'':'row-disabled'}"><td><div class="student-cell"><img data-avatar="${escapeHTML(s.avatarSeed)}" alt=""><span>${escapeHTML(s.fullName)}</span></div></td><td>${escapeHTML(s.displayName)}</td><td><button class="button light small" data-action="openAvatar" data-id="${escapeHTML(s.id)}">Chọn thú cưng</button></td><td><span class="${s.isActive?'status-present':'status-absent'}">${s.isActive?'Có mặt':'Vắng mặt'}</span></td><td><div class="row-actions"><button class="row-action" data-action="toggleStudent" data-id="${escapeHTML(s.id)}">${s.isActive?'Cho vắng':'Cho có mặt'}</button><button class="row-action" data-action="editStudent" data-id="${escapeHTML(s.id)}">Sửa</button><button class="row-action danger" data-action="deleteStudent" data-id="${escapeHTML(s.id)}">Xóa</button></div></td></tr>`;}
function renderHistory(){const c=classroom();if(!c)return `<div class="page-head"><h1>Lịch sử gọi tên</h1></div><div class="empty-list">Hãy tạo một lớp học trước.</div>`;
  const history=state.history.filter(h=>h.classId===c.id).sort((a,b)=>b.selectedAt.localeCompare(a.selectedAt));const session=currentSession();const called=new Set(session?.calledIds||[]);const notCalled=studentsOf().filter(s=>s.isActive&&!called.has(s.id));
  return `<div class="page-head"><div><p class="eyebrow">Lớp ${escapeHTML(c.name)}</p><h1>Lịch sử gọi tên</h1><p>Ghi nhận sau khi kết quả được công bố.</p></div><div class="page-actions"><button class="button light" data-action="exportHistory" ${history.length?'':'disabled'}>${icon('download')} Xuất CSV</button></div></div>
  <div class="info-box" style="margin-bottom:23px">Phiên gần nhất: đã gọi <b>${called.size}</b> bạn. Còn <b>${notCalled.length}</b> bạn chưa được gọi trong phiên này. ${notCalled.length?`<span>(${escapeHTML(notCalled.slice(0,7).map(s=>s.displayName).join(', '))}${notCalled.length>7?'…':''})</span>`:''}</div>
  ${history.length?`<div style="overflow-x:auto"><table class="history-table"><thead><tr><th>THỜI GIAN</th><th>HỌC SINH</th><th>TRÒ CHƠI</th><th>CHẾ ĐỘ</th></tr></thead><tbody>${history.map(h=>`<tr><td>${escapeHTML(fmtDate(h.selectedAt))}</td><td><strong>${escapeHTML(h.studentNameSnapshot)}</strong>${h.studentDisplayNameSnapshot&&h.studentDisplayNameSnapshot!==h.studentNameSnapshot?`<br><small>${escapeHTML(h.studentDisplayNameSnapshot)}</small>`:''}</td><td>${escapeHTML(gameById(h.gameId).name)}</td><td>${h.avoidRepeats?'Không lặp':'Có thể lặp'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-list">Chưa có lượt gọi tên nào được công bố.</div>'}
  <div class="page-actions" style="margin-top:19px"><button class="button light" data-action="newSession">Bắt đầu buổi mới</button>${history.length?'<button class="button warning" data-action="clearHistory">Xóa lịch sử của lớp</button>':''}</div>`;
}
function renderSettings(){return `<div class="page-head"><div><p class="eyebrow">Điều chỉnh trải nghiệm</p><h1>Cài đặt & dữ liệu</h1><p>Áp dụng cho các lượt chơi mới.</p></div></div>
  <div class="settings-layout"><section class="settings-card"><h2>Trò chơi</h2><label class="field">Thời lượng mặc định<select data-setting="duration"><option value="quick" ${state.settings.duration==='quick'?'selected':''}>Nhanh · 8 giây</option><option value="normal" ${state.settings.duration==='normal'?'selected':''}>Tiêu chuẩn</option></select></label><label class="field">Số học sinh được chọn<select data-setting="selectedCount">${[1,2,3,4,5].map(n=>`<option value="${n}" ${state.settings.selectedCount===n?'selected':''}>${n} học sinh</option>`).join('')}</select></label>
  <label class="check-row"><input type="checkbox" data-setting="avoidRepeats" ${state.settings.avoidRepeats?'checked':''}><div>Không lặp trong buổi học <span>Khi hết người đủ điều kiện, cần bắt đầu vòng mới.</span></div></label></section>
  <section class="settings-card"><h2>Hiển thị và âm thanh</h2><label class="check-row"><input type="checkbox" data-setting="soundEnabled" ${state.settings.soundEnabled?'checked':''}><div>Bật âm thanh <span>Chỉ phát sau khi bạn bắt đầu chơi.</span></div></label>
  <label class="field">Âm lượng (${state.settings.volume ?? 45}%)<input type="range" data-setting="volume" min="0" max="100" step="5" value="${state.settings.volume ?? 45}"></label>
  <label class="check-row"><input type="checkbox" data-setting="showNames" ${state.settings.showNames?'checked':''}><div>Hiện tên trên đầu nhân vật <span>Giữ tên trên đường đua để dễ theo dõi cuộc đua.</span></div></label>
  <label class="check-row"><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion?'checked':''}><div>Giảm chuyển động <span>Rút ngắn cuộc đua và hạn chế hiệu ứng.</span></div></label>
  <p class="note">Ứng dụng cũng tôn trọng tùy chọn giảm chuyển động của hệ điều hành.</p></section>
  <section class="settings-card"><h2>Sao lưu & khôi phục</h2><p class="note">Bản sao lưu JSON gồm lớp, học sinh, avatar, lịch sử và phiên chơi. Không gửi dữ liệu lên máy chủ.</p><div class="stack"><button class="button primary" data-action="exportBackup">${icon('download')} Tải bản sao lưu JSON</button><label class="field">Khôi phục từ tệp JSON<input type="file" id="backupFile" accept=".json,application/json"></label><p class="note">Khi khôi phục, dữ liệu hiện tại sẽ được thay thế sau khi bạn xác nhận.</p></div></section>
  <section class="settings-card"><h2>Quyền riêng tư</h2><div class="info-box">Dữ liệu lớp học được lưu trên trình duyệt của thiết bị này.</div><p class="note">Không có tài khoản và không đồng bộ giữa các thiết bị. Chế độ ẩn danh, xóa dữ liệu trang web hoặc lỗi thiết bị có thể khiến dữ liệu bị mất. Hãy sao lưu thường xuyên.</p><button class="button light" data-action="resetSettings">Khôi phục cài đặt mặc định</button></section></div>`;}
function renderGame(){const c=classroom(),g=activeGame();return `<div class="game-frame"><div class="game-top"><div><strong>${escapeHTML(g.name)}</strong> <span>· ${escapeHTML(c?.name||'')}</span></div><div class="game-buttons"><button class="button light small" data-action="goHome">${icon('back')} Thoát</button><button class="button light small" data-action="pauseRace" id="pauseButton">${icon('pause')} Tạm dừng</button><button class="button light small" data-action="skipRace">Bỏ qua</button><button class="button light small" data-action="fullScreen">${icon('expand')} Toàn màn hình</button></div></div>
  <div class="game-canvas-wrap"><canvas id="raceCanvas" role="img" aria-label="${escapeHTML(g.name)} – hoạt cảnh chọn học sinh"></canvas>
  <section class="result-overlay" id="resultOverlay" hidden aria-live="polite" aria-atomic="true"><div class="result-board" role="status" tabindex="-1"><p class="eyebrow">KẾT QUẢ · ${escapeHTML(g.name)}</p><h2>Người được gọi là</h2><div id="winnerAvatars" class="result-icon"></div><div id="winnerNames"></div><section id="gameRanking" class="game-ranking" hidden><h3 id="rankingHeading">Bảng xếp hạng</h3><ol id="rankingRows"></ol></section><p class="note" style="font-size:13px;margin:12px 0">Người được gọi được chọn ngẫu nhiên trước khi chơi. Hoạt ảnh không quyết định kết quả.</p><div class="result-buttons"><button class="button primary" data-action="nextRace">${icon('play')} Gọi người tiếp theo</button><button class="button light" data-action="goHome">Về trang chủ</button></div></div></section></div>
  <div class="game-bottom"><span id="gameModeCaption" class="mode-caption">${state.settings.avoidRepeats?'Ngẫu nhiên · Không lặp':'Ngẫu nhiên · Có thể lặp'}</span><span class="timer" id="raceStatus">Đang chuẩn bị…</span></div></div>`;}
function showResult(winners,ranking=[]){const area=root.querySelector('#resultOverlay');if(!area)return;const list=root.querySelector('#winnerNames'),icons=root.querySelector('#winnerAvatars'),g=activeGame();
  list.innerHTML=winners.map((w,i)=>`<div class="${winners.length===1?'result-name':'result-multiple'}">${winners.length>1?`${i+1}. `:''}${escapeHTML(w.fullName)}${w.displayName!==w.fullName?`<span class="result-alias">Tên hiển thị: ${escapeHTML(w.displayName)}</span>`:''}</div>`).join('');
  icons.innerHTML=winners.slice(0,3).map(w=>`<img data-avatar="${escapeHTML(w.avatarSeed)}" alt="">`).join('');icons.querySelectorAll('[data-avatar]').forEach(el=>el.src=avatarSvg(el.dataset.avatar,140));
  const section=root.querySelector('#gameRanking');const hasRanking=g.id!=='claw'&&ranking.length>0;section.hidden=true;
  if(hasRanking){root.querySelector('#rankingHeading').textContent=g.id==='racing'?'Bảng xếp hạng · Top 3':'Nhân vật trụ lại cuối cùng';root.querySelector('#rankingRows').innerHTML=ranking.slice(0,Math.min(3,ranking.length)).map((s,i)=>`<li><span class="rank-number">${i+1}</span><img data-avatar="${escapeHTML(s.avatarSeed)}" alt=""><strong>${escapeHTML(s.fullName)}</strong>${winners.some(w=>w.id===s.id)?'<span class="rank-picked">Được gọi</span>':''}</li>`).join('');root.querySelectorAll('#rankingRows [data-avatar]').forEach(el=>el.src=avatarSvg(el.dataset.avatar,70));
    if(g.id==='racing'||state.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches)section.hidden=false;
    else rankingTimer=setTimeout(()=>{if(section.isConnected&&!area.hidden)section.hidden=false;rankingTimer=null;},900);
  }
  area.hidden=false;area.querySelector('.result-board')?.focus();root.querySelector('#raceStatus').textContent='Đã có kết quả';const pause=root.querySelector('#pauseButton');if(pause)pause.disabled=true;
}
function mountRace(){const session=currentSession(),pending=session?.pending;if(!pending){navigate('home');notify('Không tìm thấy lượt chơi cần tiếp tục.',true);return;}
  selectedGameId=pending.gameId||'racing';
  const winners=pending.winners,participants=pending.participants;
  const reduced=state.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const games={racing:RaceEngine,survival:IslandEngine,claw:ClawEngine},Engine=games[pending.gameId]||RaceEngine;
  engine=new Engine(root.querySelector('#raceCanvas'),participants,winners,{duration:pending.duration,raceSeed:pending.id,reducedMotion:reduced,soundEnabled:state.settings.soundEnabled,volume:state.settings.volume,showNames:state.settings.showNames!==false,onState:s=>{const el=root.querySelector('#raceStatus');if(el)el.textContent=({running:'Đang chơi…',paused:'Đã tạm dừng',finished:'Đã có kết quả'})[s]||s;},onFinish:()=>finishRace(pending.id,winners)});
  engine.start();playTone('start',state.settings.soundEnabled,state.settings.volume);
}
async function finishRace(pendingId,winners){if(busy)return;busy=true;try{
  const old=currentSession();if(!old||!old.pending||old.pending.id!==pendingId)return;
  const ranking=engine?.getRanking?.()||[];
  const updated={...old,pending:null,calledIds:[...new Set([...old.calledIds,...winners.map(w=>w.id)])],updatedAt:now()};
  await transact(['sessions','history'],stores=>{
    stores.sessions.put(updated);
    for(const w of winners)stores.history.put({id:makeId(),classId:old.classId,sessionId:old.id,gameId:old.pending.gameId||'racing',studentId:w.id,studentNameSnapshot:w.fullName,studentDisplayNameSnapshot:w.displayName,selectedAt:now(),avoidRepeats:old.pending.avoidRepeats});
  });
  await refresh();showResult(winners,ranking);
 }catch(e){notify('Không lưu được kết quả: '+e.message,true);root.querySelector('#raceStatus').textContent='Lỗi lưu kết quả — lượt đã chọn vẫn được giữ';}
 finally{busy=false;}}
function selectedCount(){return state.settings.selectedCount;}
async function startRace(){if(busy)return;busy=true;try{
  let session=currentSession();const c=classroom();if(!c)throw Error('Chưa có lớp học.');
  if(!session){session={id:makeId(),classId:c.id,createdAt:now(),updatedAt:now(),calledIds:[],pending:null};await put('sessions',session);}
  if(!session.pending){
    const participants=studentsOf().filter(s=>s.isActive&&(!state.settings.avoidRepeats||!session.calledIds.includes(s.id)));
    const winners=drawWinners(participants,selectedCount(),[],false);
    const p={id:makeId(),gameId:selectedGameId,winners:winners.map(s=>({...s})),participants:participants.map(s=>({...s})),duration:state.settings.duration,avoidRepeats:state.settings.avoidRepeats,pickedAt:now()};
    await put('sessions',{...session,pending:p,updatedAt:now()});
  }
  await refresh();screen='game';location.hash='game';render();
 }catch(e){notify(e.message,true);await refresh();render();}finally{busy=false;}}
async function newSession(){if(currentSession()?.pending){notify('Hãy công bố hoặc hủy lượt đang chờ trước.',true);return;}const c=classroom();if(!c)return;await put('sessions',{id:makeId(),classId:c.id,createdAt:now(),updatedAt:now(),calledIds:[],pending:null});await refresh();render();notify('Đã bắt đầu vòng mới.');}
async function createClass(form){const name=cleanName(form.elements.className.value);if(!name)throw Error('Bạn chưa nhập tên lớp.');const column=Number(form.querySelector('[name="column"]')?.value||0);const entered=readEnteredNames(form.elements.students.value,column,form);
  if(entered.length>50)throw Error('Một lớp được hỗ trợ tối đa 50 học sinh trong phiên bản này.');
  const timestamp=now(),id=makeId();const students=entered.map(fullName=>({id:makeId(),classId:id,fullName,displayName:fullName,avatarSeed:makeId(),isActive:true,createdAt:timestamp,updatedAt:timestamp}));
  await transact(['classes','students','meta','sessions'],stores=>{
    stores.classes.put({id,name,description:'',createdAt:timestamp,updatedAt:timestamp});for(const student of students)stores.students.put(student);
    stores.meta.put({id:'activeClass',value:id});stores.sessions.put({id:makeId(),classId:id,createdAt:timestamp,updatedAt:timestamp,calledIds:[],pending:null});
  });
  await refresh();screen='home';location.hash='home';render();notify(`Đã tạo lớp ${name} với ${students.length} học sinh.${findDuplicates(entered)?' Có tên trùng, tất cả đều được giữ lại.':''}`);
}
async function addStudents(form){const text=form.elements.studentInput.value;const column=Number(form.querySelector('[name="column"]')?.value||0);const names=readEnteredNames(text,column,form);if(!names.length)throw Error('Chưa có tên hợp lệ để thêm.');
  const c=classroom();const people=studentsOf();if(people.length+names.length>50)throw Error(`Lớp chỉ còn ${50-people.length} chỗ trống (tối đa 50 học sinh).`);
  const timestamp=now();await transact(['students','classes'],stores=>{for(const fullName of names)stores.students.put({id:makeId(),classId:c.id,fullName,displayName:fullName,avatarSeed:makeId(),isActive:true,createdAt:timestamp,updatedAt:timestamp});stores.classes.put({...c,updatedAt:timestamp});});
  searchText='';await refresh();render();notify(`Đã thêm ${names.length} học sinh.${findDuplicates([...people.map(s=>s.fullName),...names])?' Danh sách có tên trùng, không có ai bị loại.':''}`);
}
async function modifyStudent(id,action){const s=state.students.find(x=>x.id===id);if(!s)return;
  if(action==='deleteStudent'){
    if(!confirm(`Xóa ${s.fullName} khỏi lớp? Lịch sử đã gọi sẽ được giữ.`))return;
    if(currentSession()?.pending)throw Error('Hãy công bố hoặc hủy lượt đang chờ trước khi xóa học sinh.');await remove('students',id);
  }else if(action==='toggleStudent'){if(currentSession()?.pending)throw Error('Hãy công bố hoặc hủy lượt đang chờ trước khi đổi trạng thái.');await put('students',{...s,isActive:!s.isActive,updatedAt:now()});}
  else if(action==='rerollAvatar'){await put('students',{...s,avatarSeed:makeId(),updatedAt:now()});}
  else if(action==='editStudent'){
    const name=prompt('Họ và tên học sinh:',s.fullName);if(name===null)return;const fullName=cleanName(name);if(!fullName||fullName.length>120)throw Error('Tên học sinh phải từ 1 đến 120 ký tự.');
    const display=prompt('Tên hiển thị ngắn trên đường đua:',s.displayName||fullName);if(display===null)return;const displayName=cleanName(display);if(!displayName||displayName.length>120)throw Error('Tên hiển thị không hợp lệ.');
    await put('students',{...s,fullName,displayName,updatedAt:now()});
  }
  await refresh();render();notify('Đã cập nhật học sinh.');
}
function saveFile(name,body,mime){const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function doAction(action,id,btn){if(busy && !['pauseRace','skipRace','goHome'].includes(action))return;
  switch(action){
    case 'chooseGame':{if(currentSession()?.pending){notify('Có lượt chưa công bố. Hoàn thành hoặc hủy lượt đó trước khi đổi trò.',true);return;}selectedGameId=gameById(id).id;render();break;}
    case 'openAvatar':{const s=state.students.find(x=>x.id===id);if(!s)return;avatarStudentId=s.id;const dialog=root.querySelector('#avatarDialog');dialog.querySelector('#avatarDialogStudent').textContent=s.fullName;dialog.querySelectorAll('[data-action=pickAvatar]').forEach(b=>{b.classList.toggle('picked',b.dataset.seed===s.avatarSeed);b.setAttribute('aria-pressed',String(b.dataset.seed===s.avatarSeed));});dialog.showModal();break;}
    case 'closeAvatar':{root.querySelector('#avatarDialog')?.close();avatarStudentId=null;break;}
    case 'randomAvatarFromGrid':case 'pickAvatar':{const s=state.students.find(x=>x.id===avatarStudentId);if(!s)return;const seed=action==='pickAvatar'?btn?.dataset.seed:null;const avatarSeed=seed&&AVATAR_PRESET_MAP.has(seed)?seed:makeId();await put('students',{...s,avatarSeed,updatedAt:now()});avatarStudentId=null;await refresh();render();notify('Đã lưu nhân vật cho '+s.fullName);break;}
    case 'manage':navigate('classes');break;case 'goHome' :navigate('home');break;
    case 'startRace':await startRace();break;
    case 'nextRace':navigate('home');await startRace();break;
    case 'newSession':await newSession();break;
    case 'cancelPending':if(confirm('Hủy lượt đang chờ? Người đã chọn sẽ không được ghi vào lịch sử.')){const s=currentSession();if(s?.pending){await put('sessions',{...s,pending:null,updatedAt:now()});await refresh();render();notify('Đã hủy lượt chưa công bố.');}}break;
    case 'selectClass':if(currentSession()?.pending)notify('Lượt chơi ở lớp cũ được giữ để tiếp tục sau.');await put('meta',{id:'activeClass',value:id});searchText='';await refresh();render();break;
    case 'renameClass':{const c=classroom();if(!c)return;const input=prompt('Tên lớp mới:',c.name);if(input===null)return;const name=cleanName(input);if(!name||name.length>120)throw Error('Tên lớp phải từ 1 đến 120 ký tự.');await put('classes',{...c,name,updatedAt:now()});await refresh();render();break;}
    case 'deleteClass':{const c=classroom();if(!c)return;if(!confirm(`Xóa lớp ${c.name} và toàn bộ học sinh, lịch sử của lớp? Hành động này không thể hoàn tác.`))return;if(!confirm(`Xác nhận lần cuối: xóa lớp ${c.name}?`))return;
      await transact(['classes','students','sessions','history','meta'],stores=>{stores.classes.delete(c.id);for(const s of state.students.filter(s=>s.classId===c.id))stores.students.delete(s.id);for(const s of state.sessions.filter(s=>s.classId===c.id))stores.sessions.delete(s.id);for(const h of state.history.filter(h=>h.classId===c.id))stores.history.delete(h.id);stores.meta.put({id:'activeClass',value:state.classes.find(x=>x.id!==c.id)?.id||null});});await refresh();render();notify('Đã xóa lớp.');break;}
    case 'toggleStudent':case 'editStudent':case 'deleteStudent':case 'rerollAvatar':await modifyStudent(id,action);break;
    case 'exportBackup':{const backup=await exportBackup();saveFile(`lop-vui-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2),'application/json;charset=utf-8');notify('Đã tạo tệp sao lưu.');break;}
    case 'exportHistory':{const h=state.history.filter(h=>h.classId===state.activeClassId);const csv='\uFEFF'+[['Thời gian','Học sinh','Trò chơi','Chế độ'].map(csvField).join(','),...h.map(r=>[r.selectedAt,r.studentNameSnapshot,gameById(r.gameId).name,r.avoidRepeats?'Không lặp':'Có thể lặp'].map(csvField).join(','))].join('\r\n');saveFile(`lich-su-${classroom().name}.csv`,csv,'text/csv;charset=utf-8');break;}
    case 'clearHistory':{const c=classroom();if(!confirm(`Xóa toàn bộ lịch sử gọi tên của lớp ${c.name}?`))return;await transact(['history'],stores=>{state.history.filter(h=>h.classId===c.id).forEach(h=>stores.history.delete(h.id));});await refresh();render();notify('Đã xóa lịch sử lớp.');break;}
    case 'resetSettings':{if(!confirm('Khôi phục tất cả cài đặt mặc định?'))return;await put('meta',{id:'settings',value:DEFAULT_SETTINGS});await refresh();render();notify('Đã khôi phục cài đặt.');break;}
    case 'pauseRace':{if(!engine||engine.finished)return;const paused=engine.togglePause();const btn=root.querySelector('#pauseButton');btn.innerHTML=paused?`${icon('play')} Tiếp tục`:`${icon('pause')} Tạm dừng`;break;}
    case 'skipRace':engine?.skip();break;
    case 'fullScreen':{try{if(!document.fullscreenElement){await root.requestFullscreen?.();if(!document.fullscreenElement)notify('Trình duyệt không hỗ trợ toàn màn hình.',true);}else await document.exitFullscreen();}catch{notify('Không bật được toàn màn hình trên thiết bị này.',true);}break;}
  }
}
async function handleSetting(el){const key=el.dataset.setting;if(!key)return;
  const value=el.type==='checkbox'?el.checked:['selectedCount','volume'].includes(key)?Number(el.value):el.value;
  if(key==='selectedCount'&&(!Number.isInteger(value)||value<1||value>5))return; if(key==='volume'&&(!Number.isFinite(value)||value<0||value>100))return;
  const settings={...state.settings,[key]:value};await put('meta',{id:'settings',value:settings});await refresh();render();
}
function readEnteredNames(text,column,form){
  const rows=parseSheet(text).rows.slice(form.querySelector('[name="skipHeader"]')?.checked?1:0);
  if(rows.some(r=>cleanName(r[column]).length>120))throw Error('Có tên dài hơn 120 ký tự. Hãy chỉnh lại trước khi lưu.');
  return namesFromColumn(rows,column);
}
function showColumnSelector(text,container){const target=document.querySelector(container);if(!target)return;
  const parsed=parseSheet(text);const count=Math.max(...parsed.rows.map(r=>r.length),0);
  if(count<=1){target.innerHTML='';return;}
  target.innerHTML=`<label class="field">Cột chứa họ tên<select name="column">${Array.from({length:Math.min(count,12)},(_,i)=>`<option value="${i}" ${i===0?'selected':''}>Cột ${i+1} — ${escapeHTML(parsed.rows[0]?.[i]?.slice(0,22)||'')}</option>`).join('')}</select></label><label class="check-row" style="margin:8px 0"><input type="checkbox" name="skipHeader" ${/^(họ|tên|stt|name|mã|số)/i.test(parsed.rows[0]?.[0]||'')?'checked':''}> Bỏ dòng tiêu đề đầu tiên</label><p class="note">Dữ liệu có ${count} cột. Chọn cột tên học sinh.</p>`;
}
async function readUtf8File(file,maxSize=2*1024*1024){if(file.size>maxSize)throw Error(`Tệp quá lớn (tối đa ${Math.round(maxSize/1024/1024)} MB).`);const buf=await file.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^\uFEFF/,'');}catch{throw Error('Tệp không phải UTF-8. Hãy lưu lại thành UTF-8 rồi nhập.');}}
function updateSearch(){const input=root.querySelector('#studentSearch');if(!input)return;searchText=input.value;const people=studentsOf().filter(s=>(s.fullName+' '+s.displayName).toLocaleLowerCase('vi').includes(searchText.toLocaleLowerCase('vi')));const table=root.querySelector('#studentRows');if(!table)return;table.innerHTML=people.map(renderStudentRow).join('');table.querySelectorAll('[data-avatar]').forEach(el=>el.src=avatarSvg(el.dataset.avatar,80));}
root.addEventListener('click',async event=>{const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();navigate(nav.dataset.nav);return;}const btn=event.target.closest('[data-action]');if(!btn)return;event.preventDefault();try{await doAction(btn.dataset.action,btn.dataset.id,btn);}catch(e){notify(e.message||'Thao tác thất bại.',true);}});
document.querySelector('.topbar').addEventListener('click',event=>{const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();navigate(nav.dataset.nav);}});
classSwitch.addEventListener('change',async()=>{try{await put('meta',{id:'activeClass',value:classSwitch.value});searchText='';await refresh();render();}catch(e){notify(e.message,true);}});
root.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;const form=event.target;try{if(form.id==='createClassForm')await createClass(form);if(form.id==='addStudentsForm')await addStudents(form);}catch(e){notify(e.message,true);}finally{busy=false;}});
root.addEventListener('change',async event=>{const el=event.target;try{
  if(el.dataset.setting){await handleSetting(el);return;}
  if(el.id==='studentFile'&&el.files?.[0]){const text=await readUtf8File(el.files[0]);root.querySelector('#studentInput').value=text;showColumnSelector(text,'#studentColumns');notify('Đã đọc tệp. Chọn đúng cột tên rồi nhấn Thêm vào lớp.');}
  if(el.id==='backupFile'&&el.files?.[0]){
    const json=JSON.parse(await readUtf8File(el.files[0],25*1024*1024));const data=validateBackup(json);
    if(confirm(`Tìm thấy ${data.classes.length} lớp, ${data.students.length} học sinh.\n\nKhôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại. Tiếp tục?`)){
      await importBackup(json);searchText='';await refresh();navigate('home');notify('Đã khôi phục dữ liệu từ bản sao lưu.');
    }else el.value='';
  }
 }catch(e){notify(e instanceof SyntaxError?'Tệp JSON không hợp lệ.':e.message,true);}});
root.addEventListener('input',event=>{const el=event.target;if(el.id==='studentSearch')updateSearch();if(el.id==='studentInput')showColumnSelector(el.value,'#studentColumns');if(el.id==='newClassStudents')showColumnSelector(el.value,'#newClassColumns');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine&&!engine.paused&&!engine.finished){engine.togglePause();const btn=root.querySelector('#pauseButton');if(btn)btn.innerHTML=`${icon('play')} Tiếp tục`;}});
window.addEventListener('hashchange',()=>{const s=location.hash.slice(1);if(['home','classes','history','settings'].includes(s)&&s!==screen){screen=s;render();}});
async function init(){try{await refresh();screen=['home','classes','history','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'home';render();
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}catch(e){root.innerHTML=`<section class="blank-panel" style="display:block;min-height:0"><h1>Không thể mở dữ liệu</h1><p>${escapeHTML(e.message)}</p><p>Hãy kiểm tra quyền lưu trữ của trình duyệt, hoặc mở trang ở cửa sổ thông thường. Ứng dụng không tự xóa dữ liệu của bạn.</p><button class="button primary" id="retryStorage">Thử lại</button></section>`;root.querySelector('#retryStorage').addEventListener('click',init);}}
init();
