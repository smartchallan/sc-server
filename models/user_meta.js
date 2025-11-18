const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserMeta = sequelize.define('UserMeta', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    company_name: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    zip: { type: DataTypes.STRING },
    country: { type: DataTypes.STRING },
  business_category: { type: DataTypes.STRING },
  gtin: { type: DataTypes.STRING }
  }, {
    tableName: 'di_user_meta',
    timestamps: false
  });

  // Setup association here to avoid eager loading error
  try {
    const User = require('./user')(sequelize);
    if (!UserMeta.associations.user) {
      UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
      User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
    }
  } catch (e) {
    // ignore if cyclic require
  }

  return UserMeta;
};
