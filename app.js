// ====== DATA ======
const DB = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('gt_'+k)) || d } catch { return d } },
  set(k, v) { localStorage.setItem('gt_'+k, JSON.stringify(v)) }
};

let tasks = DB.get('tasks', []);
let goals = DB.get('goals', []);
let blocks = DB.get('blocks', []);
let settings = DB.get('settings', {
  workStart: '06:00', workEnd: '17:00', workDays: [1,2,3,4,5],
  categories: [
    { name: 'Startup', color: '#7c6cf0' },
    { name: 'Fitness', color: '#ff6b6b' },
    { name: 'Personal', color: '#ffd43b' },
    { name: 'Learning', color: '#4dabf7' }
  ]
});

const save = () => { DB.set('tasks',tasks); DB.set('goals',goals); DB.set('blocks',blocks); DB.set('settings',settings); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);
const catColor = n => (settings.categories.find(c=>c.name===n)||{}).color || '#666';
const daysUntil = d => Math.ceil((new Date(d+'T23:59') - new Date()) / 86400000);

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay());
  return d.toISOString().slice(0,10);
}

function formatDate(d) {
  const dt = new Date(d+'T12:00');
  const t = new Date(); t.setHours(12,0,0,0);
  const diff = Math.round((dt-t)/86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return dt.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatHour(h) {
  if (h === 0 || h === 12) return (h===0?'12':'12') + (h<12?' AM':' PM');
  return (h>12?h-12:h) + (h>=12?' PM':' AM');
}

// ====== NAV ======
let currentPage = 'dashboard';
let plannerDate = today();

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentPage = btn.dataset.page;
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+currentPage).classList.add('active');
    document.getElementById('page-title').textContent =
      { dashboard:'Dashboard', tasks:'Tasks', goals:'Goals', planner:'Planner', settings:'Settings' }[currentPage];
    document.getElementById('main').scrollTop = 0;
    refresh();
  });
});

function handleAdd() {
  ({ tasks: openTaskModal, goals: openGoalModal, planner: openBlockModal }[currentPage] || openTaskModal)();
}

// ====== MODAL ======
function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

const catOpts = sel => settings.categories.map(c =>
  `<option value="${c.name}" ${c.name===sel?'selected':''}>${c.name}</option>`).join('');
const goalOpts = sel => `<option value="">None</option>` +
  goals.map(g=>`<option value="${g.id}" ${g.id===sel?'selected':''}>${g.title}</option>`).join('');

// ====== TASKS ======
let taskFilter = 'all';
let taskStatus = 'active';

function openTaskModal(task) {
  const t = task || { title:'', category:'Startup', priority:'Medium', estimated:'', deadline:'', notes:'', goalId:'' };
  openModal(task ? 'Edit Task' : 'New Task', `
    <div class="form-group"><label>Title</label><input class="form-input" id="f-title" value="${t.title}" placeholder="What needs doing?"></div>
    <div class="form-row">
      <div class="form-group"><label>Category</label><select class="form-input" id="f-cat">${catOpts(t.category)}</select></div>
      <div class="form-group"><label>Priority</label><select class="form-input" id="f-pri">
        ${['High','Medium','Low'].map(p=>`<option ${p===t.priority?'selected':''}>${p}</option>`).join('')}
      </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Estimated Hours</label><input class="form-input" id="f-est" type="number" step="0.5" min="0" value="${t.estimated||''}" placeholder="e.g. 2"></div>
      <div class="form-group"><label>Deadline</label><input class="form-input" id="f-dead" type="date" value="${t.deadline||''}"></div>
    </div>
    <div class="form-group"><label>Goal</label><select class="form-input" id="f-goal">${goalOpts(t.goalId)}</select></div>
    <div class="form-group"><label>Notes</label><textarea class="form-input" id="f-notes" placeholder="Optional details...">${t.notes||''}</textarea></div>
    <button class="form-submit" onclick="saveTask('${task?task.id:''}')">${task?'Update':'Create'} Task</button>
  `);
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}

function saveTask(id) {
  const data = {
    title: document.getElementById('f-title').value.trim(),
    category: document.getElementById('f-cat').value,
    priority: document.getElementById('f-pri').value,
    estimated: parseFloat(document.getElementById('f-est').value) || 0,
    deadline: document.getElementById('f-dead').value,
    goalId: document.getElementById('f-goal').value,
    notes: document.getElementById('f-notes').value.trim()
  };
  if (!data.title) return;
  if (id) { Object.assign(tasks.find(t=>t.id===id), data); }
  else { tasks.push({ id: uid(), ...data, completed: false, completedDate: null, createdDate: today() }); }
  save(); closeModal(); refresh();
}

function toggleTask(id) {
  const t = tasks.find(t=>t.id===id);
  const el = document.querySelector(`[data-task="${id}"]`);
  if (!t.completed && el) {
    el.classList.add('completing');
    setTimeout(() => {
      t.completed = true; t.completedDate = today();
      save(); refresh();
    }, 500);
  } else {
    t.completed = !t.completed;
    t.completedDate = t.completed ? today() : null;
    save(); refresh();
  }
}

function deleteTask(id) { tasks = tasks.filter(t=>t.id!==id); save(); refresh(); }

function renderTasks() {
  // Render filter chips
  const chipRow = document.getElementById('task-chips');
  const cats = ['all', ...settings.categories.map(c=>c.name)];
  chipRow.innerHTML = cats.map(c =>
    `<button class="chip ${taskFilter===c?'active':''}" onclick="taskFilter='${c}';renderTasks()">${c==='all'?'All':c}</button>`
  ).join('') +
    `<button class="chip ${taskStatus==='active'?'active':''}" onclick="taskStatus=taskStatus==='active'?'completed':'active';renderTasks()" style="margin-left:auto">${taskStatus==='active'?'Active':'Done'}</button>`;

  let filtered = tasks.filter(t => {
    if (taskFilter !== 'all' && t.category !== taskFilter) return false;
    if (taskStatus === 'active' && t.completed) return false;
    if (taskStatus === 'completed' && !t.completed) return false;
    return true;
  });

  const priOrd = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a,b) => priOrd[a.priority] - priOrd[b.priority] || (a.deadline||'z').localeCompare(b.deadline||'z'));

  const el = document.getElementById('task-list');
  if (!filtered.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${taskStatus==='completed'?'🎉':'📋'}</div><div class="empty-text">${taskStatus==='completed'?'No completed tasks yet':'No tasks — tap + to add one'}</div></div>`;
    return;
  }

  // Group by priority
  const groups = {};
  filtered.forEach(t => {
    const g = t.completed ? 'Completed' : t.priority;
    (groups[g] = groups[g] || []).push(t);
  });

  el.innerHTML = Object.entries(groups).map(([group, items]) => `
    <div class="task-group">
      <div class="task-group-title">${group} <span class="task-group-count">${items.length}</span></div>
      ${items.map(t => {
        const overdue = t.deadline && !t.completed && daysUntil(t.deadline) < 0;
        return `<div class="task-item ${t.completed?'done':''}" data-task="${t.id}">
          <button class="check-circle ${t.completed?'checked':''}" onclick="toggleTask('${t.id}')"></button>
          <div class="task-content" onclick="openTaskModal(tasks.find(x=>x.id==='${t.id}'))">
            <div class="task-title">${t.title}</div>
            <div class="task-detail">
              <span class="task-tag" style="background:${catColor(t.category)}">${t.category}</span>
              ${t.deadline ? `<span class="task-due ${overdue?'overdue':''}">${overdue?'Overdue':formatDate(t.deadline)}</span>` : ''}
              ${t.estimated ? `<span class="task-est">${t.estimated}h</span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-action-btn" onclick="deleteTask('${t.id}')">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ====== GOALS ======
function openGoalModal(goal) {
  const g = goal || { title:'', description:'', targetDate:'', category:'Startup' };
  openModal(goal ? 'Edit Goal' : 'New Goal', `
    <div class="form-group"><label>Title</label><input class="form-input" id="f-gtitle" value="${g.title}" placeholder="What's the goal?"></div>
    <div class="form-row">
      <div class="form-group"><label>Category</label><select class="form-input" id="f-gcat">${catOpts(g.category)}</select></div>
      <div class="form-group"><label>Target Date</label><input class="form-input" id="f-gdate" type="date" value="${g.targetDate||''}"></div>
    </div>
    <div class="form-group"><label>Description</label><textarea class="form-input" id="f-gdesc" placeholder="What does success look like?">${g.description||''}</textarea></div>
    <button class="form-submit" onclick="saveGoal('${goal?goal.id:''}')">${goal?'Update':'Create'} Goal</button>
  `);
}

function saveGoal(id) {
  const data = {
    title: document.getElementById('f-gtitle').value.trim(),
    category: document.getElementById('f-gcat').value,
    targetDate: document.getElementById('f-gdate').value,
    description: document.getElementById('f-gdesc').value.trim()
  };
  if (!data.title) return;
  if (id) { Object.assign(goals.find(g=>g.id===id), data); }
  else { goals.push({ id: uid(), ...data, createdDate: today() }); }
  save(); closeModal(); refresh();
}

function deleteGoal(id) {
  goals = goals.filter(g=>g.id!==id);
  tasks.forEach(t => { if(t.goalId===id) t.goalId=''; });
  save(); refresh();
}

function renderGoals() {
  const el = document.getElementById('goal-list');
  if (!goals.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🎯</div><div class="empty-text">No goals yet — set your first target</div></div>';
    return;
  }
  el.innerHTML = goals.map(g => {
    const linked = tasks.filter(t=>t.goalId===g.id);
    const done = linked.filter(t=>t.completed).length;
    const pct = linked.length ? Math.round(done/linked.length*100) : 0;
    const remaining = linked.filter(t=>!t.completed);
    return `
      <div class="goal-card" onclick="openGoalModal(goals.find(x=>x.id==='${g.id}'))">
        <div class="goal-header">
          <div>
            <div class="goal-title">${g.title}</div>
            <div class="goal-meta">
              <span class="task-tag" style="background:${catColor(g.category)}">${g.category}</span>
              ${g.targetDate ? `<span>${formatDate(g.targetDate)}</span>` : ''}
              <span>${done}/${linked.length} tasks</span>
            </div>
          </div>
          <div class="goal-pct" style="color:${catColor(g.category)}">${pct}%</div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${catColor(g.category)}"></div></div>
        ${remaining.length ? `<div class="goal-remaining">
          <div class="goal-remaining-title">Remaining</div>
          ${remaining.slice(0,4).map(t=>`<div class="goal-remaining-item">${t.title}</div>`).join('')}
          ${remaining.length>4?`<div class="goal-remaining-item" style="color:var(--text2)">+${remaining.length-4} more</div>`:''}
        </div>` : ''}
        <button class="task-action-btn" style="position:absolute;top:16px;right:16px" onclick="event.stopPropagation();deleteGoal('${g.id}')">✕</button>
      </div>`;
  }).join('');
}

// ====== PLANNER ======
function changeDate(d) {
  const dt = new Date(plannerDate+'T12:00');
  dt.setDate(dt.getDate()+d);
  plannerDate = dt.toISOString().slice(0,10);
  renderPlanner();
}

function goToday() { plannerDate = today(); renderPlanner(); }

function isWorkHour(h) {
  const d = new Date(plannerDate+'T12:00').getDay();
  if (!settings.workDays.includes(d)) return false;
  return h >= parseInt(settings.workStart) && h < parseInt(settings.workEnd);
}

function openBlockModal(hour) {
  const h = hour !== undefined ? hour : new Date().getHours();
  openModal('Add Time Block', `
    <div class="form-row">
      <div class="form-group"><label>Start</label><input class="form-input" id="f-bstart" type="time" value="${String(h).padStart(2,'0')}:00"></div>
      <div class="form-group"><label>End</label><input class="form-input" id="f-bend" type="time" value="${String(Math.min(h+1,23)).padStart(2,'0')}:00"></div>
    </div>
    <div class="form-group"><label>Category</label><select class="form-input" id="f-bcat">${catOpts('Startup')}</select></div>
    <div class="form-group"><label>Task</label><select class="form-input" id="f-btask">
      <option value="">No specific task</option>
      ${tasks.filter(t=>!t.completed).map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Label</label><input class="form-input" id="f-blabel" placeholder="What are you working on?"></div>
    <button class="form-submit" onclick="saveBlock()">Add Block</button>
  `);
}

function saveBlock() {
  const b = {
    id: uid(), date: plannerDate,
    start: document.getElementById('f-bstart').value,
    end: document.getElementById('f-bend').value,
    category: document.getElementById('f-bcat').value,
    taskId: document.getElementById('f-btask').value,
    label: document.getElementById('f-blabel').value.trim() || document.getElementById('f-bcat').value
  };
  blocks.push(b); save(); closeModal(); refresh();
}

function deleteBlock(id) { blocks = blocks.filter(b=>b.id!==id); save(); refresh(); }

function renderPlanner() {
  const nav = document.getElementById('planner-nav');
  const dt = new Date(plannerDate+'T12:00');
  const isToday = plannerDate === today();
  nav.innerHTML = `
    <button class="nav-arrow" onclick="changeDate(-1)">‹</button>
    <div style="text-align:center">
      <div class="date-text">${dt.toLocaleDateString('en',{weekday:'long'})}</div>
      <div class="date-sub">${dt.toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}</div>
    </div>
    <button class="nav-arrow" onclick="changeDate(1)">›</button>
  `;

  const todayBtn = document.getElementById('planner-today');
  todayBtn.style.display = isToday ? 'none' : 'block';

  const grid = document.getElementById('planner-grid');
  const dayBlocks = blocks.filter(b=>b.date===plannerDate);
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes()/60;

  let html = '';
  for (let h = 5; h <= 23; h++) {
    const work = isWorkHour(h);
    const hBlocks = dayBlocks.filter(b => parseInt(b.start) === h);

    html += `<div class="time-row">
      <div class="time-label">${formatHour(h)}</div>
      <div class="time-slot ${work?'work':''}" ${!work?`onclick="openBlockModal(${h})"`:''}>
        ${work ? '<span class="work-label">Work</span>' : ''}
        ${hBlocks.map(b => `
          <div class="time-block" style="background:${catColor(b.category)}" onclick="event.stopPropagation();deleteBlock('${b.id}')">
            ${b.label}
            <div class="block-time">${b.start} – ${b.end}</div>
          </div>
        `).join('')}
      </div>
    </div>`;

    // Now indicator
    if (isToday && h === Math.floor(nowHour)) {
      const pct = (nowHour - h) * 100;
      html += `<div class="now-line" style="top:${pct}%;margin-top:-1px;position:relative;"></div>`;
    }
  }
  grid.innerHTML = html;
}

// ====== DASHBOARD ======
function getProductiveHours(date) {
  return blocks.filter(b=>b.date===date).reduce((sum,b) => {
    const s = parseInt(b.start.split(':')[0]) + parseInt(b.start.split(':')[1]||0)/60;
    const e = parseInt(b.end.split(':')[0]) + parseInt(b.end.split(':')[1]||0)/60;
    return sum + Math.max(0, e-s);
  }, 0);
}

function getStreak() {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  // Don't count today unless they already have 2+ hours
  if (getProductiveHours(today()) < 2) d.setDate(d.getDate()-1);
  while (true) {
    const ds = d.toISOString().slice(0,10);
    if (getProductiveHours(ds) >= 2) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

function renderHeatmap() {
  const el = document.getElementById('heatmap');
  const d = new Date(); d.setHours(12,0,0,0);
  // Show last 5 weeks (35 days)
  d.setDate(d.getDate() - 34);
  // Align to Sunday
  d.setDate(d.getDate() - d.getDay());

  let days = [];
  for (let i = 0; i < 35; i++) {
    const ds = d.toISOString().slice(0,10);
    const hrs = getProductiveHours(ds);
    const completed = tasks.filter(t=>t.completed && t.completedDate===ds).length;
    days.push({ date: ds, hrs, completed, day: d.getDate() });
    d.setDate(d.getDate()+1);
  }

  const maxHrs = Math.max(4, ...days.map(d=>d.hrs));

  el.innerHTML = `
    <div class="heatmap-labels">${['S','M','T','W','T','F','S'].map(d=>`<span>${d}</span>`).join('')}</div>
    <div class="heatmap-grid">
      ${days.map(d => {
        const intensity = d.hrs > 0 ? 0.2 + (d.hrs/maxHrs)*0.8 : 0;
        const bg = d.date > today() ? 'var(--surface)' :
                   intensity > 0 ? `rgba(124,108,240,${intensity})` : 'var(--surface2)';
        return `<div class="heatmap-day" style="background:${bg}" title="${d.date}: ${d.hrs.toFixed(1)}h, ${d.completed} tasks">
          <span class="day-num">${d.day}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderDashboard() {
  const todayDone = tasks.filter(t=>t.completed && t.completedDate===today()).length;
  const weekDone = tasks.filter(t=>t.completed && t.completedDate>=startOfWeek()).length;
  const hrs = getProductiveHours(today());
  const streak = getStreak();

  document.getElementById('stat-tasks').textContent = todayDone;
  document.getElementById('stat-time').textContent = hrs >= 1 ? `${Math.round(hrs*10)/10}h` : `${Math.round(hrs*60)}m`;
  document.getElementById('stat-week').textContent = weekDone;
  document.getElementById('stat-streak').textContent = streak;

  renderHeatmap();

  // Goals
  const goalsEl = document.getElementById('dash-goals');
  if (!goals.length) {
    goalsEl.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:8px 0">No goals yet</div>';
  } else {
    goalsEl.innerHTML = goals.map(g => {
      const linked = tasks.filter(t=>t.goalId===g.id);
      const done = linked.filter(t=>t.completed).length;
      const pct = linked.length ? Math.round(done/linked.length*100) : 0;
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:14px;font-weight:500">${g.title}</span>
          <span style="font-size:13px;font-weight:700;color:${catColor(g.category)}">${pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${catColor(g.category)}"></div></div>
      </div>`;
    }).join('');
  }

  // Schedule
  const schedEl = document.getElementById('dash-schedule');
  const todayBlocks = blocks.filter(b=>b.date===today()).sort((a,b)=>a.start.localeCompare(b.start));
  if (!todayBlocks.length) {
    schedEl.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:8px 0">Nothing planned — open the planner</div>';
  } else {
    schedEl.innerHTML = todayBlocks.map(b => `
      <div class="schedule-item">
        <div class="schedule-dot" style="background:${catColor(b.category)}"></div>
        <span class="schedule-time">${b.start} – ${b.end}</span>
        <span class="schedule-label">${b.label}</span>
      </div>
    `).join('');
  }

  // Deadlines
  const deadEl = document.getElementById('dash-deadlines');
  const upcoming = tasks.filter(t=>!t.completed && t.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,5);
  if (!upcoming.length) {
    deadEl.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:8px 0">No upcoming deadlines</div>';
  } else {
    deadEl.innerHTML = upcoming.map(t => {
      const d = daysUntil(t.deadline);
      const cls = d <= 1 ? 'urgent' : d <= 3 ? 'soon' : 'normal';
      const label = d < 0 ? 'Overdue' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`;
      return `<div class="deadline-row">
        <span class="deadline-name">${t.title}</span>
        <span class="deadline-tag ${cls}">${label}</span>
      </div>`;
    }).join('');
  }
}

// ====== SETTINGS ======
function saveSettings() {
  settings.workStart = document.getElementById('work-start').value;
  settings.workEnd = document.getElementById('work-end').value;
  save();
}

function toggleWorkDay(d) {
  const i = settings.workDays.indexOf(d);
  if (i>=0) settings.workDays.splice(i,1); else settings.workDays.push(d);
  save(); renderSettings();
}

function addCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  const color = document.getElementById('new-cat-color').value;
  if (!name) return;
  settings.categories.push({ name, color });
  document.getElementById('new-cat-name').value = '';
  save(); renderSettings();
}

function removeCategory(i) { settings.categories.splice(i,1); save(); renderSettings(); }

function exportData() {
  const data = JSON.stringify({ tasks, goals, blocks, settings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'grindtime-'+today()+'.json'; a.click();
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.tasks) tasks=d.tasks; if (d.goals) goals=d.goals;
      if (d.blocks) blocks=d.blocks; if (d.settings) settings=d.settings;
      save(); refresh(); alert('Imported!');
    } catch { alert('Invalid file'); }
  };
  r.readAsText(file);
}

function clearAllData() {
  if (!confirm('Delete ALL data? Cannot be undone.')) return;
  tasks=[]; goals=[]; blocks=[]; save(); refresh();
}

function renderSettings() {
  document.getElementById('work-start').value = settings.workStart;
  document.getElementById('work-end').value = settings.workEnd;

  const dayNames = ['S','M','T','W','T','F','S'];
  document.getElementById('work-days').innerHTML = dayNames.map((d,i) =>
    `<button class="day-pill ${settings.workDays.includes(i)?'active':''}" onclick="toggleWorkDay(${i})">${d}</button>`
  ).join('');

  document.getElementById('cat-list').innerHTML = settings.categories.map((c,i) =>
    `<div class="cat-item"><div class="cat-dot" style="background:${c.color}"></div><span>${c.name}</span><button class="cat-del" onclick="removeCategory(${i})">✕</button></div>`
  ).join('');
}

// ====== COMMAND BAR & VOICE ======
let recognition = null;
let isListening = false;
let pendingActions = null;

// Speech recognition setup
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const input = document.getElementById('command-input');
    if (final) { input.value = final; processCommand(); }
    else { input.value = interim; }
  };
  recognition.onend = () => { isListening = false; updateMicUI(); };
  recognition.onerror = () => { isListening = false; updateMicUI(); };
}

function toggleMic() {
  if (!recognition) { alert('Voice input not supported in this browser. Try Chrome.'); return; }
  if (isListening) { recognition.stop(); }
  else { recognition.start(); isListening = true; }
  updateMicUI();
}

function updateMicUI() {
  const btn = document.getElementById('mic-btn');
  const icon = document.getElementById('mic-icon');
  if (isListening) { btn.classList.add('listening'); icon.textContent = '⏺'; }
  else { btn.classList.remove('listening'); icon.textContent = '🎙️'; }
}

// Enter key triggers command
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('command-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') processCommand();
  });
});

// ====== SMART PARSER ======
function processCommand() {
  const input = document.getElementById('command-input').value.trim();
  if (!input) return;

  const parsed = parseNaturalLanguage(input);
  if (!parsed.task && !parsed.block) {
    showPreviewError("I couldn't understand that. Try something like: \"2 hours today on business plan for startup goal\"");
    return;
  }
  pendingActions = parsed;
  showPreview(parsed);
}

function parseNaturalLanguage(text) {
  const lower = text.toLowerCase();
  const result = { task: null, block: null, goalLink: null, raw: text };

  // ---- Extract duration ----
  let duration = null;
  const durMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/) ||
                   lower.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (durMatch) {
    duration = parseFloat(durMatch[1]);
    if (lower.match(/(\d+)\s*(?:minutes?|mins?|m)\b/)) duration = duration / 60;
  }

  // ---- Extract date ----
  let date = today();
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate()+1); date = d.toISOString().slice(0,10);
  } else if (/\btonight\b/.test(lower) || /\bthis evening\b/.test(lower)) {
    date = today();
  }
  // Match "on monday", "on tuesday", etc
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayMatch = lower.match(/\b(?:on|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dayMatch) {
    const target = dayNames.indexOf(dayMatch[1]);
    const d = new Date(); d.setHours(12,0,0,0);
    while (d.getDay() !== target) d.setDate(d.getDate()+1);
    date = d.toISOString().slice(0,10);
  }

  // ---- Extract "working until X" / "off at X" / "work ends at X" ----
  let workEnd = null;
  const workMatch = lower.match(/(?:working until|work(?:ing)?\s+(?:ends?|finish(?:es)?)\s+(?:at)?|off at|done at|finish(?:ing)? at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (workMatch) {
    let h = parseInt(workMatch[1]);
    const min = workMatch[2] || '00';
    const ampm = workMatch[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (!ampm && h < 7) h += 12; // assume PM for low numbers
    workEnd = `${String(h).padStart(2,'0')}:${min}`;
  }

  // ---- Extract specific time "at 5pm", "from 3 to 5" ----
  let startTime = null, endTime = null;
  const fromTo = lower.match(/from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (fromTo) {
    let sh = parseInt(fromTo[1]), eh = parseInt(fromTo[4]);
    if (fromTo[3]==='pm' && sh<12) sh+=12; if (fromTo[3]==='am' && sh===12) sh=0;
    if (fromTo[6]==='pm' && eh<12) eh+=12; if (fromTo[6]==='am' && eh===12) eh=0;
    if (!fromTo[3] && !fromTo[6]) { if(sh<7) sh+=12; if(eh<7) eh+=12; if(eh<=sh) eh+=12; }
    startTime = `${String(sh).padStart(2,'0')}:${fromTo[2]||'00'}`;
    endTime = `${String(eh).padStart(2,'0')}:${fromTo[5]||'00'}`;
  } else if (lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) && duration) {
    const atMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let h = parseInt(atMatch[1]);
    if (atMatch[3]==='pm' && h<12) h+=12; if (atMatch[3]==='am' && h===12) h=0;
    if (!atMatch[3] && h<7) h+=12;
    startTime = `${String(h).padStart(2,'0')}:${atMatch[2]||'00'}`;
    const eh = h + Math.ceil(duration);
    endTime = `${String(eh).padStart(2,'0')}:00`;
  }

  // If we know work ends and have duration but no start time, schedule right after work
  if (workEnd && duration && !startTime) {
    const wh = parseInt(workEnd.split(':')[0]);
    const wm = parseInt(workEnd.split(':')[1]);
    startTime = workEnd;
    const endH = wh + Math.floor(duration);
    const endM = wm + Math.round((duration % 1) * 60);
    endTime = `${String(endH + Math.floor(endM/60)).padStart(2,'0')}:${String(endM%60).padStart(2,'0')}`;
  }

  // ---- Extract goal ----
  let goalId = null;
  const goalPatterns = [
    /(?:part of|for|under|towards?|linked? to)\s+(?:the\s+)?(?:goal\s+)?["""]?(.+?)["""]?\s*(?:goal)?$/i,
    /(?:goal|for)\s*:?\s*["""]?(.+?)["""]?\s*$/i
  ];
  for (const pat of goalPatterns) {
    const m = lower.match(pat);
    if (m) {
      const gName = m[1].trim().replace(/\.$/, '');
      // Fuzzy match existing goals
      const found = goals.find(g => g.title.toLowerCase().includes(gName) || gName.includes(g.title.toLowerCase()));
      if (found) { goalId = found.id; }
      else {
        // Check if it matches a category too — might be a new goal
        goalId = '__new__:' + gName;
      }
      break;
    }
  }

  // ---- Extract category ----
  let category = 'Startup'; // default
  for (const cat of settings.categories) {
    if (lower.includes(cat.name.toLowerCase())) { category = cat.name; break; }
  }

  // ---- Extract priority ----
  let priority = 'Medium';
  if (/\b(urgent|critical|asap|important|high priority)\b/.test(lower)) priority = 'High';
  if (/\b(low priority|whenever|no rush|eventually)\b/.test(lower)) priority = 'Low';

  // ---- Extract task title ----
  // Remove known patterns to get the core task description
  let title = text
    .replace(/\d+(\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, '')
    .replace(/\b(today|tomorrow|tonight|this evening)\b/gi, '')
    .replace(/\b(on|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/working until\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/(?:work(?:ing)?\s+(?:ends?|finishes?)\s+(?:at)?|off at|done at|finish(?:ing)? at)\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/from\s+\d{1,2}(:\d{2})?\s*(am|pm)?\s*(?:to|until|-)\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/at\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/(?:part of|for|under|towards?|linked? to)\s+(?:the\s+)?(?:goal\s+)?[""]?.+?[""]?\s*(?:goal)?\s*$/gi, '')
    .replace(/\b(urgent|critical|asap|important|high priority|low priority|whenever|no rush|eventually)\b/gi, '')
    .replace(/\b(i am going to need|i need|i want to|i have to|i've got to|i gotta|gonna|going to|need to|want to|have to)\b/gi, '')
    .replace(/\b(and i'm|and i am|and)\b/gi, '')
    .replace(/\b(it is|it's|that is|that's)\b/gi, '')
    .replace(/\b(to|for)\s*$/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();

  // Capitalize first letter
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  if (!title || title.length < 2) title = 'Untitled task';

  // ---- Build task ----
  result.task = {
    title, category, priority,
    estimated: duration || 0,
    deadline: date,
    goalId: goalId && !goalId.startsWith('__new__') ? goalId : '',
    notes: ''
  };

  // ---- Build time block if we have timing info ----
  if (startTime && endTime) {
    result.block = {
      date, start: startTime, end: endTime,
      category, label: title
    };
  } else if (duration && !startTime) {
    // We have duration but no specific time — suggest a block but need to pick a slot
    const now = new Date();
    let nextHour = now.getHours() + 1;
    // If work end is known, start after work
    if (workEnd) nextHour = parseInt(workEnd);
    result.block = {
      date,
      start: `${String(nextHour).padStart(2,'0')}:00`,
      end: `${String(nextHour + Math.ceil(duration)).padStart(2,'0')}:00`,
      category, label: title
    };
  }

  // ---- New goal creation ----
  if (goalId && goalId.startsWith('__new__')) {
    const gName = goalId.replace('__new__:', '');
    result.newGoal = {
      title: gName.charAt(0).toUpperCase() + gName.slice(1),
      category, targetDate: '', description: ''
    };
  }

  return result;
}

function showPreview(parsed) {
  const preview = document.getElementById('command-preview');
  let html = '';

  if (parsed.newGoal) {
    html += `<div class="preview-card">
      <div class="preview-type">📌 New Goal</div>
      <div class="preview-title">${parsed.newGoal.title}</div>
      <div class="preview-details">Category: ${parsed.newGoal.category}</div>
    </div>`;
  }

  if (parsed.task) {
    const goalName = parsed.task.goalId ? (goals.find(g=>g.id===parsed.task.goalId)||{}).title || '' : parsed.newGoal ? parsed.newGoal.title : '';
    html += `<div class="preview-card">
      <div class="preview-type">✅ Task</div>
      <div class="preview-title">${parsed.task.title}</div>
      <div class="preview-details">
        ${parsed.task.category} · ${parsed.task.priority} priority
        ${parsed.task.estimated ? ` · ${parsed.task.estimated}h` : ''}
        ${parsed.task.deadline ? ` · ${formatDate(parsed.task.deadline)}` : ''}
        ${goalName ? ` · Goal: ${goalName}` : ''}
      </div>
    </div>`;
  }

  if (parsed.block) {
    html += `<div class="preview-card">
      <div class="preview-type">📅 Time Block</div>
      <div class="preview-title">${parsed.block.label}</div>
      <div class="preview-details">${formatDate(parsed.block.date)} · ${parsed.block.start} – ${parsed.block.end} · ${parsed.block.category}</div>
    </div>`;
  }

  html += `<div class="preview-actions">
    <button class="preview-cancel" onclick="cancelPreview()">Cancel</button>
    <button class="preview-confirm" onclick="confirmCommand()">Confirm ✓</button>
  </div>`;

  preview.innerHTML = html;
  preview.classList.add('visible');
}

function showPreviewError(msg) {
  const preview = document.getElementById('command-preview');
  preview.innerHTML = `<div class="preview-card" style="border-color:var(--danger)">
    <div class="preview-details" style="color:var(--danger)">${msg}</div>
  </div>`;
  preview.classList.add('visible');
  setTimeout(() => preview.classList.remove('visible'), 4000);
}

function cancelPreview() {
  pendingActions = null;
  document.getElementById('command-preview').classList.remove('visible');
  document.getElementById('command-input').value = '';
}

function confirmCommand() {
  if (!pendingActions) return;
  const p = pendingActions;

  // Create goal if needed
  let newGoalId = null;
  if (p.newGoal) {
    newGoalId = uid();
    goals.push({ id: newGoalId, ...p.newGoal, createdDate: today() });
  }

  // Create task
  if (p.task) {
    if (newGoalId && !p.task.goalId) p.task.goalId = newGoalId;
    tasks.push({ id: uid(), ...p.task, completed: false, completedDate: null, createdDate: today() });
  }

  // Create time block
  if (p.block) {
    blocks.push({ id: uid(), ...p.block, taskId: '' });
  }

  save();
  pendingActions = null;
  document.getElementById('command-preview').classList.remove('visible');
  document.getElementById('command-input').value = '';

  // Quick success flash
  const bar = document.querySelector('.command-input-wrap');
  bar.style.borderColor = 'var(--success)';
  setTimeout(() => bar.style.borderColor = '', 1000);

  refresh();
}

// ====== REFRESH ======
function refresh() {
  renderDashboard(); renderTasks(); renderGoals(); renderPlanner(); renderSettings();
}

refresh();
