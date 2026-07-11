const { DataTypes } = require('sequelize');

/**
 * di_payments — one row per payment-gateway attempt for a challan-settlement
 * request (di_cart). Captures every field required to process and reconcile a
 * PayU transaction (request hash, PayU's mihpayid/mode/bank ref, and the full
 * verified response payload).
 */
module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cart_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false }, // payer (client)
    gateway: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'payu' },
    txnid: { type: DataTypes.STRING(64), allowNull: false, unique: true }, // our generated id sent to PayU
    mihpayid: { type: DataTypes.STRING(64), allowNull: true },             // PayU's payment id
    amount: { type: DataTypes.FLOAT, allowNull: false },
    productinfo: { type: DataTypes.STRING(255), allowNull: true },
    firstname: { type: DataTypes.STRING(150), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.ENUM('initiated', 'success', 'failure', 'pending'), allowNull: false, defaultValue: 'initiated' },
    payu_mode: { type: DataTypes.STRING(20), allowNull: true },
    bank_ref_num: { type: DataTypes.STRING(64), allowNull: true },
    error_code: { type: DataTypes.STRING(64), allowNull: true },
    error_message: { type: DataTypes.STRING(255), allowNull: true },
    request_hash: { type: DataTypes.TEXT, allowNull: true },
    response: { type: DataTypes.JSON, allowNull: true },
    return_origin: { type: DataTypes.STRING(255), allowNull: true }, // SPA origin to redirect the browser back to
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'di_payments',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_at) instance.created_at = moment.tz(instance.created_at, 'Asia/Kolkata').utc().toDate();
        if (instance.updated_at) instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.updated_at) instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
      },
    },
  });
  return Payment;
};
