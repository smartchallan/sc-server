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


async function sendWelcomeEmail(to, name, username, password, dealerName, dealerId) {
  const dealerRow = dealerName
    ? `<tr><td style="padding:4px 0;color:#4a5568;">Added by (Dealer):</td><td style="padding:4px 0;"><b>${dealerName}</b>${dealerId ? ` <span style="color:#718096;font-size:13px;">(ID: ${dealerId})</span>` : ''}</td></tr>`
    : '';
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
          ${dealerRow}
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

async function sendClientRegistrationNotification({ name, email, phone, company_name, business_category, city, state, dealer_name, dealer_id }) {
  const NOTIFY_RECIPIENTS = process.env.STAKEHOLDER_EMAILS || 'operations@smartchallan.com,smartchallan@gmail.com';
  const dealerRows = dealer_name
    ? `<tr><td style="padding:6px 0;color:#4a5568;">Added by (Dealer)</td><td style="padding:6px 0;"><b>${dealer_name}</b></td></tr>
       <tr><td style="padding:6px 0;color:#4a5568;">Dealer ID</td><td style="padding:6px 0;">${dealer_id || '-'}</td></tr>`
    : '';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${process.env.COMPANY_LOGO_URL}" alt="Company Logo" style="max-width:180px;max-height:80px;"/>
      </div>
      <h2 style="color:#2d3748;">New Client Registered</h2>
      <p style="font-size:15px;">A new client has been registered on <b>${process.env.COMPANY_NAME || 'SmartChallan'}</b>. Details are below:</p>
      <div style="margin:20px 0;padding:16px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;">
        <table style="width:100%;font-size:15px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#4a5568;width:40%;">Name</td><td style="padding:6px 0;"><b>${name || '-'}</b></td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">Email</td><td style="padding:6px 0;">${email || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">Phone</td><td style="padding:6px 0;">${phone || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">Company</td><td style="padding:6px 0;">${company_name || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">Business Category</td><td style="padding:6px 0;">${business_category || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">City</td><td style="padding:6px 0;">${city || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#4a5568;">State</td><td style="padding:6px 0;">${state || '-'}</td></tr>
          ${dealerRows}
        </table>
      </div>
      <p style="font-size:13px;color:#718096;">This is an automated notification from ${process.env.COMPANY_NAME || 'SmartChallan'}.</p>
    </div>
  `;
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: NOTIFY_RECIPIENTS,
    subject: `New Client Registered: ${name}`,
    html
  });
}

async function sendTrialExpiryReminder({ clientName, clientEmail, dealerEmail, expiresAt, daysLeft }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const urgency = daysLeft <= 1 ? '#dc2626' : daysLeft <= 2 ? '#ea580c' : '#d97706';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${process.env.COMPANY_LOGO_URL}" alt="${process.env.COMPANY_NAME}" style="max-width:180px;max-height:80px;"/>
      </div>
      <div style="background:${urgency};color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:20px;text-align:center;">
        <strong style="font-size:16px;">⚠️ Trial Account Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>
      </div>
      <p>Hi <b>${clientName}</b>,</p>
      <p>Your <b>${process.env.COMPANY_NAME || 'SmartChallan'}</b> trial account is expiring on <b>${expiry}</b>.</p>
      <p>After expiry, your account will be <b>deactivated</b> and you will no longer be able to access the platform.</p>
      <div style="margin:24px 0;padding:16px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:15px;">To continue using ${process.env.COMPANY_NAME || 'SmartChallan'}, please contact your dealer or write to us at
          <a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a>.
        </p>
      </div>
      <p style="margin-top:32px;">Best regards,<br/>${process.env.COMPANY_NAME || 'SmartChallan Team'}</p>
    </div>
  `;
  const subject = `⚠️ Trial Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${clientName}`;
  const recipients = [clientEmail, 'smartchallan@gmail.com'];
  if (dealerEmail && dealerEmail !== clientEmail) recipients.push(dealerEmail);
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipients.join(','),
    subject,
    html,
  });
}

module.exports = { sendWelcomeEmail, sendMail, sendClientRegistrationNotification, sendTrialExpiryReminder };
/**
 * Send order notification email to admin and client
 * @param {Object} params - { clientEmail, adminEmail, clientName, orderDetails }
 */
async function sendOrderNotificationEmail({ clientEmail, adminEmail, clientName, orderDetails }) {
  // Use fallback emails if not provided
  const finalClientEmail = clientEmail || process.env.FALLBACK_CLIENT_EMAIL;
  const finalAdminEmail = adminEmail || process.env.FALLBACK_ADMIN_EMAIL;

  const html = `
    <div style="font-family:'Segoe UI', 'Roboto', 'Arial', sans-serif;max-width:820px;margin:auto;padding:24px;background:#f9f9f9;border-radius:10px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${process.env.COMPANY_LOGO_URL}" alt="Company Logo" style="max-width:180px;max-height:80px;"/>
      </div>
      <h2 style="color:#2d3748;font-family:'Segoe UI', 'Roboto', 'Arial', sans-serif;letter-spacing:0.5px;">Order Placed Successfully!</h2>
      <p style="font-size:16px;">Dear <b>${clientName}</b>,</p>
      <p style="font-size:15px;">Your order has been placed. Below are the details:</p>
      <div style="margin:24px 0;padding:18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;box-shadow:0 2px 8px #e2e8f0;">
        <h3 style="color:#3182ce;margin-bottom:12px;font-family:'Segoe UI', 'Roboto', 'Arial', sans-serif;font-size:18px;">Order Details</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;max-width:780px;font-size:15px;border-collapse:separate;border-spacing:0;word-break:break-word;table-layout:fixed;background:#fff;">
            <thead>
              <tr style="background:#f6f8fa;">
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;width:100px;">Vehicle No.</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;width:180px;">Challan No.</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">Type</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">Amount</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">Service Fee</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">GST %</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">GST Amt</th>
                <th style="padding:10px 10px;border-bottom:2px solid #3182ce;font-family:'Segoe UI Semibold','Segoe UI','Roboto',Arial,sans-serif;font-size:16px;font-weight:bold;color:#222;text-align:left;">Discount</th>
              </tr>
            </thead>
            <tbody>
              ${Array.isArray(orderDetails) ? orderDetails.map((item, idx) => `
                <tr style='background:${idx%2===0 ? '#f9fafb' : '#fff'};'>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.vehicle_number || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;width:180px;'>${item.challan_number || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.challan_type || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.challan_amount || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.service_fee || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.gst_percent || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.gst_amt || ''}</td>
                  <td style='padding:10px 10px;border-bottom:1px solid #e2e8f0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;color:#222;'>${item.discount || ''}</td>
                </tr>
              `).join('') : orderDetails}
            </tbody>
          </table>
        </div>
      </div>
      <p style="margin-top:32px;font-size:15px;">Thank you for choosing ${process.env.COMPANY_NAME || 'us'}!<br/>${process.env.COMPANY_NAME || 'The Team'}</p>
    </div>
  `;
  // Send to client if defined
  if (finalClientEmail) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: finalClientEmail,
      subject: `Order Confirmation - ${process.env.COMPANY_NAME || 'Your Order'}`,
      html
    });
  }
  // Send to admin if defined
  if (finalAdminEmail) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: finalAdminEmail,
      subject: `New Order Placed by ${clientName}`,
      html
    });
  }
}

module.exports.sendOrderNotificationEmail = sendOrderNotificationEmail;
