const { DataTypes } = require('sequelize');

/**
 * di_cart_approvals — the bottom-to-top approval chain for a challan-settlement
 * request (di_cart). One row per ancestor of the requesting client:
 *   level 1  = the client's immediate dealer (approves first)
 *   level N  = the top account (is_top = true); its approval places the request
 *              for settlement and finalizes the cart.
 * Approval is strictly ordered: an approver may only act when every lower level
 * is already 'approved' (tracked via di_cart.current_approver_id).
 */
module.exports = (sequelize) => {
  const CartApproval = sequelize.define('CartApproval', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cart_id: { type: DataTypes.INTEGER, allowNull: false },
    approver_id: { type: DataTypes.INTEGER, allowNull: false },
    approver_name: { type: DataTypes.STRING(150), allowNull: true },
    level: { type: DataTypes.INTEGER, allowNull: false },
    is_top: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
    note: { type: DataTypes.STRING(500), allowNull: true },
    acted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'di_cart_approvals',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_at) instance.created_at = moment.tz(instance.created_at, 'Asia/Kolkata').utc().toDate();
        if (instance.acted_at) instance.acted_at = moment.tz(instance.acted_at, 'Asia/Kolkata').utc().toDate();
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.acted_at) instance.acted_at = moment.tz(instance.acted_at, 'Asia/Kolkata').utc().toDate();
      },
    },
  });
  return CartApproval;
};
