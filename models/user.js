const { Sequelize, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'dealer', 'client', 'team'), allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    admin_id: { type: DataTypes.INTEGER, allowNull: true },
    dealer_id: { type: DataTypes.INTEGER, allowNull: true },
    client_id: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'di_user',
    timestamps: false
  });
  return User;
};
