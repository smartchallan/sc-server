const { Sequelize } = require('sequelize');
const UserModel = require('./user');
const UserMetaModel = require('./user_meta');
const UserVehicleModel = require('./userVehicle');
const UserVehiclesModel = require('./user_vehicles');
const UserSettingsModel = require('./user_settings');
const UserVehicleRtoDataModel = require('./userVehicleRtoData');
const VehicleRTODataModel = require('./vehicle_rto_data');
const VehicleChallanModel = require('./vehicle_challan');
const UserBillingModel = require('./user_billing');
const DIUserOptionsModel = require('./di_user_options');
const DIFailedRecordsModel = require('./di_failed_records');
const DIScheduledJobRecordsModel = require('./di_scheduled_job_records');
const DIDriverDataModel = require('./di_driver_data');
const DIUserNotificationReceiversModel = require('./di_user_notification_receivers');
const DIUserActivityModel = require('./di_user_activity');
const ClientNotificationModel = require('./client_notification');
const VehicleReportModel = require('./vehicle_report');
const WalletModel = require('./wallet');
const WalletTransactionModel = require('./wallet_transaction');
const BillingRateModel = require('./billing_rate');
const InvoiceModel = require('./invoice');
const InvoiceCounterModel = require('./invoice_counter');
const SystemSettingModel = require('./system_setting');

require('dotenv').config();

const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: process.env.PG_SSL === 'false' ? {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      }
    } : {},
  }
);


const User = UserModel(sequelize);
const UserMeta = UserMetaModel(sequelize);
const UserVehicle = UserVehicleModel(sequelize);
const UserVehicles = UserVehiclesModel(sequelize);
const UserSettings = UserSettingsModel(sequelize);
const UserVehicleRtoData = UserVehicleRtoDataModel(sequelize);
const VehicleRTOData = VehicleRTODataModel(sequelize);
const VehicleChallan = VehicleChallanModel(sequelize);
const DiVehicleChallanJobModel = require('./di_vehicle_challan_job');
const CartModel = require('./cart');
const Cart = CartModel(sequelize);
const CartLineItemModel = require('./cartLineItem');
const CartLineItem = CartLineItemModel(sequelize);
// Setup association for eager loading
Cart.hasMany(CartLineItem, { foreignKey: 'cart_id', as: 'line_items' });
CartLineItem.belongsTo(Cart, { foreignKey: 'cart_id', as: 'cart' });
const UserBilling = UserBillingModel(sequelize);
const UserOptions = DIUserOptionsModel(sequelize);
const FailedRecords = DIFailedRecordsModel(sequelize);
const ScheduledJobRecords = DIScheduledJobRecordsModel(sequelize);
const DiVehicleChallanJob = DiVehicleChallanJobModel(sequelize);
const DiDriverData = DIDriverDataModel(sequelize);
const DiUserNotificationReceivers = DIUserNotificationReceiversModel(sequelize);
const UserActivity = DIUserActivityModel(sequelize);
const ClientNotification = ClientNotificationModel(sequelize);
const VehicleReport = VehicleReportModel(sequelize);

// ── Billing: wallets, ledger, rates, invoices ───────────────────────────────
const Wallet = WalletModel(sequelize);
const WalletTransaction = WalletTransactionModel(sequelize);
const BillingRate = BillingRateModel(sequelize);
const Invoice = InvoiceModel(sequelize);
const InvoiceCounter = InvoiceCounterModel(sequelize);
const SystemSetting = SystemSettingModel(sequelize);

// Wallet ↔ User (owner)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Ledger rows ↔ Wallet / owner / counterparty
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
WalletTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
WalletTransaction.belongsTo(User, { foreignKey: 'counterparty_user_id', as: 'counterparty' });

// Per-client rate card
User.hasOne(BillingRate, { foreignKey: 'client_id', as: 'billingRate' });
BillingRate.belongsTo(User, { foreignKey: 'client_id', as: 'client' });

// Invoices ↔ buyer (client) / seller (issuer) / vehicle / debit ledger row
User.hasMany(Invoice, { foreignKey: 'client_id', as: 'invoices' });
Invoice.belongsTo(User, { foreignKey: 'client_id', as: 'client' });
Invoice.belongsTo(User, { foreignKey: 'issued_by_user_id', as: 'issuer' });
Invoice.belongsTo(UserVehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
UserVehicle.hasMany(Invoice, { foreignKey: 'vehicle_id', as: 'invoices' });
Invoice.belongsTo(WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'walletTransaction' });

module.exports = {
  sequelize,
  User,
  UserMeta,
  UserVehicle,
  UserVehicles,
  UserSettings,
  UserVehicleRtoData,
  VehicleRTOData,
  VehicleChallan,
  DiDriverData,
  DiVehicleChallanJob,
  Cart,
  CartLineItem,
  UserBilling,
  UserOptions,
  FailedRecords,
  ScheduledJobRecords,
  DiUserNotificationReceivers,
  UserActivity,
  ClientNotification,
  VehicleReport,
  Wallet,
  WalletTransaction,
  BillingRate,
  Invoice,
  InvoiceCounter,
  SystemSetting,
};
