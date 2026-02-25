// ====== DATA LAYER ======
const DB = {
  get(key, def) { try { return JSON.parse(localStorage.getItem('gt_'+key)) || def; } catch { return def; } },
  set(key, val) { localStorage.setItem('gt_'+key, JSON.stringify(val)); }
};

let tasks = DB.get('tasks', []);
let goals = DB.get('goals', []);
let blocks = DB.get('blocks', []);
let settings = DB.get('settings', {
  workStart: '06:00', workEnd: '17:00',
  workDays: [1,2,3,4,5],
  categories: [
    { name: 'Startup', color: '#6C5CE7' },
    { name: 'Fitness', color: '#e74c3c' },
    { name: 'Personal', color: '#f39c12' },
    { name: 'Learning', color: '#3498db' }
  ]
});

function save() {
  DB.set('tasks', tasks);
  DB.set('goals', goals);
  DB.set('blocks', blocks);
  DB.set('settings', settings);
}

// ====== UTILS ======
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { return new Date().toISOString().slice(0,10); }
function dayName(d) { return new Date(d+'T12:00').toLocaleDateString('en', {weekday:'short', month:'short', day:'numeric'}); }
function catColor(name) { const c = settings.categories.find(c=>c.name===name); return c ? c.color : '#888'; }
function daysUntil(d) { return Math.ceil((new Date(d+'T23:59') - new Date()) / 86400000); }

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0,10);
}

// ====== NAVIGATION ======
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
      {dashboard:'Dashboard',tasks:'Tasks',goals:'Goals',planner:'Planner',settings:'Settings'}[currentPage];
    refresh();
  });
});

function handleAdd() {
  if (currentPage === 'tasks') openTaskModal();
  else if (currentPage === 'goals') openGoalModal();
  else if (currentPage === 'planner') openBlockModal();
  else openTaskModal();
}

// ====== MODAL ======
function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function catOptions(selected) {
  return settings.categories.map(c =>
    `<option value="${c.name}" ${c.name===selected?'selected':''}>${c.name}</option>`
  ).join('');
}

function goalOptions(selected) {
  return `<option value="">None</option>` +
    goals.map(g => `<option value="${g.id}" ${g.id===selected?'selected':''}>${g.title}</option>`).join('');
}

// ====== TASKS ======
function openTaskModal(task) {
  const t = task || { title:'', category:'Startup', priority:'Medium', estimated:'', deadline:'', notes:'', goalId:'' };
  openModal(task ? 'Edit Task' : 'New Task', `
    <div class="form-group"><label>Title</label><input id="f-title" value="${t.title}"></div>
    <div class="form-group"><label>Category</label><select id="f-cat">${catOptions(t.category)}</select></div>
    <div class="form-group"><label>Priority</label><select id="f-pri">
      ${['High','Medium','Low'].map(p=>`<option ${p===t.priority?'selected':''}>${p}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Estimated Hours</label><input id="f-est" type="number" step="0.5" min="0" value="${t.estimated||''}"></div>
    <div class="form-group"><label>Deadline</label><input id="f-dead" type="date" value="${t.deadline||''}"></div>
    <div class="form-group"><label>Goal</label><select id="f-goal">${goalOptions(t.goalId)}</select></div>
    <div class="form-group"><label>Notes</label><textarea id="f-notes">${t.notes||''}</textarea></div>
    <button class="form-submit" onclick="saveTask('${task?task.id:''}')">${task?'Update':'Create'} Task</button>
  `);
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
  if (id) {
    const t = tasks.find(t=>t.id===id);
    Object.assign(t, data);
  } else {
    tasks.push({ id: uid(), ...data, completed: false, completedDate: null, createdDate: today() });
  }
  save(); closeModal(); refresh();
}

function toggleTask(id) {
  const t = tasks.find(t=>t.id===id);
  t.completed = !t.completed;
  t.completedDate = t.completed ? today() : null;
  save(); refresh();
}

function deleteTask(id) {
  tasks = tasks.filter(t=>t.id!==id);
  save(); refresh();
}

function renderTasks() {
  const cat = document.getElementById('task-filter-cat').value;
  const status = document.getElementById('task-filter-status').value;
  let filtered = tasks.filter(t => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (status === 'active' && t.completed) return false;
    if (status === 'completed' && !t.completed) return false;
    return true;
  });
  // Sort: high priority first, then by deadline
  const priOrder = {High:0, Medium:1, Low:2};
  filtered.sort((a,b) => priOrder[a.priority] - priOrder[b.priority] || (a.deadline||'z').localeCompare(b.deadline||'z'));

  const el = document.getElementById('task-list');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">📋</div>No tasks yet</div>';
    return;
  }
  el.innerHTML = filtered.map(t => `
    <div class="card task-row ${t.completed?'completed':''}">
      <button class="task-check ${t.completed?'checked':''}" onclick="toggleTask('${t.id}')">✓</button>
      <div style="flex:1;min-width:0">
        <div class="card-title">${t.title}</div>
        <div class="card-meta">
          <span class="cat-badge" style="background:${catColor(t.category)}">${t.category}</span>
          <span>${t.priority}</span>
          ${t.estimated ? `<span>${t.estimated}h</span>` : ''}
          ${t.deadline ? `<span>Due ${t.deadline}</span>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button onclick="openTaskModal(tasks.find(t=>t.id==='${t.id}'))">✏️</button>
        <button onclick="deleteTask('${t.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

// ====== GOALS ======
function openGoalModal(goal) {
  const g = goal || { title:'', description:'', targetDate:'', category:'Startup' };
  openModal(goal ? 'Edit Goal' : 'New Goal', `
    <div class="form-group"><label>Title</label><input id="f-gtitle" value="${g.title}"></div>
    <div class="form-group"><label>Category</label><select id="f-gcat">${catOptions(g.category)}</select></div>
    <div class="form-group"><label>Target Date</label><input id="f-gdate" type="date" value="${g.targetDate||''}"></div>
    <div class="form-group"><label>Description</label><textarea id="f-gdesc">${g.description||''}</textarea></div>
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
  if (id) {
    Object.assign(goals.find(g=>g.id===id), data);
  } else {
    goals.push({ id: uid(), ...data, createdDate: today() });
  }
  save(); closeModal(); refresh();
}

function deleteGoal(id) {
  goals = goals.filter(g=>g.id!==id);
  // Unlink tasks
  tasks.forEach(t => { if (t.goalId===id) t.goalId=''; });
  save(); refresh();
}

function renderGoals() {
  const el = document.getElementById('goal-list');
  if (!goals.length) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">🎯</div>No goals yet</div>';
    return;
  }
  el.innerHTML = goals.map(g => {
    const linked = tasks.filter(t=>t.goalId===g.id);
    const done = linked.filter(t=>t.completed).length;
    const pct = linked.length ? Math.round(done/linked.length*100) : 0;
    const remaining = linked.filter(t=>!t.completed);
    return `
      <div class="card">
        <div class="card-actions">
          <button onclick="openGoalModal(goals.find(g=>g.id==='${g.id}'))">✏️</button>
          <button onclick="deleteGoal('${g.id}')">🗑</button>
        </div>
        <div class="card-title">${g.title}</div>
        <div class="card-meta">
          <span class="cat-badge" style="background:${catColor(g.category)}">${g.category}</span>
          ${g.targetDate ? `<span>Target: ${g.targetDate}</span>` : ''}
          <span>${done}/${linked.length} tasks</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${catColor(g.category)}"></div></div>
        <div class="progress-text">${pct}% complete</div>
        ${remaining.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text2)">
          Remaining: ${remaining.map(t=>t.title).join(', ')}
        </div>` : ''}
      </div>
    `;
  }).join('');
}

function renderGoalsDashboard() {
  const el = document.getElementById('dashboard-goals');
  if (!goals.length) { el.innerHTML = '<div style="color:var(--text2);font-size:13px">No goals yet — create one!</div>'; return; }
  el.innerHTML = goals.map(g => {
    const linked = tasks.filter(t=>t.goalId===g.id);
    const done = linked.filter(t=>t.completed).length;
    const pct = linked.length ? Math.round(done/linked.length*100) : 0;
    return `
      <div class="card" style="padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="card-title" style="font-size:14px">${g.title}</span>
          <span style="font-size:13px;font-weight:600;color:${catColor(g.category)}">${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${catColor(g.category)}"></div></div>
      </div>
    `;
  }).join('');
}

// ====== PLANNER ======
function changeDate(delta) {
  const d = new Date(plannerDate+'T12:00');
  d.setDate(d.getDate()+delta);
  plannerDate = d.toISOString().slice(0,10);
  renderPlanner();
}

function isWorkHour(hour) {
  const d = new Date(plannerDate+'T12:00').getDay();
  if (!settings.workDays.includes(d)) return false;
  const start = parseInt(settings.workStart.split(':')[0]);
  const end = parseInt(settings.workEnd.split(':')[0]);
  return hour >= start && hour < end;
}

function openBlockModal(hour) {
  const h = hour !== undefined ? hour : new Date().getHours();
  openModal('New Time Block', `
    <div class="form-group"><label>Start</label><input id="f-bstart" type="time" value="${String(h).padStart(2,'0')}:00"></div>
    <div class="form-group"><label>End</label><input id="f-bend" type="time" value="${String(h+1).padStart(2,'0')}:00"></div>
    <div class="form-group"><label>Category</label><select id="f-bcat">${catOptions('Startup')}</select></div>
    <div class="form-group"><label>Task (optional)</label><select id="f-btask">
      <option value="">None</option>
      ${tasks.filter(t=>!t.completed).map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Label</label><input id="f-blabel" placeholder="What are you doing?"></div>
    <button class="form-submit" onclick="saveBlock()">Add Block</button>
  `);
}

function saveBlock() {
  const b = {
    id: uid(),
    date: plannerDate,
    start: document.getElementById('f-bstart').value,
    end: document.getElementById('f-bend').value,
    category: document.getElementById('f-bcat').value,
    taskId: document.getElementById('f-btask').value,
    label: document.getElementById('f-blabel').value.trim() ||
           document.getElementById('f-bcat').value
  };
  blocks.push(b);
  save(); closeModal(); refresh();
}

function deleteBlock(id) {
  blocks = blocks.filter(b=>b.id!==id);
  save(); refresh();
}

function renderPlanner() {
  document.getElementById('planner-date').textContent = dayName(plannerDate);
  const grid = document.getElementById('planner-grid');
  const dayBlocks = blocks.filter(b=>b.date===plannerDate);
  let html = '';
  for (let h = 5; h <= 23; h++) {
    const hStr = String(h).padStart(2,'0');
    const isWork = isWorkHour(h);
    const hourBlocks = dayBlocks.filter(b => {
      const bh = parseInt(b.start.split(':')[0]);
      return bh === h;
    });
    html += `<div class="planner-hour">
      <div class="planner-time">${h>12?h-12:h}${h>=12?'pm':'am'}</div>
      <div class="planner-slot ${isWork?'work-hour':''}" ${!isWork?`onclick="openBlockModal(${h})"`:''}>
        ${hourBlocks.map(b => `
          <div class="planner-block" style="background:${catColor(b.category)}" onclick="event.stopPropagation();deleteBlock('${b.id}')">
            ${b.label} ${b.start}-${b.end}
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  grid.innerHTML = html;
}

// ====== DASHBOARD ======
function getStreak() {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  while (true) {
    const ds = d.toISOString().slice(0,10);
    const dayBlocks = blocks.filter(b=>b.date===ds);
    const hours = dayBlocks.reduce((sum,b) => {
      const s = parseInt(b.start.split(':')[0]);
      const e = parseInt(b.end.split(':')[0]);
      return sum + (e - s);
    }, 0);
    if (hours >= 2) { streak++; d.setDate(d.getDate()-1); }
    else if (ds === today() && hours < 2) { d.setDate(d.getDate()-1); } // today might not be done yet
    else break;
  }
  return streak;
}

function getProductiveHours(date) {
  return blocks.filter(b=>b.date===date).reduce((sum,b) => {
    const s = parseInt(b.start.split(':')[0]) + parseInt(b.start.split(':')[1]||0)/60;
    const e = parseInt(b.end.split(':')[0]) + parseInt(b.end.split(':')[1]||0)/60;
    return sum + Math.max(0, e - s);
  }, 0);
}

function renderDashboard() {
  const todayTasks = tasks.filter(t=>t.completed && t.completedDate===today()).length;
  const weekStart = startOfWeek();
  const weekTasks = tasks.filter(t=>t.completed && t.completedDate >= weekStart).length;
  const todayHours = getProductiveHours(today());
  const streak = getStreak();

  document.getElementById('stat-today-tasks').textContent = todayTasks;
  document.getElementById('stat-week-tasks').textContent = weekTasks;
  document.getElementById('stat-today-time').textContent = todayHours >= 1 ? `${Math.round(todayHours*10)/10}h` : `${Math.round(todayHours*60)}m`;
  document.getElementById('stat-streak').textContent = streak + '🔥';

  renderGoalsDashboard();

  // Today's schedule
  const todayBlocks = blocks.filter(b=>b.date===today()).sort((a,b)=>a.start.localeCompare(b.start));
  const schedEl = document.getElementById('dashboard-schedule');
  if (!todayBlocks.length) {
    schedEl.innerHTML = '<div style="color:var(--text2);font-size:13px">No blocks planned — hit the planner!</div>';
  } else {
    schedEl.innerHTML = todayBlocks.map(b => `
      <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="width:8px;height:8px;border-radius:50%;background:${catColor(b.category)};flex-shrink:0"></div>
        <span style="font-size:13px;color:var(--text2);width:90px">${b.start} - ${b.end}</span>
        <span style="font-size:14px">${b.label}</span>
      </div>
    `).join('');
  }

  // Deadlines
  const upcoming = tasks.filter(t=>!t.completed && t.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,5);
  const deadEl = document.getElementById('dashboard-deadlines');
  if (!upcoming.length) {
    deadEl.innerHTML = '<div style="color:var(--text2);font-size:13px">No upcoming deadlines</div>';
  } else {
    deadEl.innerHTML = upcoming.map(t => {
      const days = daysUntil(t.deadline);
      const cls = days <= 1 ? 'urgent' : days <= 3 ? 'soon' : '';
      const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
      return `<div class="deadline-item">
        <span style="font-size:14px">${t.title}</span>
        <span class="deadline-days ${cls}">${label}</span>
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

function renderSettings() {
  document.getElementById('work-start').value = settings.workStart;
  document.getElementById('work-end').value = settings.workEnd;

  const dayNames = ['S','M','T','W','T','F','S'];
  document.getElementById('work-days').innerHTML = dayNames.map((d,i) =>
    `<button class="day-btn ${settings.workDays.includes(i)?'active':''}" onclick="toggleWorkDay(${i})">${d}</button>`
  ).join('');

  document.getElementById('category-list').innerHTML = settings.categories.map((c,i) =>
    `<div class="cat-row">
      <div class="cat-swatch" style="background:${c.color}"></div>
      <span class="cat-name">${c.name}</span>
      <button class="cat-del" onclick="removeCategory(${i})">×</button>
    </div>`
  ).join('');

  // Update task filter
  const filterCat = document.getElementById('task-filter-cat');
  const val = filterCat.value;
  filterCat.innerHTML = `<option value="all">All Categories</option>` +
    settings.categories.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  filterCat.value = val;
}

function toggleWorkDay(d) {
  const i = settings.workDays.indexOf(d);
  if (i >= 0) settings.workDays.splice(i,1); else settings.workDays.push(d);
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

function removeCategory(i) {
  settings.categories.splice(i,1);
  save(); renderSettings();
}

function exportData() {
  const data = JSON.stringify({ tasks, goals, blocks, settings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grindtime-backup-' + today() + '.json';
  a.click();
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.tasks) tasks = data.tasks;
      if (data.goals) goals = data.goals;
      if (data.blocks) blocks = data.blocks;
      if (data.settings) settings = data.settings;
      save(); refresh();
      alert('Data imported!');
    } catch { alert('Invalid file'); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('Delete ALL data? This cannot be undone.')) return;
  tasks = []; goals = []; blocks = [];
  save(); refresh();
}

// ====== REFRESH ======
function refresh() {
  renderDashboard();
  renderTasks();
  renderGoals();
  renderPlanner();
  renderSettings();
}

// Init
refresh();
