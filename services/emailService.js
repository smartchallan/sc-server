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

async function sendWelcomeEmail(to, name) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${process.env.COMPANY_LOGO_URL}" alt="Company Logo" style="max-width:180px;max-height:80px;"/>
      </div>
      <h2 style="color:#2d3748;">Welcome to ${process.env.COMPANY_NAME || 'Our Platform'}!</h2>
      <p>Hi <b>${name}</b>,</p>
      <p>Thank you for registering with us. We're excited to have you on board.</p>
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

module.exports = { sendWelcomeEmail };
