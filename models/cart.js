const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cart = sequelize.define('Cart', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    dealer_id: { type: DataTypes.INTEGER, allowNull: false },
    admin_id: { type: DataTypes.INTEGER, allowNull: false },
    request_type: { type: DataTypes.STRING(64), allowNull: true },
    item_count: { type: DataTypes.INTEGER, allowNull: true },
    last_updated_by: { type: DataTypes.ENUM('admin', 'dealer', 'client'), allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: true, defaultValue: 'pending' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_cart',
    timestamps: false,
    hooks: {
      beforeCreate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.created_at) {
          instance.created_at = moment.tz(instance.created_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_by_dealer_at) {
          instance.updated_by_dealer_at = moment.tz(instance.updated_by_dealer_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_by_admin_at) {
          instance.updated_by_admin_at = moment.tz(instance.updated_by_admin_at, 'Asia/Kolkata').utc().toDate();
        }
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_by_dealer_at) {
          instance.updated_by_dealer_at = moment.tz(instance.updated_by_dealer_at, 'Asia/Kolkata').utc().toDate();
        }
        if (instance.updated_by_admin_at) {
          instance.updated_by_admin_at = moment.tz(instance.updated_by_admin_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });
  return Cart;
};
