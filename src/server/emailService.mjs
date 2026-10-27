import nodemailer from 'nodemailer';
import { db } from './db.mjs';

/**
 * Configure Nodemailer transport
 * Uses SMTP settings from process.env if available, otherwise operates in simulated/logged mode.
 */
let transporter = null;
const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

if (isSmtpConfigured) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[EmailService] SMTP configured with host:', process.env.SMTP_HOST);
  } catch (err) {
    console.warn('[EmailService] Failed to create SMTP transporter:', err.message);
  }
}

/**
 * Get base application URL
 */
export function getAppBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (req && req.headers && req.headers.host) {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${req.headers.host}`;
  }
  return `http://localhost:${process.env.PORT || '8443'}`;
}

/**
 * Log email to database
 */
function logEmail({ recipientEmail, recipientName, subject, emailType, verificationToken, verificationLink, htmlContent, status }) {
  try {
    const id = `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO email_logs (id, recipient_email, recipient_name, subject, email_type, verification_token, verification_link, html_content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      recipientEmail,
      recipientName || '',
      subject,
      emailType,
      verificationToken || null,
      verificationLink || null,
      htmlContent,
      status,
      now
    );
    return id;
  } catch (err) {
    console.warn('[EmailService] Could not log email to DB:', err.message);
    return null;
  }
}

/**
 * Generate standard HTML email container
 */
function buildHtmlEmail({ title, preheader, bodyHtml, ctaText, ctaLink, footerNote }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px 16px; color: #1f2937; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0038A8 0%, #1e40af 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .btn { display: inline-block; background-color: #0038A8; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 56, 168, 0.3); }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .meta-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .meta-item:last-child { margin-bottom: 0; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-val { color: #0f172a; font-weight: 600; }
    .footer { background: #f9fafb; padding: 20px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .alt-link { word-break: break-all; font-size: 13px; color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pangasinan State University</h1>
      <p>Asingan Campus • Research & Publication Monitoring System</p>
    </div>
    <div class="content">
      ${bodyHtml}
      ${ctaLink && ctaText ? `
        <div class="btn-container">
          <a href="${ctaLink}" class="btn" target="_blank">${ctaText}</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If the button above doesn't work, copy and paste this verification link into your web browser:</p>
        <p><a href="${ctaLink}" class="alt-link">${ctaLink}</a></p>
      ` : ''}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px;"><strong>PSU Asingan Campus — Research and Innovation Office</strong></p>
      <p style="margin: 0;">${footerNote || 'This is an automated system notification. If you did not expect this email, please contact the campus research coordinator.'}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send an email (via SMTP if available, or recorded safely)
 */
async function dispatchEmail({ to, toName, subject, html, emailType, token, link }) {
  let status = 'simulated';

  if (transporter && isSmtpConfigured) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"PSU Research System" <${process.env.SMTP_USER}>`,
        to: to,
        subject: subject,
        html: html,
      });
      status = 'sent';
      console.log(`[EmailService] Dispatched email [${emailType}] to ${to}`);
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
      status = 'failed';
    }
  } else {
    console.log(`\n================== [SIMULATED EMAIL OUTBOX] ==================`);
    console.log(`To: ${toName || ''} <${to}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${emailType}`);
    if (link) console.log(`Direct Link: ${link}`);
    console.log(`==============================================================\n`);
  }

  const logId = logEmail({
    recipientEmail: to,
    recipientName: toName,
    subject,
    emailType,
    verificationToken: token,
    verificationLink: link,
    htmlContent: html,
    status,
  });

  return { success: true, status, logId, link };
}

/**
 * 1. Admin Invitation Email:
 * Researcher added by admin; clicks verification link to set their preferred password.
 */
export async function sendAdminInvitationEmail({ email, name, instructorId, department, token, baseUrl }) {
  const verificationLink = `${baseUrl}/verify-invitation?token=${encodeURIComponent(token)}`;
  const subject = 'Invitation: Join PSU Research Publication System & Set Your Password';

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #111827; font-size: 18px;">Welcome, ${name}!</h2>
    <p>You have been registered by the Campus Research Administrator to the <strong>Pangasinan State University Research Publication Monitoring System</strong>.</p>
    <p>To officially activate your profile and be recognized in our institutional research directory, please verify your email and set your preferred account password.</p>
    
    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Full Name:</span>
        <span class="meta-val">${name}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Instructor ID / Username:</span>
        <span class="meta-val">${instructorId}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Email Address:</span>
        <span class="meta-val">${email}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Department:</span>
        <span class="meta-val">${department}</span>
      </div>
    </div>

    <p>Please click the button below to confirm your email address and set your personal login password:</p>
  `;

  const html = buildHtmlEmail({
    title: subject,
    bodyHtml,
    ctaText: 'Activate Account & Set Password',
    ctaLink: verificationLink,
    footerNote: 'This invitation was initiated by the PSU Asingan Campus Research Admin. This link expires in 7 days.',
  });

  return dispatchEmail({
    to: email,
    toName: name,
    subject,
    html,
    emailType: 'admin_invite',
    token,
    link: verificationLink,
  });
}

/**
 * 2. Self-Registration Email Verification:
 * Researcher self-registered at /login; verifies their email.
 */
export async function sendSelfRegisterVerificationEmail({ email, name, instructorId, token, baseUrl }) {
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = 'Verify your Email Address - PSU Research Publication System';

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #111827; font-size: 18px;">Hello, ${name}!</h2>
    <p>Thank you for registering for the <strong>PSU Research Publication Monitoring System</strong>.</p>
    <p>Before your account can be reviewed and admitted by the Research Administrator, please confirm that you have access to this email address.</p>
    
    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Instructor ID / Username:</span>
        <span class="meta-val">${instructorId}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Registered Email:</span>
        <span class="meta-val">${email}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Verification Status:</span>
        <span class="meta-val" style="color: #d97706;">Action Required</span>
      </div>
    </div>

    <p>Click the button below to verify your email address:</p>
  `;

  const html = buildHtmlEmail({
    title: subject,
    bodyHtml,
    ctaText: 'Verify Email Address',
    ctaLink: verificationLink,
    footerNote: 'Once verified, your account will be queued for administrator admission. You will be notified once admitted.',
  });

  return dispatchEmail({
    to: email,
    toName: name,
    subject,
    html,
    emailType: 'self_register_verify',
    token,
    link: verificationLink,
  });
}

/**
 * 3. Registration Approved & Admitted Email:
 * Notifies the researcher that the Admin has admitted their registration.
 */
export async function sendRegistrationApprovedEmail({ email, name, instructorId, baseUrl }) {
  const loginLink = `${baseUrl}/login`;
  const subject = 'Registration Approved: Welcome to PSU Research Publication System';

  const bodyHtml = `
    <h2 style="margin-top: 0; color: #111827; font-size: 18px;">Congratulations, ${name}!</h2>
    <p>Your registration for the <strong>PSU Research Publication Monitoring System</strong> has been reviewed and <strong style="color: #16a34a;">officially admitted</strong> by the Research Administrator.</p>
    <p>Your profile is now recognized in the public faculty directory, and you can begin monitoring publications, claiming scholarly works, and viewing impact metrics.</p>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Instructor ID / Username:</span>
        <span class="meta-val">${instructorId}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Account Status:</span>
        <span class="meta-val" style="color: #16a34a;">Active & Verified</span>
      </div>
    </div>

    <p>You may now log in using your Instructor ID and the password you chose during registration:</p>
  `;

  const html = buildHtmlEmail({
    title: subject,
    bodyHtml,
    ctaText: 'Log In to System',
    ctaLink: loginLink,
    footerNote: 'Welcome to the PSU Asingan Campus Research Community!',
  });

  return dispatchEmail({
    to: email,
    toName: name,
    subject,
    html,
    emailType: 'registration_approved',
    link: loginLink,
  });
}
