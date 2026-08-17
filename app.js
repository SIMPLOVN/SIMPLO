// ============================================================================
// CALENDÁRIO ACADÊMICO — app.js
// Lógica completa do aplicativo (vanilla JS, sem dependências)
// ============================================================================

// ===========================================
// DADOS DO SEMESTRE
// ===========================================
const START = new Date(2026, 7, 3);   // 3 de agosto de 2026
const END   = new Date(2026, 11, 4);  // 4 de dezembro de 2026
const NOW   = new Date();
const CLASS_END = { hour: 22, minute: 30 };

const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const WEEKDAY_LONG = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const TIME_SLOTS = ['19:00-19:50','19:50-20:40','20:50-21:40','21:40-22:30'];

const TYPE_LABEL = { aula:'Aula', prova:'Prova', trabalho:'Trabalho', seminario:'Seminário', evento:'Evento' };
const TYPE_ICON  = { aula:'📘', prova:'📝', trabalho:'🗂️', seminario:'🎤', evento:'📌' };

const SUBJECTS = {
  CEE010: { code:'CEE010', nome:'Gestão de Marcas',                       professor:'Rodolfo Ribeiro',            weekday:1, limiteFaltas:20, faltasPorAula:4 },
  CEE011: { code:'CEE011', nome:'Coaching Empresarial',                    professor:'Mônica Pereira da Rosa',     weekday:2, limiteFaltas:20, faltasPorAula:4 },
  CEE009: { code:'CEE009', nome:'Políticas Públicas em Empreendedorismo',  professor:'Fabio Gomes de Almeida',     weekday:3, limiteFaltas:20, faltasPorAula:4 },
  AGF013: { code:'AGF013', nome:'Investimentos e Financiamentos',          professor:'Robson Pereira de Souza',    weekday:4, limiteFaltas:20, faltasPorAula:4 },
  AGS002: { code:'AGS002', nome:'Gestão de Materiais',                     professor:'Sidioney Onézio Silveira',   weekday:5, limiteFaltas:20, faltasPorAula:4 }
};
const SCHEDULE = { 1:SUBJECTS.CEE010, 2:SUBJECTS.CEE011, 3:SUBJECTS.CEE009, 4:SUBJECTS.AGF013, 5:SUBJECTS.AGS002 };

const HOLIDAYS = new Set(['2026-09-07','2026-10-02','2026-10-12','2026-11-02','2026-11-20']);
const HOLIDAY_NAMES = {
  '2026-09-07':'Independência do Brasil',
  '2026-10-02':'Recesso',
  '2026-10-12':'N. Sra. Aparecida',
  '2026-11-02':'Finados',
  '2026-11-20':'Consciência Negra'
};

const HEAD_COLORS = {
  7:'linear-gradient(120deg,#5ec98a,#1f8f52)',
  8:'linear-gradient(120deg,#4bbd7d,#17794c)',
  9:'linear-gradient(120deg,#37a76b,#0f6440)',
  10:'linear-gradient(120deg,#279260,#0b5536)',
  11:'linear-gradient(120deg,#177a4a,#0a4530)'
};
const MONTHS_TO_SHOW = [{y:2026,m:7},{y:2026,m:8},{y:2026,m:9},{y:2026,m:10},{y:2026,m:11}];

const COLORS = {
  purple: { label:'Roxo',          50:'#EEEDFE', 600:'#534AB7', 800:'#3C3489' },
  teal:   { label:'Verde-azulado', 50:'#E1F5EE', 600:'#0F6E56', 800:'#085041' },
  coral:  { label:'Coral',         50:'#FAECE7', 600:'#993C1D', 800:'#712B13' },
  pink:   { label:'Rosa',          50:'#FBEAF0', 600:'#993556', 800:'#72243E' },
  blue:   { label:'Azul',          50:'#E6F1FB', 600:'#185FA5', 800:'#0C447C' },
  amber:  { label:'Âmbar',         50:'#FAEEDA', 600:'#854F0B', 800:'#633806' },
  red:    { label:'Vermelho',      50:'#FCEBEB', 600:'#A32D2D', 800:'#791F1F' },
  gray:   { label:'Cinza',         50:'#F1EFE8', 600:'#5F5E5A', 800:'#444441' }
};

// ===========================================
// ESTADO DA APLICAÇÃO
// ===========================================
let dayData = {};
let subjectMaterials = {};
let activeKey = null, activeCell = null, activeCode = null, activeDate = null;
let pendingColor = null, pendingStatus = null;
let confirmQueue = [];

// ===========================================
// PERSISTÊNCIA (localStorage + Firestore)
// ===========================================
let _firestoreSyncing = false;  // Flag para evitar loops de sync

function loadData() {
  try {
    const raw = localStorage.getItem('cal-day-data-v2');
    if (raw) { dayData = JSON.parse(raw); return; }
    // Migração de formatos antigos
    const oldV2 = localStorage.getItem('day-data-v2');
    if (oldV2) { dayData = JSON.parse(oldV2); saveData(); return; }
    const oldV1 = localStorage.getItem('day-data');
    if (oldV1) {
      const parsed = JSON.parse(oldV1);
      Object.keys(parsed).forEach(k => {
        const o = parsed[k];
        dayData[k] = { ...defaultRecord(), status: o.marked ? 'presente' : 'pendente', note: o.note || '', color: o.color || null };
      });
      saveData(); return;
    }
    const older = localStorage.getItem('marked-days');
    if (older) {
      JSON.parse(older).forEach(k => { dayData[k] = { ...defaultRecord(), status:'presente' }; });
      saveData();
    }
  } catch(e) { console.warn('Erro ao carregar dados:', e); dayData = {}; }
}

function saveData() {
  try { localStorage.setItem('cal-day-data-v2', JSON.stringify(dayData)); }
  catch(e) { showToast('Erro ao salvar dados. Verifique o espaço do navegador.'); }
  syncDayDataToFirestore();
}

function loadMaterials() {
  try {
    const raw = localStorage.getItem('cal-subject-materials');
    if (raw) subjectMaterials = JSON.parse(raw);
  } catch(e) { subjectMaterials = {}; }
}

function saveMaterials() {
  try { localStorage.setItem('cal-subject-materials', JSON.stringify(subjectMaterials)); }
  catch(e) { showToast('Erro ao salvar materiais.'); }
  syncMaterialsToFirestore();
}

function getMaterials(code) {
  if (!subjectMaterials[code]) subjectMaterials[code] = { links:[], files:[] };
  return subjectMaterials[code];
}

// ===========================================
// FIREBASE FIRESTORE — Sincronização
// ===========================================
function syncDayDataToFirestore() {
  if (_firestoreSyncing) return;
  if (typeof db === 'undefined') return;
  try {
    dayDataRef.set({ data: JSON.stringify(dayData), updatedAt: new Date().toISOString() })
      .catch(e => console.warn('Firestore sync (dayData) falhou:', e));
  } catch(e) { /* silencioso */ }
}

function syncMaterialsToFirestore() {
  if (_firestoreSyncing) return;
  if (typeof db === 'undefined') return;
  try {
    materialsRef.set({ data: JSON.stringify(subjectMaterials), updatedAt: new Date().toISOString() })
      .catch(e => console.warn('Firestore sync (materials) falhou:', e));
  } catch(e) { /* silencioso */ }
}

function loadFromFirestore() {
  if (typeof db === 'undefined') return;

  // Carregar dayData
  dayDataRef.get().then(doc => {
    if (doc.exists && doc.data().data) {
      const remote = JSON.parse(doc.data().data);
      if (Object.keys(remote).length > 0) {
        dayData = remote;
        localStorage.setItem('cal-day-data-v2', JSON.stringify(dayData));
        refreshAll();
        console.log('📥 Dados carregados do Firestore');
        showToast('☁️ Dados carregados da nuvem!');
      }
    } else if (Object.keys(dayData).length > 0) {
      // Firestore vazio mas localStorage tem dados → envia pra nuvem
      console.log('📤 Enviando dados locais pro Firestore pela primeira vez...');
      syncDayDataToFirestore();
      showToast('📤 Seus dados foram enviados pra nuvem!');
    }
  }).catch(e => {
    console.warn('Firestore load (dayData) falhou:', e);
    showToast('⚠️ Não foi possível conectar ao banco de dados. Verifique as regras do Firestore.');
  });

  // Carregar materials
  materialsRef.get().then(doc => {
    if (doc.exists && doc.data().data) {
      const remote = JSON.parse(doc.data().data);
      subjectMaterials = remote;
      localStorage.setItem('cal-subject-materials', JSON.stringify(subjectMaterials));
      console.log('📥 Materiais carregados do Firestore');
    } else if (Object.keys(subjectMaterials).length > 0) {
      // Firestore vazio mas localStorage tem materiais → envia
      syncMaterialsToFirestore();
    }
  }).catch(e => console.warn('Firestore load (materials) falhou:', e));
}

function startFirestoreListeners() {
  if (typeof db === 'undefined') return;

  // Listener tempo real — dayData
  dayDataRef.onSnapshot(doc => {
    if (!doc.exists || !doc.data().data) return;
    try {
      const remote = JSON.parse(doc.data().data);
      const local = JSON.stringify(dayData);
      const remoteStr = JSON.stringify(remote);
      if (local === remoteStr) return; // Sem mudanças
      _firestoreSyncing = true;
      dayData = remote;
      localStorage.setItem('cal-day-data-v2', remoteStr);
      refreshAll();
      showToast('🔄 Dados sincronizados de outro dispositivo!');
      _firestoreSyncing = false;
    } catch(e) { _firestoreSyncing = false; }
  }, e => console.warn('Firestore listener (dayData) erro:', e));

  // Listener tempo real — materials
  materialsRef.onSnapshot(doc => {
    if (!doc.exists || !doc.data().data) return;
    try {
      const remote = JSON.parse(doc.data().data);
      if (JSON.stringify(subjectMaterials) === JSON.stringify(remote)) return;
      _firestoreSyncing = true;
      subjectMaterials = remote;
      localStorage.setItem('cal-subject-materials', JSON.stringify(subjectMaterials));
      _firestoreSyncing = false;
    } catch(e) { _firestoreSyncing = false; }
  }, e => console.warn('Firestore listener (materials) erro:', e));

  console.log('👂 Listeners Firestore ativos — sincronização em tempo real!');
}

// ===========================================
// FUNÇÕES AUXILIARES
// ===========================================
function defaultRecord() {
  return { status:'pendente', note:'', color:null, important:false, type:'aula', confirmedAt:null };
}
function getRecord(key) {
  return dayData[key] ? { ...defaultRecord(), ...dayData[key] } : defaultRecord();
}
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function isWeekend(d)  { const w = d.getDay(); return w === 0 || w === 6; }
function isHoliday(d)  { return HOLIDAYS.has(dateKey(d)); }
function inRange(d)    { return d >= START && d <= END && !isWeekend(d) && !isHoliday(d); }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function classEndDateTime(d) { const dt = new Date(d); dt.setHours(CLASS_END.hour, CLASS_END.minute, 0, 0); return dt; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function totalRangeDays() {
  let count = 0;
  for (let d = new Date(START); d <= END; d.setDate(d.getDate()+1)) {
    if (inRange(d)) count++;
  }
  return count;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return Math.round(bytes/1024) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}
function formatPct(value) {
  const truncated = Math.floor(value * 100) / 100;
  return truncated.toFixed(2).replace('.', ',') + '%';
}
function formatDateShort(d) {
  return d.getDate() + ' de ' + MONTH_NAMES[d.getMonth()];
}

// ===========================================
// TOAST
// ===========================================
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 4500);
}

// ===========================================
// BARRA DE PROGRESSO (HERO)
// ===========================================
function updateProgress() {
  const total = totalRangeDays();
  const count = Object.values(dayData).filter(r => r.status === 'presente').length;
  const pct = Math.min(100, (count / total) * 100);

  const fill = document.getElementById('fill');
  const marker = document.getElementById('marker');
  const title = document.getElementById('hero-title');
  const sub = document.getElementById('hero-sub');

  if (fill) fill.style.width = pct + '%';
  if (marker) marker.style.left = Math.min(100, pct) + '%';

  if (title && sub) {
    if (count === 0) {
      title.textContent = 'Sua contagem de dias';
      sub.textContent = 'Marque cada dia no calendário para acompanhar seu progresso. Cada dia vale ' + formatPct(100/total) + '.';
    } else if (pct >= 100) {
      title.textContent = 'Você chegou lá! 🎉';
      sub.textContent = 'Todos os ' + total + ' dias até 4 de dezembro foram marcados.';
    } else {
      title.textContent = count + ' de ' + total + ' dias (' + formatPct(pct) + ')';
      sub.textContent = 'Faltam ' + (total - count) + ' dias até 4 de dezembro de 2026.';
    }
  }
}

// ===========================================
// ESTILO VISUAL DOS DIAS
// ===========================================
function computeVisualStyle(record) {
  if (record.color && COLORS[record.color]) {
    const c = COLORS[record.color];
    return { background:c[50], borderColor:c[600], color:c[800] };
  }
  if (record.type !== 'aula' && record.status === 'pendente') {
    return { background:'var(--blue-50)', borderColor:'var(--blue-600)', color:'var(--blue-800)' };
  }
  if (record.status === 'presente') {
    return { background:'#dcf3e4', borderColor:'var(--mint-600)', color:'var(--mint-900)' };
  }
  if (record.status === 'falta') {
    return { background:'var(--amber-50)', borderColor:'var(--amber-600)', color:'var(--amber-800)' };
  }
  return null;
}

function renderCellContent(cell, key, within) {
  // Limpa conteúdo anterior
  cell.querySelectorAll('.day-num, .day-tag, .day-note-dot, .day-detail-btn').forEach(el => el.remove());
  cell.style.background = '';
  cell.style.borderColor = '';
  cell.style.color = '';

  const day = parseInt(cell.dataset.day, 10);
  const numSpan = document.createElement('span');
  numSpan.className = 'day-num';
  numSpan.textContent = day;
  cell.appendChild(numSpan);

  if (!within) return;

  const record = getRecord(key);
  const d = new Date(parseInt(cell.dataset.year), parseInt(cell.dataset.month), day);
  const subject = SCHEDULE[d.getDay()];

  if (subject) {
    let tip = subject.nome + ' (' + subject.code + ') — ' + subject.professor;
    if (record.type !== 'aula') tip += ' | ' + TYPE_LABEL[record.type];
    if (record.note) tip += '\nNota: ' + record.note;
    cell.title = tip;

    const tag = document.createElement('span');
    tag.className = 'day-tag';
    tag.textContent = record.type !== 'aula'
      ? TYPE_ICON[record.type] + ' ' + subject.code
      : subject.code;
    cell.appendChild(tag);
  }

  const style = computeVisualStyle(record);
  if (style) {
    cell.style.background = style.background;
    cell.style.borderColor = style.borderColor;
    cell.style.color = style.color;
  }

  if (record.note) {
    const dot = document.createElement('span');
    dot.className = 'day-note-dot';
    cell.appendChild(dot);
  }

  const detailBtn = document.createElement('button');
  detailBtn.type = 'button';
  detailBtn.className = 'day-detail-btn';
  detailBtn.textContent = '⋯';
  detailBtn.title = 'Detalhes';
  cell.appendChild(detailBtn);
}

// ===========================================
// CONSTRUÇÃO DOS MESES
// ===========================================
function buildMonth(y, m) {
  const card = document.createElement('div');
  card.className = 'month-card';

  // Cabeçalho
  const head = document.createElement('div');
  head.className = 'month-head';
  head.style.background = HEAD_COLORS[m] || HEAD_COLORS[7];

  const title = document.createElement('span');
  title.className = 'month-title-text';
  title.textContent = MONTH_NAMES[m];
  title.style.cssText = 'color:#fff;font-family:var(--font-serif);font-size:1.15rem;font-weight:600;text-transform:capitalize;';

  const countSpan = document.createElement('span');
  countSpan.className = 'month-count';
  countSpan.id = 'count-' + y + '-' + m;
  countSpan.style.cssText = 'color:rgba(255,255,255,0.85);font-size:0.75rem;';

  head.appendChild(title);
  head.appendChild(countSpan);
  card.appendChild(head);

  // Grid
  const gridWrap = document.createElement('div');
  gridWrap.className = 'month-grid-wrapper';
  const grid = document.createElement('div');
  grid.className = 'grid';

  WEEKDAYS.forEach(w => {
    const wd = document.createElement('div');
    wd.className = 'grid-head';
    wd.textContent = w;
    grid.appendChild(wd);
  });

  const firstDay = new Date(y, m, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    empty.style.visibility = 'hidden';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    const cell = document.createElement('div');
    cell.dataset.day = day;
    cell.dataset.month = m;
    cell.dataset.year = y;

    const within = inRange(d);
    const withinSpan = d >= START && d <= END;
    const weekendInSpan = withinSpan && isWeekend(d);
    const holidayInSpan = withinSpan && !isWeekend(d) && isHoliday(d);

    let cls = 'out-range';
    if (within) cls = 'in-range';
    else if (holidayInSpan) cls = 'holiday';
    else if (weekendInSpan) cls = 'weekend';

    cell.className = 'day ' + cls;
    if (sameDay(d, NOW)) cell.classList.add('today');

    const key = dateKey(d);
    renderCellContent(cell, key, within);

    if (holidayInSpan) {
      cell.title = HOLIDAY_NAMES[key] || 'Feriado — sem aula';
    }

    grid.appendChild(cell);
  }

  gridWrap.appendChild(grid);
  card.appendChild(gridWrap);
  return card;
}

function updateMonthCount(y, m) {
  const el = document.getElementById('count-' + y + '-' + m);
  if (!el) return;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    if (inRange(d) && getRecord(dateKey(d)).status === 'presente') count++;
  }
  el.textContent = count + ' presença' + (count === 1 ? '' : 's');
}

// ===========================================
// TOGGLE RÁPIDO DE PRESENÇA
// ===========================================
function toggleMarkDirect(key, cell, y, m) {
  const record = getRecord(key);
  const newStatus = record.status === 'presente' ? 'pendente' : 'presente';
  dayData[key] = { ...record, status: newStatus, confirmedAt: newStatus === 'pendente' ? null : new Date().toISOString() };
  renderCellContent(cell, key, true);
  const day = parseInt(cell.dataset.day, 10);
  if (sameDay(new Date(y, m, day), NOW)) cell.classList.add('today');
  refreshAll();
  saveData();
}

// ===========================================
// ESTATÍSTICAS POR MATÉRIA
// ===========================================
function iterateSubjectDays(code, fn) {
  const subject = SUBJECTS[code];
  for (let d = new Date(START); d <= END; d.setDate(d.getDate()+1)) {
    if (inRange(d) && d.getDay() === subject.weekday) {
      fn(new Date(d), getRecord(dateKey(d)));
    }
  }
}

function subjectStats(code) {
  const subject = SUBJECTS[code];
  let presencas = 0, faltasRegistradas = 0;
  iterateSubjectDays(code, (d, r) => {
    if (r.status === 'presente') presencas++;
    if (r.status === 'falta') faltasRegistradas++;
  });
  const contabilizadas = faltasRegistradas * subject.faltasPorAula;
  return { presencas, faltasRegistradas, contabilizadas, limite: subject.limiteFaltas };
}

function renderSubjects() {
  const box = document.getElementById('subjects-list');
  if (!box) return;
  box.innerHTML = '';

  Object.keys(SUBJECTS).forEach(code => {
    const subject = SUBJECTS[code];
    const stats = subjectStats(code);
    const pct = Math.min(100, (stats.contabilizadas / stats.limite) * 100);

    let barClass = '';
    let riskHTML = '';
    if (pct >= 80) {
      barClass = 'danger';
      riskHTML = '<span class="risk-badge">⚠️ ' + Math.round(pct) + '% do limite</span>';
    } else if (pct >= 60) {
      barClass = 'warning';
      riskHTML = '<span class="risk-badge" style="background:var(--amber-50);color:var(--amber-600);animation:none;">⚠️ Atenção</span>';
    }

    const item = document.createElement('div');
    item.className = 'subject-item';
    item.innerHTML =
      '<div class="subject-head"><span class="subject-name">' + subject.nome + '</span>' + riskHTML + '</div>' +
      '<div class="subject-stats">✔ ' + stats.presencas + ' presenças · ✖ ' + stats.faltasRegistradas + ' faltas (' + stats.contabilizadas + '/' + stats.limite + ')</div>' +
      '<div class="mini-progress"><div class="mini-progress-fill ' + barClass + '" style="width:' + pct + '%;"></div></div>';
    box.appendChild(item);
  });
}

// ===========================================
// EVENTOS IMPORTANTES (Sidebar)
// ===========================================
function renderImportantEvents() {
  const box = document.getElementById('important-events');
  if (!box) return;
  const events = [];
  Object.keys(dayData).forEach(key => {
    const r = getRecord(key);
    if (r.type !== 'aula' || r.important) {
      const [y, m, dd] = key.split('-').map(Number);
      const d = new Date(y, m-1, dd);
      if (d < START || d > END) return;
      const subject = SCHEDULE[d.getDay()];
      events.push({ date:d, record:r, subject });
    }
  });
  events.sort((a, b) => a.date - b.date);
  box.innerHTML = '';
  if (events.length === 0) {
    box.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-soft);">Nenhum evento marcado ainda. Abra os detalhes de um dia e escolha um tipo (prova, trabalho, seminário...) para vê-lo aqui.</div>';
    return;
  }
  events.forEach(ev => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line);font-size:0.85rem;';
    row.innerHTML =
      '<span style="font-size:1.1rem;flex-shrink:0;">' + (TYPE_ICON[ev.record.type] || '📌') + '</span>' +
      '<div><strong>' + (ev.subject ? ev.subject.nome : 'Evento') + ' — ' + TYPE_LABEL[ev.record.type] + '</strong>' +
      '<div style="color:var(--ink-soft);font-size:0.75rem;margin-top:2px;">' + formatDateShort(ev.date) + '</div></div>';
    box.appendChild(row);
  });
}

// ===========================================
// RESUMO DA SEMANA (Sidebar)
// ===========================================
function renderWeekSummary() {
  const box = document.getElementById('week-summary');
  if (!box) return;
  box.innerHTML = '';

  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = dateKey(d);
    const subject = SCHEDULE[d.getDay()];
    const rec = getRecord(key);

    const row = document.createElement('div');
    row.className = 'week-day-row';

    let statusIcon = '⏳';
    if (rec.status === 'presente') statusIcon = '✅';
    if (rec.status === 'falta') statusIcon = '❌';

    const isToday = sameDay(d, today);

    if (isHoliday(d)) {
      row.innerHTML = '<span class="week-day-name">' + WEEKDAYS[d.getDay()] + '</span><span class="week-day-classes" style="opacity:0.5;">🏖️ ' + (HOLIDAY_NAMES[key] || 'Feriado') + '</span>';
    } else if (subject) {
      row.innerHTML = '<span class="week-day-name">' + WEEKDAYS[d.getDay()] + '</span>' +
        '<span class="week-day-classes">' + statusIcon + ' ' + subject.code +
        (rec.type !== 'aula' ? ' · ' + TYPE_LABEL[rec.type] : '') +
        (isToday ? ' <strong>(hoje)</strong>' : '') + '</span>';
    } else {
      row.innerHTML = '<span class="week-day-name">' + WEEKDAYS[d.getDay()] + '</span><span class="week-day-classes" style="opacity:0.5;">Sem aula</span>';
    }

    box.appendChild(row);
  }
}

// ===========================================
// DASHBOARD (Cards de resumo)
// ===========================================
function renderDashboard() {
  let totalPresencas = 0, totalFaltasContab = 0, qtdProvas = 0;
  let proximaAula = null, proximaProva = null;

  Object.keys(SUBJECTS).forEach(code => {
    const s = subjectStats(code);
    totalPresencas += s.presencas;
    totalFaltasContab += s.contabilizadas;
  });

  for (let d = new Date(START); d <= END; d.setDate(d.getDate()+1)) {
    if (!inRange(d)) continue;
    const key = dateKey(d);
    const r = getRecord(key);
    if (r.type === 'prova') qtdProvas++;
    const endsAt = classEndDateTime(d);
    if (!proximaAula && endsAt >= NOW) proximaAula = new Date(d);
    if (!proximaProva && r.type === 'prova' && endsAt >= NOW) proximaProva = new Date(d);
  }

  const freqBase = totalPresencas + Object.keys(SUBJECTS).reduce((sum, c) => sum + subjectStats(c).faltasRegistradas, 0);
  const freqPct = freqBase > 0 ? Math.round((totalPresencas / freqBase) * 100) : 100;

  const cards = [
    { icon:'✅', num: totalPresencas,                                       label:'Total de presenças' },
    { icon:'❌', num: totalFaltasContab,                                     label:'Total de faltas (contab.)' },
    { icon:'📝', num: qtdProvas,                                             label:'Provas no período' },
    { icon:'📅', num: proximaAula ? formatDateShort(proximaAula) : '—',      label:'Próxima aula', small:true },
    { icon:'🔔', num: proximaProva ? formatDateShort(proximaProva) : '—',    label:'Próxima prova', small:true },
    { icon:'📊', num: freqPct + '%',                                         label:'Frequência geral' }
  ];

  const box = document.getElementById('dashboard');
  if (!box) return;
  box.innerHTML = '';
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.innerHTML =
      '<span class="stat-label">' + c.label + '</span>' +
      '<span class="stat-value" style="' + (c.small ? 'font-size:1.25rem;' : '') + '">' + c.num + '</span>' +
      '<span class="stat-icon">' + c.icon + '</span>';
    box.appendChild(el);
  });
}

// ===========================================
// GRÁFICO DE BARRAS (Canvas)
// ===========================================
function renderChart() {
  const canvas = document.getElementById('chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Responsividade
  const wrapper = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const w = wrapper.clientWidth;
  const h = 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#a1b8aa' : '#4a6b5c';
  const gridColor = isDark ? '#1f3d2b' : '#e8f0ea';

  const subjects = Object.values(SUBJECTS);
  const padding = { top:30, right:20, bottom:50, left:45 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Coletar dados
  const data = subjects.map(s => {
    const stats = subjectStats(s.code);
    return { code: s.code, nome: s.nome, presencas: stats.presencas, faltas: stats.faltasRegistradas };
  });

  let maxVal = Math.max(10, ...data.map(d => Math.max(d.presencas, d.faltas)));

  // Grid horizontal
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + chartH - (i / 5) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillText(Math.round(maxVal * i / 5), padding.left - 8, y + 4);
  }

  // Barras
  const groupW = chartW / data.length;
  const barW = Math.min(groupW * 0.28, 36);
  const gap = 4;

  data.forEach((d, i) => {
    const cx = padding.left + i * groupW + groupW / 2;

    // Barra de presenças (verde)
    const pH = (d.presencas / maxVal) * chartH;
    const px = cx - barW - gap / 2;
    const py = padding.top + chartH - pH;
    ctx.fillStyle = '#34a853';
    ctx.beginPath();
    if (pH > 0) {
      ctx.roundRect(px, py, barW, pH, [4, 4, 0, 0]);
      ctx.fill();
    }

    // Barra de faltas (âmbar)
    const fH = (d.faltas / maxVal) * chartH;
    const fx = cx + gap / 2;
    const fy = padding.top + chartH - fH;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    if (fH > 0) {
      ctx.roundRect(fx, fy, barW, fH, [4, 4, 0, 0]);
      ctx.fill();
    }

    // Valores nas barras
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (d.presencas > 0) {
      ctx.fillStyle = pH > 16 ? '#fff' : '#34a853';
      ctx.fillText(d.presencas, px + barW/2, pH > 16 ? py + 13 : py - 4);
    }
    if (d.faltas > 0) {
      ctx.fillStyle = fH > 16 ? '#fff' : '#f59e0b';
      ctx.fillText(d.faltas, fx + barW/2, fH > 16 ? fy + 13 : fy - 4);
    }

    // Labels no eixo X
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = textColor;
    ctx.fillText(d.code, cx, h - padding.bottom + 16);
  });

  // Legenda
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#34a853';
  ctx.fillRect(w - 170, 10, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Presenças', w - 155, 19);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(w - 80, 10, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Faltas', w - 65, 19);
}

// ===========================================
// EXPORTAR CSV
// ===========================================
function exportCSV() {
  let csv = 'Data,Dia da Semana,Matéria,Código,Professor,Status,Tipo,Importante,Nota\n';

  for (let d = new Date(START); d <= END; d.setDate(d.getDate()+1)) {
    if (!inRange(d)) continue;
    const key = dateKey(d);
    const rec = getRecord(key);
    const subj = SCHEDULE[d.getDay()];
    if (!subj) continue;

    const row = [
      formatDateShort(d),
      WEEKDAY_LONG[d.getDay()],
      '"' + subj.nome + '"',
      subj.code,
      '"' + subj.professor + '"',
      rec.status,
      TYPE_LABEL[rec.type] || rec.type,
      rec.important ? 'Sim' : 'Não',
      '"' + (rec.note || '').replace(/"/g, '""') + '"'
    ];
    csv += row.join(',') + '\n';
  }

  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendario_faculdade.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 CSV exportado com sucesso!');
}

// ===========================================
// FILTROS
// ===========================================
function applyFilters() {
  const searchEl = document.getElementById('search-input');
  const subjEl   = document.getElementById('filter-subject');
  const statusEl = document.getElementById('filter-status');
  const typeEl   = document.getElementById('filter-type');
  const clearBtn = document.getElementById('filter-clear');

  const search = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const filterSubj = subjEl ? subjEl.value : '';
  const filterStatus = statusEl ? statusEl.value : '';
  const filterType = typeEl ? typeEl.value : '';

  const hasFilter = search || filterSubj || filterStatus || filterType;
  if (clearBtn) clearBtn.style.display = hasFilter ? '' : 'none';

  document.querySelectorAll('.day.in-range').forEach(cell => {
    const day = parseInt(cell.dataset.day, 10);
    const m = parseInt(cell.dataset.month, 10);
    const y = parseInt(cell.dataset.year, 10);
    const d = new Date(y, m, day);
    const key = dateKey(d);
    const rec = getRecord(key);
    const subj = SCHEDULE[d.getDay()];

    let match = true;
    if (filterSubj && (!subj || String(subj.weekday) !== filterSubj)) match = false;
    if (filterStatus && rec.status !== filterStatus) match = false;
    if (filterType && rec.type !== filterType) match = false;
    if (search) {
      const haystack = (subj ? subj.nome + ' ' + subj.code + ' ' + subj.professor : '') + ' ' + (rec.note || '') + ' ' + (TYPE_LABEL[rec.type] || '');
      if (!haystack.toLowerCase().includes(search)) match = false;
    }

    cell.style.opacity = match ? '1' : '0.15';
    cell.style.filter = match ? '' : 'grayscale(1)';
    cell.style.pointerEvents = match ? '' : 'none';
  });
}

function clearFilters() {
  const searchEl = document.getElementById('search-input');
  const subjEl   = document.getElementById('filter-subject');
  const statusEl = document.getElementById('filter-status');
  const typeEl   = document.getElementById('filter-type');
  if (searchEl) searchEl.value = '';
  if (subjEl) subjEl.value = '';
  if (statusEl) statusEl.value = '';
  if (typeEl) typeEl.value = '';
  applyFilters();
}

// ===========================================
// SWATCHES DE COR (Modal)
// ===========================================
function buildSwatches() {
  const wrap = document.getElementById('swatches');
  if (!wrap) return;
  wrap.innerHTML = '';
  // Opção "sem cor"
  const none = document.createElement('div');
  none.className = 'swatch';
  none.style.background = 'var(--paper)';
  none.style.border = '1px solid var(--line)';
  none.textContent = '×';
  none.style.cssText += 'display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:var(--ink-soft);';
  none.dataset.color = '';
  none.title = 'Cor automática';
  wrap.appendChild(none);
  // Cores
  Object.keys(COLORS).forEach(key => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = COLORS[key][600];
    sw.dataset.color = key;
    sw.title = COLORS[key].label;
    wrap.appendChild(sw);
  });
  // Listener
  wrap.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      pendingColor = sw.dataset.color || null;
      wrap.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });
}

// ===========================================
// MATERIAIS (Modal)
// ===========================================
function renderMaterials() {
  if (!activeCode) return;
  const mat = getMaterials(activeCode);

  // Links
  const linksBox = document.getElementById('materials-links');
  if (linksBox) {
    linksBox.innerHTML = '';
    if (mat.links.length === 0) {
      linksBox.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-soft);margin-bottom:4px;">Nenhum link ainda.</div>';
    }
    mat.links.forEach(link => {
      const row = document.createElement('div');
      row.className = 'material-item';
      const a = document.createElement('a');
      a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'material-link';
      a.textContent = '🔗 ' + (link.label || link.url);
      row.appendChild(a);
      const rm = document.createElement('button');
      rm.className = 'material-remove';
      rm.textContent = '×';
      rm.title = 'Remover link';
      rm.addEventListener('click', () => {
        mat.links = mat.links.filter(l => l.id !== link.id);
        renderMaterials();
        saveMaterials();
      });
      row.appendChild(rm);
      linksBox.appendChild(row);
    });
  }

  // Arquivos
  const filesBox = document.getElementById('materials-files');
  if (filesBox) {
    filesBox.innerHTML = '';
    mat.files.forEach(file => {
      const row = document.createElement('div');
      row.className = 'material-item';
      const a = document.createElement('a');
      a.href = file.data; a.download = file.name;
      a.className = 'material-link';
      a.textContent = '📎 ' + file.name + ' (' + formatSize(file.size) + ')';
      row.appendChild(a);
      const rm = document.createElement('button');
      rm.className = 'material-remove';
      rm.textContent = '×';
      rm.title = 'Remover arquivo';
      rm.addEventListener('click', () => {
        mat.files = mat.files.filter(f => f.id !== file.id);
        renderMaterials();
        saveMaterials();
      });
      row.appendChild(rm);
      filesBox.appendChild(row);
    });
  }
}

// ===========================================
// MODAL DE DETALHES
// ===========================================
function setStatusUI(status) {
  pendingStatus = status;
  document.querySelectorAll('.status-opt').forEach(el => {
    const s = el.dataset.status;
    el.classList.toggle('active', s === status);
    el.classList.toggle(s, true); // Adiciona classe do status para CSS
  });
}

function openModal(key, cell, d) {
  activeKey = key; activeCell = cell; activeDate = d;
  const record = getRecord(key);
  pendingColor = record.color || null;
  pendingStatus = record.status;

  const subject = SCHEDULE[d.getDay()];

  // Data
  const dateEl = document.getElementById('modal-date');
  if (dateEl) {
    dateEl.textContent = WEEKDAY_LONG[d.getDay()].charAt(0).toUpperCase() + WEEKDAY_LONG[d.getDay()].slice(1) + ', ' + d.getDate() + ' de ' + MONTH_NAMES[d.getMonth()];
  }

  // Info da matéria
  const classInfo = document.getElementById('modal-class');
  if (classInfo) {
    if (subject) {
      const first = TIME_SLOTS[0].split('-')[0];
      const last = TIME_SLOTS[TIME_SLOTS.length-1].split('-')[1];
      classInfo.innerHTML =
        '<div style="background:var(--mint-50);border:1px solid var(--line);border-radius:10px;padding:12px 14px;">' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line);"><span style="font-size:0.7rem;text-transform:uppercase;color:var(--ink-soft);font-weight:600;">Matéria</span><span style="font-size:0.85rem;font-weight:500;">' + subject.nome + ' (' + subject.code + ')</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line);"><span style="font-size:0.7rem;text-transform:uppercase;color:var(--ink-soft);font-weight:600;">Professor</span><span style="font-size:0.85rem;font-weight:500;">' + subject.professor + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="font-size:0.7rem;text-transform:uppercase;color:var(--ink-soft);font-weight:600;">Horário</span><span style="font-size:0.85rem;font-weight:500;">' + first + ' às ' + last + '</span></div>' +
        '</div>';
    } else {
      classInfo.innerHTML = '';
    }
  }

  // Status, tipo, importante, nota, cor
  setStatusUI(record.status);
  const typeSelect = document.getElementById('type-select');
  if (typeSelect) typeSelect.value = record.type;
  const impCheck = document.getElementById('important-check');
  if (impCheck) impCheck.checked = !!record.important;
  const noteInput = document.getElementById('note-input');
  if (noteInput) noteInput.value = record.note || '';

  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', (s.dataset.color || null) === pendingColor);
  });

  activeCode = subject ? subject.code : null;
  renderMaterials();

  // Abrir com animação
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('active');
  activeKey = null; activeCell = null; activeCode = null; activeDate = null;
}

function saveModalData() {
  if (!activeKey) return;
  const note = (document.getElementById('note-input')?.value || '').trim();
  const type = document.getElementById('type-select')?.value || 'aula';
  const important = document.getElementById('important-check')?.checked || false;

  dayData[activeKey] = {
    status: pendingStatus,
    note, color: pendingColor, type, important,
    confirmedAt: pendingStatus === 'pendente' ? null : new Date().toISOString()
  };

  renderCellContent(activeCell, activeKey, true);
  const y = parseInt(activeCell.dataset.year, 10);
  const m = parseInt(activeCell.dataset.month, 10);
  const day = parseInt(activeCell.dataset.day, 10);
  if (sameDay(new Date(y, m, day), NOW)) activeCell.classList.add('today');

  refreshAll();
  confirmQueue = buildConfirmQueue();
  updatePendingBadge();
  closeModal();
  saveData();
  showToast('✅ Dia salvo com sucesso!');
}

// ===========================================
// CONFIRMAÇÃO DE PRESENÇAS PENDENTES
// ===========================================
function buildConfirmQueue() {
  const queue = [];
  for (let d = new Date(START); d <= END && d <= NOW; d.setDate(d.getDate()+1)) {
    if (!inRange(d)) continue;
    if (classEndDateTime(d) > NOW) continue;
    const key = dateKey(d);
    const record = getRecord(key);
    if (record.type === 'aula' && record.status === 'pendente') {
      queue.push({ key, date: new Date(d) });
    }
  }
  return queue;
}

function updatePendingBadge() {
  const btn = document.getElementById('confirm-open-btn');
  const countEl = document.getElementById('pending-count');
  if (confirmQueue.length > 0) {
    if (btn) btn.style.display = '';
    if (countEl) countEl.textContent = '(' + confirmQueue.length + ')';
  } else {
    if (btn) btn.style.display = 'none';
  }
}

function showNextConfirm() {
  if (confirmQueue.length === 0) {
    const overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.classList.remove('active');
    updatePendingBadge();
    return;
  }
  const item = confirmQueue[0];
  const subject = SCHEDULE[item.date.getDay()];
  const counter = document.getElementById('confirm-counter');
  const q = document.getElementById('confirm-q');
  const sub = document.getElementById('confirm-sub');

  if (counter) counter.textContent = confirmQueue.length + ' pendente' + (confirmQueue.length === 1 ? '' : 's');
  if (q) q.textContent = 'Você compareceu à aula de ' + (subject ? subject.nome : '') + '?';
  if (sub) sub.textContent = formatDateShort(item.date) + ' de 2026';

  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.classList.add('active');
}

function answerConfirm(status) {
  const item = confirmQueue.shift();
  if (item) {
    const record = getRecord(item.key);
    dayData[item.key] = { ...record, status, confirmedAt: new Date().toISOString() };
    rebuildCalendarUI();
    saveData();
  }
  updatePendingBadge();
  showNextConfirm();
}

// ===========================================
// TEMA (Dark/Light)
// ===========================================
function loadTheme() {
  const theme = localStorage.getItem('cal-ui-theme') || 'light';
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('cal-ui-theme', next);
  renderChart(); // Redesenha gráfico com cores do tema
}

// ===========================================
// REFRESH & REBUILD
// ===========================================
function refreshAll() {
  MONTHS_TO_SHOW.forEach(({ y, m }) => updateMonthCount(y, m));
  updateProgress();
  renderSubjects();
  renderImportantEvents();
  renderDashboard();
  renderWeekSummary();
  renderChart();
}

function rebuildCalendarUI() {
  const container = document.getElementById('months');
  if (!container) return;
  container.innerHTML = '';
  MONTHS_TO_SHOW.forEach(({ y, m }) => container.appendChild(buildMonth(y, m)));
  refreshAll();
}

// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {
  // --- Calendário: clique nos dias ---
  const container = document.getElementById('months');
  if (container) {
    container.addEventListener('click', (e) => {
      // Botão de detalhes (⋯)
      const detailBtn = e.target.closest('.day-detail-btn');
      if (detailBtn) {
        const cell = detailBtn.closest('.day.in-range');
        if (!cell) return;
        const day = parseInt(cell.dataset.day, 10), y = parseInt(cell.dataset.year, 10), m = parseInt(cell.dataset.month, 10);
        openModal(dateKey(new Date(y, m, day)), cell, new Date(y, m, day));
        return;
      }
      // Toggle rápido de presença
      const cell = e.target.closest('.day.in-range');
      if (cell) {
        const day = parseInt(cell.dataset.day, 10), y = parseInt(cell.dataset.year, 10), m = parseInt(cell.dataset.month, 10);
        toggleMarkDirect(dateKey(new Date(y, m, day)), cell, y, m);
      }
    });
  }

  // --- Modal: status ---
  document.querySelectorAll('.status-opt').forEach(opt => {
    opt.addEventListener('click', () => setStatusUI(opt.dataset.status));
  });

  // --- Modal: fechar ---
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'overlay') closeModal();
  });

  // --- Modal: salvar ---
  document.getElementById('modal-save')?.addEventListener('click', saveModalData);

  // --- Modal: adicionar link ---
  document.getElementById('add-link-btn')?.addEventListener('click', () => {
    if (!activeCode) return;
    const labelInput = document.getElementById('link-label');
    const urlInput = document.getElementById('link-url');
    let url = urlInput?.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const label = labelInput?.value.trim();
    const mat = getMaterials(activeCode);
    mat.links.push({ id: uid(), label, url });
    if (labelInput) labelInput.value = '';
    if (urlInput) urlInput.value = '';
    renderMaterials();
    saveMaterials();
  });

  // --- Modal: anexar arquivo ---
  document.getElementById('file-input')?.addEventListener('change', (e) => {
    if (!activeCode) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      showToast('⚠️ Arquivo muito grande. Use arquivos de até 1,5 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const mat = getMaterials(activeCode);
      mat.files.push({ id: uid(), name: file.name, type: file.type, size: file.size, data: reader.result });
      renderMaterials();
      e.target.value = '';
      saveMaterials();
    };
    reader.onerror = () => showToast('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  });

  // --- Topbar: tema ---
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // --- Topbar: exportar ---
  document.getElementById('export-btn')?.addEventListener('click', exportCSV);

  // --- Topbar: confirmar presenças ---
  document.getElementById('confirm-open-btn')?.addEventListener('click', () => {
    confirmQueue = buildConfirmQueue();
    updatePendingBadge();
    showNextConfirm();
  });

  // --- Confirmação: sim/não/pular ---
  document.getElementById('confirm-yes')?.addEventListener('click', () => answerConfirm('presente'));
  document.getElementById('confirm-no')?.addEventListener('click', () => answerConfirm('falta'));
  document.getElementById('confirm-skip')?.addEventListener('click', () => {
    confirmQueue.shift();
    const overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.classList.remove('active');
    updatePendingBadge();
  });

  // --- Reset ---
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('reset-overlay');
    if (overlay) overlay.classList.add('active');
  });
  document.getElementById('reset-cancel')?.addEventListener('click', () => {
    document.getElementById('reset-overlay')?.classList.remove('active');
  });
  document.getElementById('reset-confirm')?.addEventListener('click', () => {
    dayData = {};
    rebuildCalendarUI();
    confirmQueue = buildConfirmQueue();
    updatePendingBadge();
    saveData();
    document.getElementById('reset-overlay')?.classList.remove('active');
    showToast('🗑️ Todos os dados foram apagados.');
  });
  document.getElementById('reset-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'reset-overlay') document.getElementById('reset-overlay')?.classList.remove('active');
  });

  // --- Filtros ---
  ['search-input', 'filter-subject', 'filter-status', 'filter-type'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    }
  });
  document.getElementById('filter-clear')?.addEventListener('click', clearFilters);

  // --- Atalhos de teclado ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('confirm-overlay')?.classList.remove('active');
      document.getElementById('reset-overlay')?.classList.remove('active');
    }
  });

  // --- Resize: redesenhar gráfico ---
  window.addEventListener('resize', () => renderChart());
}

// ===========================================
// INICIALIZAÇÃO
// ===========================================
function init() {
  buildSwatches();
  loadData();
  loadMaterials();
  loadTheme();

  // Construir calendário
  const container = document.getElementById('months');
  if (container) {
    MONTHS_TO_SHOW.forEach(({ y, m }) => container.appendChild(buildMonth(y, m)));
  }

  refreshAll();

  // Checar presenças pendentes
  confirmQueue = buildConfirmQueue();
  updatePendingBadge();
  if (confirmQueue.length > 0) {
    setTimeout(() => showNextConfirm(), 800);
  }

  // Listeners
  setupEventListeners();

  // Firebase: carregar dados do Firestore e iniciar listeners
  loadFromFirestore();
  startFirestoreListeners();

  // Animação de entrada
  const page = document.querySelector('.page');
  if (page) page.classList.add('loaded');
}

document.addEventListener('DOMContentLoaded', init);
