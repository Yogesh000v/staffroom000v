/* ============================================================
   config.js – YOUR SETTINGS. This is the only file you must edit.
   ============================================================ */
const CONFIG = {

  /* ---- A) Admin account (created on first run) ----
     Put YOUR Gmail here. The login OTP will be emailed to it. */
  ADMIN_NAME: "YOGESH",
  ADMIN_EMAIL: "yogesh.2004hr@gmail.com",
  ADMIN_PASSWORD: "yogesh@123",

  /* ---- B) Gmail OTP via EmailJS (free: emailjs.com) ----
     1. Sign up -> Email Services -> Add Service -> Gmail -> Connect -> copy "Service ID"
     2. Email Templates -> Create New Template, then set:
          To Email : {{to_email}}          <-- important
          Subject  : Your Staffroom OTP
          Content  : Hi {{to_name}}, your OTP is {{otp_code}}. It is valid for {{valid_minutes}} minutes.
        Save -> copy "Template ID"
     3. Account -> General -> copy "Public Key"
     Paste the three values below. */
  EMAILJS_PUBLIC_KEY: "0HxyuvzJkbqhK6pjx",
  EMAILJS_SERVICE_ID: "service_000v",
  EMAILJS_TEMPLATE_ID: "template_r56bt7o",

  /* ---- C) Login alert email to the admin (optional) ----
     Every login is saved in the "Login history" page. That page only shows logins made
     in the SAME browser. To get a mail for logins from ANY phone/computer:
     EmailJS -> Email Templates -> Create New Template:
          To Email : {{to_email}}
          Subject  : Login alert: {{user_name}}
          Content  : {{user_name}} ({{user_email}}, {{role}}) logged in on {{login_time}} using {{device}}.
     Save -> paste its Template ID here. Leave "" to turn alerts off. */
  LOGIN_ALERT_TEMPLATE_ID: "",

  /* ---- D) OTP rules ---- */
  OTP_VALID_MINUTES: 5,
  OTP_RESEND_SECONDS: 30,
  OTP_MAX_TRIES: 3
};
