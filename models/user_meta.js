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
  gtin: { type: DataTypes.STRING },
  // Challan settlement — UPI for receiving payment (dealer-level)
  upi_id: { type: DataTypes.STRING(128), allowNull: true },
  upi_payee_name: { type: DataTypes.STRING(128), allowNull: true },
  // Default pricing — dealer level; per-client overrides also live in this table
  default_online_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  default_court_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  default_virtual_court_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  default_gst_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  // ── Token-billing / tax-invoice identity (used on printed invoices) ──────────
  gstin: { type: DataTypes.STRING(20), allowNull: true },
  invoice_tax_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  invoice_prefix: { type: DataTypes.STRING(12), allowNull: true },
  logo_url: { type: DataTypes.STRING(500), allowNull: true }
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
