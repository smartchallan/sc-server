const { Sequelize, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('superuser', 'admin', 'dealer', 'client', 'team'), allowNull: false },
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

  // Setup association here to avoid eager loading error
  try {
    const UserMeta = require('./user_meta')(sequelize);
    if (!User.associations.meta) {
      User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
      UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    }
  } catch (e) {
    // ignore if cyclic require
  }

  return User;
};
