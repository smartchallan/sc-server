const { SystemSetting } = require('../models');

// Single-row global settings for the token-billing module (ported from
// DriveInnovate, trimmed to the billing fields SmartChallan needs).
const DEFAULT_SETTINGS = {
  billingEnabled: false,
  defaultMonthlyPrice: 0,
  defaultTaxPercent: 0,
};

/** Returns the single system-settings row, creating it with defaults if absent. */
const getSystemSettings = async () => {
  let row = await SystemSetting.findByPk(1);
  if (!row) {
    row = await SystemSetting.create({ id: 1, ...DEFAULT_SETTINGS });
  }
  return {
    billingEnabled: Boolean(row.billingEnabled),
    defaultMonthlyPrice: Number(row.defaultMonthlyPrice) || 0,
    defaultTaxPercent: Number(row.defaultTaxPercent) || 0,
  };
};

/** Upserts the single settings row. Only known billing keys are applied. */
const updateSystemSettings = async (updates = {}) => {
  const safe = {};
  if ('billingEnabled' in updates) safe.billingEnabled = Boolean(updates.billingEnabled);
  for (const k of ['defaultMonthlyPrice', 'defaultTaxPercent']) {
    if (k in updates) {
      const v = Number(updates[k]);
      if (!isNaN(v) && v >= 0) safe[k] = v;
    }
  }
  await SystemSetting.upsert({ id: 1, ...safe });
  return getSystemSettings();
};

module.exports = {
  getSystemSettings,
  updateSystemSettings,
};
