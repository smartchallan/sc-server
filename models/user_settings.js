const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserSettings = sequelize.define('UserSettings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: 'di_user_settings',
    timestamps: false
  });
  return UserSettings;
};
