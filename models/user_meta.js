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
    business_category: { type: DataTypes.STRING }
  }, {
    tableName: 'di_user_meta',
    timestamps: false
  });
  return UserMeta;
};
