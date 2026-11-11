import nodemailer from 'nodemailer';
import { db } from './db.mjs';

/**
 * Configure Nodemailer transport
 * Uses SMTP settings from process.env if available, otherwise operates in simulated/logged mode.
 */
let transporter = null;
const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

if (process.env.BREVO_API_KEY) {
  console.log('[EmailService] Brevo HTTPS REST API configured (Port 443 - Render cloud compatible).');
}

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
      connectionTimeout: 4000, // 4 seconds max connection timeout
      greetingTimeout: 4000,   // 4 seconds max greeting timeout
      socketTimeout: 5000,     // 5 seconds max socket inactivity timeout
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
  // If the request explicitly comes from local development (localhost / 127.0.0.1), use the local host
  if (req && req.headers && req.headers.host) {
    const host = req.headers.host;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const proto = req.headers['x-forwarded-proto'] || 'http';
      return `${proto}://${host}`;
    }
  }
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
 * Generate bulletproof, highly professional HTML email container
 * Designed specifically for Gmail (Web/iOS/Android), Outlook, Apple Mail, and Yahoo Mail
 * Uses 100% inline table-based layout and inline CSS (never relies on stripped <style> classes).
 */
function buildHtmlEmail({
  title,
  badgeText = 'OFFICIAL INVITATION',
  headline,
  recipientName,
  introParagraph,
  metadataRows = [],
  actionPrompt,
  ctaText,
  ctaLink,
  securityNote = 'This secure activation link is valid for 7 days.',
  footerNote,
}) {
  const metaHtml = metadataRows.length > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 24px 0 28px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
      ${metadataRows.map((row, idx) => `
        <tr>
          <td style="padding: 13px 18px; ${idx < metadataRows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; width: 38%;">
            ${row.label}
          </td>
          <td style="padding: 13px 18px; ${idx < metadataRows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-size: 14px; font-weight: 700; color: ${row.isCode ? '#0038a8' : '#0f172a'}; ${row.isCode ? "font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;" : ''}">
            ${row.value}
          </td>
        </tr>
      `).join('')}
    </table>
  ` : '';

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container (600px max) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
          
          <!-- Top Accent Gold / Blue Brand Stripe -->
          <tr>
            <td style="background-color: #0038a8; height: 5px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- Institutional Header -->
          <tr>
            <td style="background-color: #0b2559; padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #93c5fd; margin-bottom: 4px;">
                      Pangasinan State University • Asingan Campus
                    </div>
                    <div style="font-size: 21px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em; margin: 0; line-height: 1.3;">
                      Research Publication Tracking System
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">
                      Office of the Campus Research Coordinator
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px; background-color: #ffffff; color: #1e293b; font-size: 15px; line-height: 1.65;">
              
              <!-- Badge -->
              <div style="margin-bottom: 18px;">
                <span style="display: inline-block; background-color: #eff6ff; color: #0038a8; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; border: 1px solid #bfdbfe;">
                  ${badgeText}
                </span>
              </div>

              <!-- Greeting / Headline -->
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;">
                ${headline || `Welcome, ${recipientName}!`}
              </h2>

              <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.65;">
                ${introParagraph}
              </p>

              <!-- Metadata Summary Box -->
              ${metaHtml}

              ${actionPrompt ? `
              <p style="margin: 0 0 24px; color: #334155; font-size: 14px; line-height: 1.6;">
                ${actionPrompt}
              </p>
              ` : ''}

              <!-- Bulletproof Centered CTA Button (Table-based for Gmail/Outlook) -->
              ${ctaLink && ctaText ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #0038a8; box-shadow: 0 4px 12px rgba(0, 56, 168, 0.28);">
                          <a href="${ctaLink}" target="_blank" style="display: inline-block; padding: 16px 38px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: 8px; border: 1px solid #0038a8; text-align: center;">
                            ${ctaText} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Expiration Notice -->
              <p style="text-align: center; margin: 0 0 28px; font-size: 12px; color: #64748b;">
                ${securityNote}
              </p>
              
              <!-- Subtle Link Fallback Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; line-height: 1.5;">
                    <strong style="color: #334155;">Button not clickable?</strong> Copy and paste this link into your browser:
                    <div style="word-break: break-all; margin-top: 4px; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 11px; color: #0284c7;">
                      ${ctaLink}
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}

            </td>
          </tr>

          <!-- Footer Information & Sign-off -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
              <p style="margin: 0 0 4px; font-weight: 700; color: #1e293b; font-size: 13px;">
                Sir Rodelio M. Garin
              </p>
              <p style="margin: 0 0 6px; color: #475569;">
                Research Coordinator • Pangasinan State University, Asingan Campus
              </p>
              <p style="margin: 0 0 10px; font-size: 11px; color: #94a3b8;">
                ${footerNote || 'This is an official automated notification from the PSU Asingan Research Publication Tracking System. If you did not expect this message, please contact the Research Coordinator.'}
              </p>
              <div style="font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px;">
                Developed by Julius Oscar Moreno • PSU Asingan Campus
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send email via Brevo HTTPS REST API (Port 443)
 * Guarantees delivery on cloud hosts like Render that block raw SMTP ports (25, 465, 587).
 */
async function sendViaBrevo({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null;

  let fromEmail = process.env.SMTP_USER || 'mjuliusoscar@gmail.com';
  let fromName = 'PSU Asingan Research Portal';
  if (process.env.SMTP_FROM) {
    const match = process.env.SMTP_FROM.match(/"?([^"<]+)"?\s*<([^>]+)>/);
    if (match) {
      fromName = match[1].trim();
      fromEmail = match[2].trim();
    }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to, name: toName || to }],
      subject: subject,
      htmlContent: html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo API (${response.status}): ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Send an email (via Brevo HTTPS API or SMTP if available, or recorded safely)
 */
async function dispatchEmail({ to, toName, subject, html, emailType, token, link }) {
  let status = 'simulated';

  // 1. Try Brevo HTTPS REST API first (Port 443, Render cloud compatible)
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo({ to, toName, subject, html });
      status = 'sent';
      console.log(`[EmailService] Dispatched via Brevo HTTPS API [${emailType}] to ${to}`);
    } catch (err) {
      console.warn(`[EmailService] Brevo HTTPS dispatch failed for ${to}:`, err.message);
    }
  }

  // 2. Fall back to Nodemailer SMTP if Brevo is not configured or failed, and SMTP is configured
  if (status !== 'sent' && transporter && isSmtpConfigured) {
    try {
      let fromAddress = process.env.SMTP_FROM || `"PSU Research System" <${process.env.SMTP_USER}>`;
      if (fromAddress && !fromAddress.includes('<') && process.env.SMTP_USER) {
        if (fromAddress.includes(process.env.SMTP_USER)) {
          fromAddress = fromAddress.replace(process.env.SMTP_USER, `<${process.env.SMTP_USER}>`);
        } else {
          fromAddress = `"${fromAddress.replace(/"/g, '')}" <${process.env.SMTP_USER}>`;
        }
      }

      const sendPromise = transporter.sendMail({
        from: fromAddress,
        to: to,
        subject: subject,
        html: html,
      });

      // Strict 4-second timeout to prevent cloud gateway hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SMTP dispatch timed out after 4 seconds')), 4000);
      });

      await Promise.race([sendPromise, timeoutPromise]);
      status = 'sent';
      console.log(`[EmailService] Dispatched via SMTP [${emailType}] to ${to}`);
    } catch (err) {
      console.warn(`[EmailService] SMTP dispatch failed/timed out for ${to}:`, err.message);
      status = 'simulated';
    }
  }

  // 3. Fallback: Log to simulated console if both failed or neither is configured
  if (status === 'simulated') {
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
  const subject = 'Official Invitation: Join PSU Asingan Research Publication Tracking System';

  const html = buildHtmlEmail({
    title: subject,
    badgeText: 'OFFICIAL RESEARCHER INVITATION',
    headline: `Welcome, ${name}!`,
    recipientName: name,
    introParagraph: 'You have been registered by Campus Research Coordinator Sir Rodelio M. Garin to the PSU Asingan Research Publication Tracking System. To activate your profile, claim your scholarly publications, and set your private account password, please verify your email below.',
    metadataRows: [
      { label: 'Full Name', value: name },
      { label: 'Instructor ID', value: instructorId, isCode: true },
      { label: 'Department', value: department || 'General Academic' },
      { label: 'Registered Email', value: email },
    ],
    actionPrompt: 'Please click the button below to confirm your account and set your private login password:',
    ctaText: 'Activate Account & Set Password',
    ctaLink: verificationLink,
    securityNote: 'This secure activation link is valid for 7 days. If you did not expect this invitation, you may safely disregard this message.',
    footerNote: 'This invitation was authorized by Campus Research Coordinator Sir Rodelio M. Garin.',
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
  const subject = 'Verify Your Email Address - PSU Asingan Research Publication Tracking System';

  const html = buildHtmlEmail({
    title: subject,
    badgeText: 'EMAIL VERIFICATION',
    headline: `Hello, ${name}!`,
    recipientName: name,
    introParagraph: 'Thank you for registering with the PSU Asingan Research Publication Tracking System. Before your account can be reviewed and admitted by Campus Research Coordinator Sir Rodelio M. Garin, please confirm that you have access to this email address.',
    metadataRows: [
      { label: 'Full Name', value: name },
      { label: 'Instructor ID', value: instructorId, isCode: true },
      { label: 'Registered Email', value: email },
      { label: 'Status', value: 'Action Required • Awaiting Verification' },
    ],
    actionPrompt: 'Click the button below to verify your email address:',
    ctaText: 'Verify Email Address',
    ctaLink: verificationLink,
    securityNote: 'This verification link is valid for 7 days. Once verified, your account will be placed in the coordinator admission queue.',
    footerNote: 'Once verified, your account will be reviewed by Campus Research Coordinator Sir Rodelio M. Garin.',
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
  const subject = 'Registration Approved: Welcome to PSU Asingan Research Publication Tracking System';

  const html = buildHtmlEmail({
    title: subject,
    badgeText: 'REGISTRATION ADMITTED & ACTIVE',
    headline: `Congratulations, ${name}!`,
    recipientName: name,
    introParagraph: 'Your researcher registration for the PSU Asingan Research Publication Tracking System has been reviewed and officially admitted by Campus Research Coordinator Sir Rodelio M. Garin. Your profile is now live in the institutional directory.',
    metadataRows: [
      { label: 'Full Name', value: name },
      { label: 'Instructor ID', value: instructorId, isCode: true },
      { label: 'Account Status', value: 'Active & Verified' },
    ],
    actionPrompt: 'You may now log in using your Instructor ID and the password you created during registration:',
    ctaText: 'Log In to Research System',
    ctaLink: loginLink,
    securityNote: 'For security, never share your account password or session credentials with anyone.',
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
