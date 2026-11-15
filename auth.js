/* ============================================================
   auth.js – session, login (password + Gmail OTP), sign-up, logout
   ============================================================ */
'use strict';

// ----- Session: who is logged in? -----
// "Remember me" ON  -> localStorage   (stays after browser closes)
// "Remember me" OFF -> sessionStorage (ends when the tab closes)
const session = {
  get: () => JSON.parse(sessionStorage.getItem('ems2_session') || localStorage.getItem('ems2_session') || 'null'),
  set(user, remember) { (remember ? localStorage : sessionStorage).setItem('ems2_session', JSON.stringify(user)); },
  clear() { sessionStorage.removeItem('ems2_session'); localStorage.removeItem('ems2_session'); }
};
let me = null;                                             // the logged-in user
const canEdit = () => me && ['admin', 'hr'].includes(me.role); // only Admin/HR can add, edit, delete

// ----- Switch between Login / OTP / Sign-up screens -----
let currentForm = 'login';
const FORM_ORDER = { login: 0, otp: 1, signup: 2 };
function showForm(name) {
  const dir = FORM_ORDER[name] >= FORM_ORDER[currentForm] ? 1 : -1; // going forward = slide from right, back = from left
  currentForm = name;
  ['login', 'otp', 'signup'].forEach(n => {
    const f = $('#' + n + 'Form');
    f.classList.toggle('hidden', n !== name);
    if (n === name) {
      f.style.setProperty('--dx', 30 * dir + 'px');
      [...f.children].forEach((child, i) => child.style.setProperty('--k', i)); // order of fields
      f.classList.remove('swap'); void f.offsetWidth; f.classList.add('swap');   // replay animation
    }
  });
  $('.tabs').classList.toggle('hidden', name === 'otp');
  if (name !== 'otp') $('.tabs').dataset.on = name;                              // moves the sliding pill
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  const card = $('.auth-card'); card.classList.remove('morph'); void card.offsetWidth; card.classList.add('morph');
  $('#authSub').textContent = { login: 'Sign in to manage your team', signup: 'Create your account', otp: 'Verify it is you' }[name];
}
$$('.tab').forEach(t => t.onclick = () => showForm(t.dataset.tab));

// Eye button: show / hide password
$$('.eye').forEach(b => b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; });

// ----- STEP 1: email + password -----
let pending = null; // user who passed the password check but has not entered OTP yet
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), err = $('#loginErr');
  const email = f.get('email').trim().toLowerCase(), pass = f.get('password');

  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(err, 'Enter a valid email address.');
  if (!pass)                         return fail(err, 'Enter your password.');
  const h = await hash(pass);
  const users = db.get('ems2_users', []);
  const user = users.find(u => u.email === email && u.pass === h);
  if (!user) {                                   // save the failed attempt too
    const known = users.find(u => u.email === email);
    logLogin({ name: known ? known.name : 'Unknown', email, role: known ? known.role : '-' }, 'Wrong password');
    return fail(err, 'Email or password is incorrect.');
  }
  err.textContent = '';
  pending = { name: user.name, email: user.email, role: user.role, remember: f.get('remember') === 'on' };
  showForm('otp');
  sendOtp();
});

// ----- STEP 2: OTP -----
let otp = null, resendTimer = null; // otp = { code, expires, tries }
const emailReady = () => window.emailjs && CONFIG.EMAILJS_PUBLIC_KEY && CONFIG.EMAILJS_SERVICE_ID && CONFIG.EMAILJS_TEMPLATE_ID;
// remove accidental spaces from the keys pasted in config.js
['EMAILJS_PUBLIC_KEY', 'EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'LOGIN_ALERT_TEMPLATE_ID'].forEach(k => CONFIG[k] = String(CONFIG[k] || '').trim());
if (emailReady()) emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });

async function sendOtp() {
  // 1) make a random 6-digit code
  const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
  otp = { code, expires: Date.now() + CONFIG.OTP_VALID_MINUTES * 60000, tries: 0 };
  $('#otpErr').textContent = '';
  $('#otpForm [name=otp]').value = '';

  // 2) stop with a clear message if EmailJS is not set up yet
  const keysSet = CONFIG.EMAILJS_PUBLIC_KEY && CONFIG.EMAILJS_SERVICE_ID && CONFIG.EMAILJS_TEMPLATE_ID;
  if (!keysSet) { $('#otpInfo').textContent = ''; return fail($('#otpErr'), 'Email is not set up. Open config.js and add your EmailJS keys.'); }
  if (!window.emailjs) { $('#otpInfo').textContent = ''; return fail($('#otpErr'), 'Could not load the email library. Check your internet and reload.'); }

  // 3) email the code to the user's Gmail
  $('#otpInfo').textContent = 'Sending OTP to ' + pending.email + '...';
  try {
    await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID,
      { to_email: pending.email, to_name: pending.name, otp_code: code, valid_minutes: CONFIG.OTP_VALID_MINUTES });
    $('#otpInfo').textContent = 'We sent a 6-digit OTP to ' + pending.email + '. Check your inbox and spam folder.';
  } catch (error) {
    console.error(error);
    $('#otpInfo').textContent = '';
    const why = String(error.text || error.message || 'unknown error');
    // turn the common EmailJS errors into a clear instruction
    const hint = /service id/i.test(why)  ? 'Wrong Service ID in config.js. Copy it from dashboard.emailjs.com/admin (looks like service_abc123).'
               : /template/i.test(why)    ? 'Wrong Template ID in config.js (looks like template_abc123).'
               : /public key|user_id|account/i.test(why) ? 'Wrong Public Key in config.js. Copy it from EmailJS > Account.'
               : 'Could not send the email: ' + why;
    fail($('#otpErr'), hint);
  }
  startResendTimer();
}

function startResendTimer() {
  const btn = $('#resendBtn'); let left = CONFIG.OTP_RESEND_SECONDS;
  clearInterval(resendTimer);
  btn.disabled = true;
  resendTimer = setInterval(() => {
    btn.textContent = left > 0 ? 'Resend OTP in ' + left-- + 's' : 'Resend OTP';
    if (left < 0) { btn.disabled = false; clearInterval(resendTimer); }
  }, 1000);
}
$('#resendBtn').onclick = sendOtp;
$('#otpBack').onclick = () => { otp = pending = null; clearInterval(resendTimer); showForm('login'); };

$('#otpForm').addEventListener('submit', e => {
  e.preventDefault();
  const typed = new FormData(e.target).get('otp').trim(), err = $('#otpErr');
  if (!otp)                       return fail(err, 'Go back and log in again.');
  if (Date.now() > otp.expires)   return fail(err, 'This OTP has expired. Tap Resend OTP.');
  if (++otp.tries > CONFIG.OTP_MAX_TRIES) return fail(err, 'Too many wrong tries. Tap Resend OTP for a new code.');
  if (typed !== otp.code) { logLogin(pending, 'Wrong OTP'); return fail(err, 'Wrong OTP. ' + (CONFIG.OTP_MAX_TRIES - otp.tries) + ' tries left.'); }
  // OTP correct -> log the user in
  session.set({ name: pending.name, email: pending.email, role: pending.role }, pending.remember);
  otp = pending = null; clearInterval(resendTimer);
  me = session.get(); logActivity(me.name + ' logged in');
  logLogin(me, 'Logged in'); notifyAdmin(me);   // save in Login history + email the admin
  showForm('login'); e.target.reset();
  location.hash = '#/dashboard';
  init();
});

// Optional: email the admin on every login (works for logins from any device)
function notifyAdmin(user) {
  if (!CONFIG.LOGIN_ALERT_TEMPLATE_ID || !emailReady()) return;
  emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.LOGIN_ALERT_TEMPLATE_ID, {
    to_email: CONFIG.ADMIN_EMAIL, user_name: user.name, user_email: user.email,
    role: user.role, login_time: fmtTime(Date.now(), true), device: deviceName()
  }).catch(err => console.error('Login alert failed', err));
}

// ----- Sign-up -----
$('#signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), err = $('#signupErr');
  const name = f.get('name').trim(), email = f.get('email').trim().toLowerCase(), pass = f.get('password');

  if (name.length < 2)                                       return fail(err, 'Enter your full name.');
  if (!/^\S+@\S+\.\S+$/.test(email))                         return fail(err, 'Enter a valid email address (use your Gmail to receive OTPs).');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pass))           return fail(err, 'Password needs 8+ characters with a letter and a number.');
  if (pass !== f.get('confirm'))                             return fail(err, 'Passwords do not match.');
  const users = db.get('ems2_users', []);
  if (users.some(u => u.email === email)) return fail(err, 'An account with this email already exists.');
  users.push({ name, email, role: f.get('role'), pass: await hash(pass) });
  db.set('ems2_users', users);
  err.textContent = ''; e.target.reset(); showForm('login');
  toast('Account created. Log in to continue.');
});

// ----- Logout -----
$('#logoutBtn').onclick = () => { if (me) logLogin(me, 'Logged out'); session.clear(); me = null; location.hash = ''; init(); };
