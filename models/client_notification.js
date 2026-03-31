const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ClientNotification', {
    id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    sender_id:     { type: DataTypes.INTEGER, allowNull: false },
    sender_name:   { type: DataTypes.STRING(150), allowNull: false },
    recipient_id:  { type: DataTypes.INTEGER, allowNull: false },
    subject:       { type: DataTypes.STRING(255), allowNull: false },
    message:       { type: DataTypes.TEXT, allowNull: false },
    is_read:       { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'di_client_notifications',
    timestamps: false,
  });
};
