const { DataTypes } = require('sequelize');

/**
 * The per-vehicle price (in ₹) charged for a given client. A dealer sets one rate
 * per client; that rate values every vehicle token the client is sold.
 *
 * Resolution order for a client C (see billing.service.resolveRate):
 *   1. BillingRate row with clientId = C        (explicit per-client price)
 *   2. SystemSetting.defaultMonthlyPrice         (papa-set network default)
 *
 * One row per client (clientId unique). `setByUserId` records which dealer/papa
 * last set it (for audit).
 */
module.exports = (sequelize) => {
  const BillingRate = sequelize.define(
    'BillingRate',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

      clientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'client_id',
        comment: 'The client this price applies to (di_user.id)',
      },

      monthlyPrice: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        field: 'monthly_price',
        comment: 'Price charged per vehicle (per 1-month token)',
      },

      setByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'set_by_user_id',
        comment: 'Dealer/papa who last set this rate',
      },

      graceDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'grace_days',
        comment: 'Extra days added beyond the 1-month term when this client activates/renews a vehicle',
      },
    },
    {
      tableName: 'di_billing_rate',
      underscored: true,
      timestamps: true,
    }
  );

  return BillingRate;
};
