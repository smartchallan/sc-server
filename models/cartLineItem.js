const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CartLineItem = sequelize.define('CartLineItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cart_id: { type: DataTypes.INTEGER, allowNull: false },
    vehicle_number: { type: DataTypes.STRING(32), allowNull: false },
    challan_number: { type: DataTypes.STRING(64), allowNull: true },
    challan_type: { type: DataTypes.STRING(32), allowNull: true },
    challan_amount: { type: DataTypes.FLOAT, allowNull: true },
    discount: { type: DataTypes.FLOAT, allowNull: true },
    discount_code: { type: DataTypes.STRING(16), allowNull: true },
    service_fee: { type: DataTypes.FLOAT, allowNull: true },
    gst_percent: { type: DataTypes.FLOAT, allowNull: true },
    gst_amt: { type: DataTypes.FLOAT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'di_cart_line_items',
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
      },
      beforeUpdate: (instance) => {
        const moment = require('moment-timezone');
        if (instance.updated_at) {
          instance.updated_at = moment.tz(instance.updated_at, 'Asia/Kolkata').utc().toDate();
        }
      }
    }
  });
  return CartLineItem;
};
