/* ============================================================
   data.js – small helpers + saving/loading data in the browser
   ============================================================ */
'use strict';

// ----- Tiny helpers -----
const $  = (s, el = document) => el.querySelector(s);      // find one element
const $$ = (s, el = document) => [...el.querySelectorAll(s)]; // find many
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); // stops HTML injection
const money = n => '$' + Number(n).toLocaleString();

// ----- Storage: read/write JSON in localStorage -----
const db = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value)    { localStorage.setItem(key, JSON.stringify(value)); }
};

// Passwords are never saved as plain text; we save a SHA-256 hash.
async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ----- Sample employees: [name, department, designation, salary, joining date, status] -----
const SAMPLE = [
  ['Aarav Mehta','Engineering','Senior Developer',98000,'2021-03-15','Active'],
  ['Sofia Rossi','Design','UX Lead',88000,'2020-07-01','Active'],
  ['Liam Carter','Marketing','Content Strategist',64000,'2022-01-10','Active'],
  ['Priya Nair','Human Resources','HR Manager',72000,'2019-11-20','Active'],
  ['Noah Kim','Engineering','DevOps Engineer',91000,'2023-02-06','On Leave'],
  ['Emma Johansson','Finance','Financial Analyst',69000,'2021-09-13','Active'],
  ['Omar Haddad','Sales','Account Executive',67000,'2022-05-23','Active'],
  ['Chloe Dubois','Design','Product Designer',76000,'2024-01-08','Active'],
  ['Ravi Sharma','Engineering','QA Engineer',62000,'2018-06-18','Inactive'],
  ['Hannah Weiss','Sales','Sales Manager',95000,'2017-04-03','Active'],
  ['Diego Alvarez','Finance','Accountant',58000,'2024-06-17','Active'],
  ['Mei Tanaka','Marketing','Brand Manager',81000,'2025-02-03','Active'],
  ['Jack Turner','Engineering','Frontend Developer',79000,'2025-08-11','Active'],
  ['Zara Ahmed','Human Resources','Recruiter',54000,'2026-01-12','Active'],
  ['Kabir Singh','Sales','Sales Executive',52000,'2026-09-14','Active']
].map((r, i) => ({
  id: 'EMP-' + (1001 + i), name: r[0], email: r[0].split(' ')[0].toLowerCase() + '@company.com',
  phone: '+1 555 01' + String(10 + i).padStart(2, '0'),
  dept: r[1], role: r[2], salary: r[3], joined: r[4], status: r[5]
}));

// First visit only: save sample employees and the admin account.
async function bootData() {
  if (!db.get('ems2_employees')) db.set('ems2_employees', SAMPLE);
  if (!db.get('ems2_users')) db.set('ems2_users', [   // first admin comes from config.js
    { name: CONFIG.ADMIN_NAME, email: CONFIG.ADMIN_EMAIL.trim().toLowerCase(), role: 'admin', pass: await hash(CONFIG.ADMIN_PASSWORD) }
  ]);
}
const emps = () => db.get('ems2_employees', []);

// ----- Activity log (shown on the dashboard) -----
function logActivity(text) {
  const list = db.get('ems2_activity', []);
  list.unshift({ text, time: Date.now() });
  db.set('ems2_activity', list.slice(0, 12)); // keep the latest 12
}

// Show an error message and shake it (used by every form)
function fail(el, msg) {
  el.textContent = msg;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); // restart animation
  return false;
}

// ----- Login history (who logged in, when, from what device) -----
function fmtTime(t, withSeconds) {
  return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: withSeconds ? 'medium' : 'short' });
}
function deviceName() {                      // e.g. "Chrome on Android"
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return browser + ' on ' + os;
}
// event = 'Logged in' | 'Logged out' | 'Wrong password' | 'Wrong OTP'
function logLogin(user, event) {
  const list = db.get('ems2_logins', []);
  list.unshift({ name: user.name, email: user.email, role: user.role, event, time: Date.now(), device: deviceName() });
  db.set('ems2_logins', list.slice(0, 300));  // keep the latest 300
}
