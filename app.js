/* ============================================================
   app.js – pages: dashboard, employees, departments + theme + particles
   ============================================================ */
'use strict';

// ===== 1. Small UI helpers =====
function toast(msg) {                       // little message at bottom-right
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal()    { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); }); // click outside = close
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ===== 2. Routing: URL hash decides which page is shown =====
const TITLES = { dashboard: 'Dashboard', employees: 'Employees', departments: 'Departments', logins: 'Login history' };
let forcedDept = null; // set when you click a department card

function route() {
  if (!me) return;
  const wanted = location.hash.replace('#/', '');
  let page = TITLES[wanted] ? wanted : 'dashboard';
  if (page === 'logins' && !canEdit()) page = 'dashboard';   // only Admin/HR may see login history
  $$('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'view-' + page));
  $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.route === page));
  $('#pageTitle').textContent = TITLES[page];
  closeMenu();
  ({ dashboard: renderDashboard, employees: renderTable, departments: renderDepartments, logins: renderLogins })[page]();
  const view = $('#view-' + page);
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); // replay fade-in
  afterRender(view);
}
window.addEventListener('hashchange', route);

// Runs on page load and after login/logout: show login screen OR the app
function init() {
  me = session.get();
  $('#auth').classList.toggle('hidden', !!me);
  $('#app').classList.toggle('hidden', !me);
  if (!me) return;
  $('#userName').textContent = me.name;
  $('#userRole').textContent = me.role;
  $('#userAvatar').textContent = me.name[0].toUpperCase();
  $('#addBtn').classList.toggle('hidden', !canEdit());
  $('#navLogins').classList.toggle('hidden', !canEdit());
  route();
}

// After any page draws: give items their animation order, then count numbers up
function afterRender(view) {
  $$('.quick,.card,.panel,.dept-card,tbody tr', view).forEach((el, i) => el.style.setProperty('--i', i));
  countUp();
}

// ===== 3. Dashboard =====
let dashDept = ''; // department chosen in the dashboard filter ('' = everyone)
function renderDashboard() {
  const everyone = emps();
  const e = dashDept ? everyone.filter(x => x.dept === dashDept) : everyone;   // people shown on the dashboard
  const allDepts = [...new Set(everyone.map(x => x.dept))].sort();
  const depts = [...new Set(e.map(x => x.dept))];
  const today = new Date(), cutoff = new Date(); cutoff.setDate(today.getDate() - 90);
  const working = e.filter(x => x.status !== 'Inactive');
  const payroll = working.reduce((sum, x) => sum + x.salary, 0);
  const avgTenure = e.length ? e.reduce((s, x) => s + (today - new Date(x.joined)) / 31557600000, 0) / e.length : 0;
  const count = s => e.filter(x => x.status === s).length;

  const loginList = db.get('ems2_logins', []).filter(l => l.event === 'Logged in');
  const midnight = new Date().setHours(0, 0, 0, 0);
  const loginsToday = loginList.filter(l => l.time >= midnight).length;

  // -- summary cards: [icon, number, label, prefix, decimals]. Money cards are for Admin/HR only --
  const cards = [
    ['👥', e.length, 'Total employees'], ['🏢', depts.length, 'Active departments'],
    ['🌴', count('On Leave'), 'On leave'], ['🆕', e.filter(x => new Date(x.joined) >= cutoff).length, 'New hires (90 days)'],
    ['✅', count('Active'), 'Active staff'], ['⛔', count('Inactive'), 'Inactive'],
    ['⏳', avgTenure, 'Avg tenure (years)', '', 1],
    ...(canEdit() ? [
      ['💰', Math.round(payroll / 12), 'Monthly payroll', '$'],
      ['📈', Math.round(payroll / (working.length || 1)), 'Average salary', '$'],
      ['🏆', Math.max(0, ...e.map(x => x.salary)), 'Highest salary', '$'],
      ['🔐', loginsToday, 'Logins today']] : [])
  ].map(([i, n, l, pre = '', dec = 0]) => `<div class="card"><i>${i}</i><b data-to="${n}" data-pre="${pre}" data-dec="${dec}">0</b><span>${l}</span></div>`).join('');

  // -- helpers for rows and bars --
  const row = (left, right) => `<div class="recent-row"><span>${left}</span><span class="muted">${right}</span></div>`;
  const bars = (rows, max) => rows.map(([l, n]) =>
    `<div class="bar"><span>${esc(l)}</span><div><i style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`).join('');
  const maxOf = rows => Math.max(...rows.map(r => r[1]), 1);

  // -- status donut --
  const statuses = [['Active', '#5ff0b0'], ['On Leave', '#ffd36b'], ['Inactive', '#ff8095']];
  let from = 0;
  const slices = statuses.map(([s, color]) => { const pct = count(s) / (e.length || 1) * 100; const part = `${color} ${from}% ${from + pct}%`; from += pct; return part; }).join(',');
  const legend = statuses.map(([s, c]) => `<div><i style="background:${c}"></i>${s}: <b>${count(s)}</b></div>`).join('');

  // -- chart data --
  const byDept = depts.map(d => [d, e.filter(x => x.dept === d).length]);
  const yrs = [...new Set(e.map(x => x.joined.slice(0, 4)))].sort();
  const byYear = yrs.map(y => [y, e.filter(x => x.joined.startsWith(y)).length]);
  const bands = [['Under $60k', e.filter(x => x.salary < 60000).length], ['$60k – $80k', e.filter(x => x.salary >= 60000 && x.salary < 80000).length], ['Over $80k', e.filter(x => x.salary >= 80000).length]];

  // -- lists --
  const top = [...e].sort((a, b) => b.salary - a.salary).slice(0, 5).map(x => row(esc(x.name), money(x.salary))).join('');
  const annivs = e.filter(x => +x.joined.slice(5, 7) === today.getMonth() + 1).map(x => { const y = today.getFullYear() - +x.joined.slice(0, 4); return row(esc(x.name), y > 0 ? y + ' year' + (y > 1 ? 's' : '') : 'Joined this month'); }).join('');
  const onLeave = e.filter(x => x.status === 'On Leave').map(x => row(esc(x.name), esc(x.dept))).join('');
  const recent = [...e].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 5).map(x => row(esc(x.name) + ' <span class="muted">· ' + esc(x.role) + '</span>', x.joined)).join('');
  const feed = db.get('ems2_activity', []).slice(0, 6).map(a => `<div class="feed-row">${esc(a.text)}<small>${new Date(a.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></div>`).join('')
    || '<p class="muted">No activity yet. Add or edit an employee to see it here.</p>';
  const recentLogins = loginList.slice(0, 5).map(l => row(esc(l.name), fmtTime(l.time))).join('');
  const empty = t => `<p class="muted">${t}</p>`;

  $('#dashboard').innerHTML = `
    <div class="quick">
      <select class="dash-filter" onchange="dashDept=this.value;renderDashboard();afterRender($('#view-dashboard'))">
        <option value="">All departments</option>${allDepts.map(d => `<option ${d === dashDept ? 'selected' : ''}>${esc(d)}</option>`).join('')}
      </select>
      ${canEdit() ? '<button class="btn primary" onclick="editForm()">+ Add employee</button>' : ''}
      <button class="btn ghost" onclick="exportCSV()">⬇ Export CSV</button>
      <button class="btn ghost" onclick="window.print()">🖨 Print report</button>
      <button class="btn ghost" onclick="location.hash=&quot;#/departments&quot;">🏢 Departments</button>
    </div>
    <div class="cards">${cards}</div>
    <div class="panels">
      <div class="glass panel"><h3>Employee status</h3><div class="donut-box"><div class="donut" style="background:conic-gradient(${slices})"></div><div class="legend">${legend}</div></div></div>
      <div class="glass panel"><h3>Headcount by department</h3>${bars(byDept, maxOf(byDept))}</div>
      <div class="glass panel"><h3>Hires per year</h3>${bars(byYear, maxOf(byYear))}</div>
      ${canEdit() ? `<div class="glass panel"><h3>Salary bands</h3>${bars(bands, maxOf(bands))}</div>
      <div class="glass panel"><h3>Top earners</h3>${top}</div>
      <div class="glass panel"><h3>Recent logins</h3>${recentLogins || empty('No logins recorded yet.')}</div>` : ''}
      <div class="glass panel"><h3>On leave now</h3>${onLeave || empty('Everyone is working.')}</div>
      <div class="glass panel"><h3>Work anniversaries this month</h3>${annivs || empty('No anniversaries this month.')}</div>
      <div class="glass panel"><h3>Recent hires</h3>${recent}</div>
      <div class="glass panel"><h3>Recent activity</h3>${feed}</div>
    </div>`;
}

// ===== 4. Departments page =====
function renderDepartments() {
  const e = emps();
  $('#deptGrid').innerHTML = [...new Set(e.map(x => x.dept))].sort().map(d => {
    const team = e.filter(x => x.dept === d);
    const avg = Math.round(team.reduce((s, x) => s + x.salary, 0) / team.length);
    return `<div class="glass dept-card" onclick="openDept('${esc(d)}')"><h3>${esc(d)}</h3>
      <p><b>${team.length}</b> employees</p><p>Average salary <b>${money(avg)}</b></p>
      <p>On leave <b>${team.filter(x => x.status === 'On Leave').length}</b></p></div>`;
  }).join('');
}
function openDept(name) { forcedDept = name; location.hash = '#/employees'; } // jump to Employees filtered

// ===== 5. Employees page (list, search, filter) =====
function renderTable() {
  const all = emps();
  const dept = forcedDept ?? $('#fDept').value; forcedDept = null;
  const q = $('#search').value.toLowerCase(), status = $('#fStatus').value;

  // rebuild the department dropdown
  const depts = [...new Set(all.map(x => x.dept))].sort();
  $('#fDept').innerHTML = '<option value="">All departments</option>' + depts.map(d => `<option ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('');

  const list = all.filter(x =>
    (!q || [x.name, x.email, x.id].some(v => v.toLowerCase().includes(q))) &&
    (!dept || x.dept === dept) && (!status || x.status === status));

  $('#tbody').innerHTML = list.map(x => `<tr>
    <td data-label="ID">${x.id}</td>
    <td data-label="Name"><b>${esc(x.name)}</b><br><small class="muted">${esc(x.email)}</small></td>
    <td data-label="Department">${esc(x.dept)}</td><td data-label="Designation">${esc(x.role)}</td><td data-label="Salary">${money(x.salary)}</td>
    <td data-label="Status"><span class="badge ${x.status.replace(' ', '')}">${x.status}</span></td>
    <td><div class="acts">
      <button data-a="view" data-id="${x.id}" title="View">👁</button>
      ${canEdit() ? `<button data-a="edit" data-id="${x.id}" title="Edit">✏️</button><button data-a="del" data-id="${x.id}" title="Delete">🗑</button>` : ''}
    </div></td></tr>`).join('');
  $('#empty').classList.toggle('hidden', list.length > 0);
}
['search', 'fDept', 'fStatus'].forEach(id => $('#' + id).addEventListener('input', renderTable));
$('#addBtn').onclick = () => editForm();
$('#exportBtn').onclick = exportCSV;

// one click handler for all View / Edit / Delete buttons
$('#tbody').addEventListener('click', e => {
  const btn = e.target.closest('button'); if (!btn) return;
  ({ view: viewEmp, edit: editForm, del: confirmDel })[btn.dataset.a](btn.dataset.id);
});

// ===== 5b. Login history page (Admin / HR only) =====
function renderLogins() {
  const q = $('#lsearch').value.toLowerCase(), ev = $('#levent').value;
  const list = db.get('ems2_logins', []).filter(l => (!q || (l.name + ' ' + l.email).toLowerCase().includes(q)) && (!ev || l.event === ev));
  const badge = e => e === 'Logged in' ? 'Active' : e === 'Logged out' ? 'OnLeave' : 'Inactive'; // green / yellow / red
  $('#lbody').innerHTML = list.map(l => `<tr>
    <td data-label="Name"><b>${esc(l.name)}</b></td><td data-label="Email">${esc(l.email)}</td><td data-label="Role">${esc(l.role)}</td>
    <td data-label="Event"><span class="badge ${badge(l.event)}">${l.event}</span></td>
    <td data-label="Date and time">${fmtTime(l.time, true)}</td><td data-label="Device">${esc(l.device)}</td></tr>`).join('');
  $('#lempty').classList.toggle('hidden', list.length > 0);
}
['lsearch', 'levent'].forEach(id => $('#' + id).addEventListener('input', renderLogins));

$('#lexport').onclick = () => {                       // download the history as a CSV file
  const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Name', 'Email', 'Role', 'Event', 'Date and time', 'Device'].join(','),
    ...db.get('ems2_logins', []).map(l => [l.name, l.email, l.role, l.event, fmtTime(l.time, true), l.device].map(cell).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  a.download = 'login-history.csv'; a.click(); toast('CSV downloaded');
};
$('#lclear').onclick = () => {
  openModal(`<h3>Clear login history?</h3><p class="muted">All saved login records in this browser will be removed.</p>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn danger" id="yesClear">Clear history</button></div>`);
  $('#yesClear').onclick = () => { db.set('ems2_logins', []); closeModal(); renderLogins(); toast('Login history cleared'); };
};

// ===== 6. View / Add / Edit / Delete =====
function viewEmp(id) {
  const x = emps().find(e => e.id === id);
  openModal(`<div class="profile"><h3>${esc(x.name)}</h3><dl>
    <dt>Employee ID</dt><dd>${x.id}</dd><dt>Email</dt><dd>${esc(x.email)}</dd><dt>Phone</dt><dd>${esc(x.phone)}</dd>
    <dt>Department</dt><dd>${esc(x.dept)}</dd><dt>Designation</dt><dd>${esc(x.role)}</dd>
    <dt>Salary</dt><dd>${canEdit() ? money(x.salary) : 'Restricted'}</dd><dt>Joined</dt><dd>${x.joined}</dd>
    <dt>Status</dt><dd><span class="badge ${x.status.replace(' ', '')}">${x.status}</span></dd></dl>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Close</button></div></div>`);
}

function editForm(id) {            // no id = Add, id given = Edit
  const all = emps();
  const x = id ? all.find(e => e.id === id)
               : { name: '', email: '', phone: '', dept: '', role: '', salary: '', joined: new Date().toISOString().slice(0, 10), status: 'Active' };
  const field = (key, label, type = 'text') => `<label>${label}<input name="${key}" type="${type}" value="${esc(x[key])}"></label>`;

  openModal(`<h3>${id ? 'Edit employee' : 'Add employee'}</h3><form id="empForm" novalidate>
    <div class="grid2">
      ${field('name', 'Full name')}${field('email', 'Email', 'email')}${field('phone', 'Phone', 'tel')}${field('dept', 'Department')}
      ${field('role', 'Designation')}${field('salary', 'Salary (USD)', 'number')}${field('joined', 'Joining date', 'date')}
      <label>Status<select name="status">${['Active', 'Inactive', 'On Leave'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    </div>
    <p class="error" id="empErr"></p>
    <div class="modal-actions"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary">Save employee</button></div></form>`);

  $('#empForm').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target)), err = $('#empErr');
    if (!d.name.trim() || !d.dept.trim() || !d.role.trim()) return fail(err, 'Name, department and designation are required.');
    if (!/^\S+@\S+\.\S+$/.test(d.email))                    return fail(err, 'Enter a valid email address.');
    if (!(+d.salary > 0))                                   return fail(err, 'Enter a salary above zero.');
    d.salary = +d.salary;

    if (id) { Object.assign(all.find(e => e.id === id), d); logActivity(me.name + ' updated ' + d.name); }
    else {
      const nextNumber = Math.max(1000, ...all.map(e => +e.id.slice(4))) + 1;
      all.push({ ...d, id: 'EMP-' + nextNumber }); logActivity(me.name + ' added ' + d.name);
    }
    db.set('ems2_employees', all); closeModal(); route();
    toast(id ? 'Employee updated' : 'Employee added');
  };
}

function confirmDel(id) {
  const x = emps().find(e => e.id === id);
  openModal(`<h3>Delete ${esc(x.name)}?</h3><p class="muted">This removes the record permanently and cannot be undone.</p>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn danger" id="yesDel">Delete employee</button></div>`);
  $('#yesDel').onclick = () => {
    db.set('ems2_employees', emps().filter(e => e.id !== id));
    logActivity(me.name + ' deleted ' + x.name); closeModal(); route(); toast('Employee deleted');
  };
}

// ===== 7. Export all employees to a CSV file (opens in Excel) =====
function exportCSV() {
  const cols = ['id', 'name', 'email', 'phone', 'dept', 'role', 'salary', 'joined', 'status'];
  const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [cols.join(','), ...emps().map(e => cols.map(c => cell(e[c])).join(','))];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  link.download = 'employees.csv'; link.click();
  toast('CSV downloaded');
}

// ===== 8. Sidebar (phone: slide-in menu with dark overlay) =====
function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
$('#menuBtn').onclick = () => {
  const s = $('#sidebar');
  if (innerWidth <= 800) { s.classList.toggle('open'); $('#scrim').classList.toggle('show', s.classList.contains('open')); }
  else s.classList.toggle('collapsed');
};
$('#scrim').onclick = closeMenu;

// ===== 9. Animations: number count-up + button ripple =====
function countUp() {
  $$('[data-to]').forEach(el => {
    const to = +el.dataset.to, pre = el.dataset.pre || '', dec = +el.dataset.dec || 0, start = performance.now();
    (function tick(now) {
      const t = Math.min((now - start) / 900, 1), ease = 1 - Math.pow(1 - t, 3); // slows down at the end
      el.textContent = pre + (to * ease).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  });
}
document.addEventListener('click', e => {           // water-drop ripple on every button
  const btn = e.target.closest('.btn'); if (!btn) return;
  const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height), s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  btn.appendChild(s); setTimeout(() => s.remove(), 600);
});

// ===== 10. Theme (dark / light) =====
function applyTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('ems2_theme', t); }
$('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// ===== 11. Start the app =====
(async () => {
  document.documentElement.dataset.theme = localStorage.getItem('ems2_theme') || 'dark';
  await bootData();
  init();
})();
