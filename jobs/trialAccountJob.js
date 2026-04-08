require('dotenv').config();
const { User } = require('../models');
const { sendTrialExpiryReminder } = require('../services/emailService');
const { Op } = require('sequelize');

async function runTrialAccountJob() {
  const jobStart = new Date();
  console.table({ job: 'trialAccountJob', startedAt: jobStart.toISOString() });

  const REMINDER_DAYS = parseInt(process.env.TRIAL_EXPIRY_REMINDER_DAYS, 10) || 3;
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  let reminded = 0, deactivated = 0, errors = 0;

  try {
    // 1. Find all active trial accounts
    const trialAccounts = await User.findAll({
      where: {
        account_type: 'trial',
        status: 'active',
        trial_expires_at: { [Op.not]: null },
      },
    });

    for (const user of trialAccounts) {
      const userObj = user.toJSON ? user.toJSON() : user;
      const expiresAt = new Date(userObj.trial_expires_at);
      const msLeft = expiresAt - now;
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

      try {
        if (msLeft <= 0) {
          // ── Expired: mark inactive ──
          await user.update({ status: 'inactive' });
          deactivated++;
          console.table({ action: 'deactivated', userId: userObj.id, email: userObj.email });
        } else if (daysLeft <= REMINDER_DAYS) {
          // ── Expiring soon: send reminder ──
          let dealerEmail = null;
          if (userObj.parent_id) {
            try {
              const dealer = await User.findOne({ where: { id: userObj.parent_id }, attributes: ['email'] });
              dealerEmail = dealer?.email || null;
            } catch {}
          }
          await sendTrialExpiryReminder({
            clientName: userObj.name,
            clientEmail: userObj.email,
            dealerEmail,
            expiresAt: userObj.trial_expires_at,
            daysLeft,
          });
          reminded++;
          console.table({ action: 'reminder_sent', userId: userObj.id, email: userObj.email, daysLeft });
        }
      } catch (err) {
        errors++;
        console.error(`trialAccountJob error for user ${userObj.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('trialAccountJob fatal error:', err.message);
  }

  console.table({ job: 'trialAccountJob', reminded, deactivated, errors, duration: `${Date.now() - jobStart}ms` });
}

module.exports = runTrialAccountJob;
