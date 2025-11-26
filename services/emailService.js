const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  name: process.env.EMAIL_HELO_HOST // Set custom HELO/EHLO hostname
});


async function sendWelcomeEmail(to, name, username, password) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${process.env.COMPANY_LOGO_URL}" alt="Company Logo" style="max-width:180px;max-height:80px;"/>
      </div>
      <h2 style="color:#2d3748;">Welcome to ${process.env.COMPANY_NAME || 'Our Platform'}!</h2>
      <p>Hi <b>${name}</b>,</p>
      <p>Thank you for registering with us. We're excited to have you on board.</p>
      <div style="margin:24px 0;padding:16px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;">
        <h3 style="color:#3182ce;margin-bottom:8px;">Your Login Credentials</h3>
        <table style="width:100%;font-size:16px;">
          <tr><td style="padding:4px 0;color:#4a5568;">Username:</td><td style="padding:4px 0;"><b>${username}</b></td></tr>
          <tr><td style="padding:4px 0;color:#4a5568;">Password:</td><td style="padding:4px 0;"><b>${password}</b></td></tr>
        </table>
        <p style="font-size:13px;color:#718096;margin-top:8px;">Please keep your credentials safe and do not share them with anyone.</p>
      </div>
      <p style="margin-top:32px;">Best regards,<br/>${process.env.COMPANY_NAME || 'The Team'}</p>
    </div>
  `;
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Welcome to ${process.env.COMPANY_NAME || 'Our Platform'}!`,
    html
  });
}

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  });
}

module.exports = { sendWelcomeEmail, sendMail };
