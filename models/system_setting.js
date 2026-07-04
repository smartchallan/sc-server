const { DataTypes } = require('sequelize');

/**
 * SystemSetting — single-row global feature flags for the platform.
 *
 * We enforce a single row (id = 1) so there is always exactly one settings
 * record. Use upsert({ id: 1, ... }) to create-or-update safely.
 */
module.exports = (sequelize) => {
  const SystemSetting = sequelize.define(
    'SystemSetting',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },

      /** Master switch — when false the prepaid billing module is hidden/disabled */
      billingEnabled: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },

      /** Network-wide fallback per-vehicle price (₹) when a client has no explicit BillingRate */
      defaultMonthlyPrice: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0, allowNull: false },

      /** Default GST/tax % applied to invoices when an issuer has not set their own */
      defaultTaxPercent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0, allowNull: false },
    },
    {
      tableName: 'system_settings',
      timestamps: true,
    }
  );

  return SystemSetting;
};
