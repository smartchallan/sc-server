// jobs/expiredInsuranceNotificationJob.js
// Expired Insurance Notification Job
// 1. Fetch active client users
// 2. Filter users who opted-in for email notifications
// 3. Ensure they have configured notification receiver emails
// 4. For each eligible client_id, lookup di_vehicle_rto_data for expired insurance
// 5. Send email (HTML template follows existing design) listing vehicles with expired insurance

const models = require('../models');
const { User, UserOptions, DiUserNotificationReceivers, VehicleRTOData } = models;
const { Op } = require('sequelize');
const moment = require('moment');
const momentTz = require('moment-timezone');
const { sendMail } = require('../services/emailService');

async function expiredInsuranceNotificationJob() {
  try {
    // 1) Fetch active users with role 'client'
    const clients = await User.findAll({
      where: { status: 'active', role: 'client' },
      attributes: ['id', 'name', 'email', 'client_id'],
      raw: true
    });

    if (!clients || clients.length === 0) {
      console.log('No active client users found for expired insurance notifications');
      return [];
    }

    const clientUserIds = clients.map(c => c.id);

    // 2) Find users who have option 'receive_email_notification' = true
    const truthyValues = ['1', 'true', 'yes', 'on'];
    const options = await UserOptions.findAll({
      where: {
        user_id: { [Op.in]: clientUserIds },
        option_key: 'receive_email_notification',
        [Op.and]: models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('option_value')), { [Op.in]: truthyValues })
      },
      attributes: ['user_id'],
      raw: true
    });

    const usersWithOpt = new Set(options.map(o => o.user_id));
    console.log('Users with receive_email_notification enabled (Expired Insurance):', Array.from(usersWithOpt));
    if (usersWithOpt.size === 0) {
      console.log('No users opted in for expired insurance email notifications');
      return [];
    }

    // 3) Find notification receivers for those users: notification_type = 'email', status = true, and a non-empty value
    const receivers = await DiUserNotificationReceivers.findAll({
      where: {
        user_id: { [Op.in]: Array.from(usersWithOpt) },
        notification_type: 'email',
        status: true,
        value: { [Op.not]: null }
      },
      attributes: ['user_id', 'value'],
      raw: true
    });

    const receiverMap = receivers.reduce((acc, r) => {
      const val = r.value && String(r.value).trim();
      if (!val) return acc;
      if (!acc[r.user_id]) acc[r.user_id] = [];
      acc[r.user_id].push(val);
      return acc;
    }, {});

    // 4) Filter original clients to those that have configured receiver emails
    const eligibleUsers = clients.filter(u => Array.isArray(receiverMap[u.id]) && receiverMap[u.id].length > 0);

    console.log('Eligible users for expired insurance notifications:', eligibleUsers);
    const eligibleWithEmails = eligibleUsers.map(u => ({
      user_id: u.id,
      name: u.name,
      client_id: u.client_id,
      configured_emails: receiverMap[u.id] || []
    }));

    console.log('Eligible clients for expired insurance notifications and configured emails:');
    // console.table(eligibleWithEmails.map(e => ({ user_id: e.user_id, name: e.name, client_id: e.user_id, emails: e.configured_emails.join(', ') })));

    // Prepare to fetch expired insurance per client
    const todayIST = momentTz().tz('Asia/Kolkata').startOf('day');
    const todayStr = todayIST.format('YYYY-MM-DD');

    const sentRecipientKeys = new Set();
    const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
    const clientResults = [];

    for (const u of eligibleWithEmails) {
      const clientId = u.client_id || u.user_id;

      // 5) Lookup VehicleRTOData for this client where insurance_exp is before today (i.e., expired)
      const expired = await VehicleRTOData.findAll({
        where: {
          client_id: clientId,
          insurance_exp: { [Op.lt]: todayStr }
        },
        attributes: ['id', 'vehicle_number', 'insurance_exp', 'rto_data'],
        order: [['insurance_exp', 'DESC']],
        raw: true
      });

      // console.log(`Client ${clientId} - expired insurance vehicles:`, expired.map(e => e.vehicle_number));
      clientResults.push({ client_id: clientId, user_id: u.user_id, expired_vehicles: expired });

      if (!Array.isArray(expired) || expired.length === 0) continue;

      // Build HTML rows for expired vehicles
      const rowsHtml = expired.map((v, idx) => {
        const insExp = v.insurance_exp ? moment(v.insurance_exp).format('YYYY-MM-DD') : '';
        let insCompany = '';
        try {
          const parsed = typeof v.rto_data === 'string' && v.rto_data ? JSON.parse(v.rto_data) : v.rto_data;
          if (parsed && parsed.VehicleDetails) insCompany = parsed.VehicleDetails.rc_insurance_comp || '';
        } catch (e) {
          insCompany = '';
        }
        return `
          <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'};">
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${idx + 1}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${v.vehicle_number || ''}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;color:#dc2626;font-weight:600;">${insExp}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;">${insCompany}</td>
          </tr>`;
      }).join('\n');

      const summaryHtml = `<p style="margin:0 0 12px 0;color:#4b5563;">You have <strong>${expired.length}</strong> vehicle(s) whose insurance has expired. Please renew insurance for the listed vehicles.</p>`;

      const html = `
        <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;max-width:820px;margin:auto;padding:0;background:#f3f6f9;border-radius:10px;overflow:visible;border:1px solid #e6eef8;">
          <div style="background:linear-gradient(90deg,#0ea5b7,#3182ce);padding:18px 24px;text-align:left;color:#fff;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${process.env.COMPANY_LOGO_URL || ''}" alt="SmartChallan" style="height:48px;object-fit:contain;"/>
            </div>
          </div>
          <div style="padding:20px 24px;background:#ffffff;font-size:15px;color:#1f2937;">
            <p style="margin:0 0 12px 0;">Hi <strong>${u.name || 'User'}</strong>,</p>
            <p style="margin:0 0 16px 0;color:#4b5563;">The following vehicle(s) for your account have expired insurance as of <strong>${todayIST.format('YYYY-MM-DD')}</strong> (IST).</p>
            ${summaryHtml}
            <div style="border:1px solid #eef2f6;border-radius:8px;padding:12px;overflow-x:auto;overflow-y:hidden;display:block;width:100%;">
              <table style="display:block;width:800px;min-width:480px;border-collapse:separate;border-spacing:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">S.no.</th>
                    <th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Vehicle No.</th>
                    <th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Insurance Expiry</th>
                    <th style="padding:10px 12px;border-bottom:2px solid #e6eef8;text-align:left;font-weight:600;font-size:13px;">Insurance company</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
            <div style="margin-top:16px;">
              <a href="https://app.smartchallan.com" target="_blank" rel="noopener noreferrer" style="background:#0ea5b7;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Open Dashboard</a>
            </div>
            <p style="margin-top:18px;font-size:13px;color:#6b7280;">You are receiving this email because you (or someone on your team) configured notifications for your account.</p>
            <p style="margin:0;color:#6b7280;">Regards,<br/>${process.env.COMPANY_NAME || 'SmartChallan'} Team</p>
          </div>
          <div style="padding:12px 20px;background:#f8fafc;font-size:12px;color:#6b7280;text-align:center;">&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'SmartChallan'}. All rights reserved.</div>
        </div>`;

      // Determine recipient emails: prefer configured emails, allow forced test email via env
      const testEmail = process.env.TEST_EMAIL || 'smartchallan@gmail.com';
      let emails = Array.isArray(u.configured_emails) && u.configured_emails.length > 0
        ? u.configured_emails.map(normalizeEmail)
        : [];
      if (process.env.FORCE_TEST_EMAIL === 'true') {
        emails = [testEmail];
      }
      // Fallback: if no configured emails and not forcing test, skip
      emails = Array.from(new Set(emails.filter(Boolean)));
      if (emails.length === 0) {
        console.log(`No recipient emails for client ${clientId}, skipping send`);
        continue;
      }

      const recipientKey = `${clientId}:${emails.join(',')}`;
      if (sentRecipientKeys.has(recipientKey)) {
        console.log(`Skipping send for client ${clientId} - recipients already emailed: ${recipientKey}`);
        continue;
      }
      sentRecipientKeys.add(recipientKey);

      const to = emails.join(',');
      if (to) {
        try {
          await sendMail({ to, subject: `Expired Insurance - ${process.env.COMPANY_NAME || 'SmartChallan'}`, html });
          console.log(`Sent expired insurance email to ${to} for client ${clientId}`);
        } catch (err) {
          console.error(`Failed to send expired insurance email to ${to} for client ${clientId}:`, err);
        }
      }
    }

    return { eligible: eligibleWithEmails, expired_by_client: clientResults };
  } catch (err) {
    console.error('Error in expiredInsuranceNotificationJob:', err);
    throw err;
  }
}

module.exports = expiredInsuranceNotificationJob;
