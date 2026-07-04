'use strict';

/**
 * Token-billing module (ported from DriveInnovate).
 *
 * Creates the wallet/ledger/rate/invoice tables + a single-row system_settings,
 * and adds the billing fields onto di_user, di_user_meta and di_user_vehicle.
 *
 * All steps are guarded (checks table/column existence first) so the migration
 * is safe to run against a database that already carries some of these objects
 * from earlier manual work.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const S = Sequelize;
    const ts = () => ({
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
    });

    const existingTables = (await queryInterface.showAllTables()).map((t) =>
      (typeof t === 'string' ? t : t.tableName).toLowerCase()
    );
    const hasTable = (name) => existingTables.includes(name.toLowerCase());

    const addColumnIfMissing = async (table, column, spec) => {
      if (!hasTable(table)) return;
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, spec);
    };

    // ── di_wallet ──────────────────────────────────────────────────────────
    if (!hasTable('di_wallet')) {
      await queryInterface.createTable('di_wallet', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: S.INTEGER, allowNull: false, unique: true },
        balance: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        status: { type: S.ENUM('active', 'frozen'), allowNull: false, defaultValue: 'active' },
        ...ts(),
      });
    }

    // ── di_wallet_transaction ──────────────────────────────────────────────
    if (!hasTable('di_wallet_transaction')) {
      await queryInterface.createTable('di_wallet_transaction', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        wallet_id: { type: S.INTEGER, allowNull: false },
        user_id: { type: S.INTEGER, allowNull: false },
        type: { type: S.ENUM('MINT', 'CREDIT', 'DEBIT', 'ADJUSTMENT', 'REVERSAL'), allowNull: false },
        token_type: { type: S.ENUM('PAID', 'TESTING', 'GRACE'), allowNull: false, defaultValue: 'PAID' },
        ref_type: { type: S.ENUM('MINT', 'TRANSFER', 'VEHICLE_ACTIVATION', 'VEHICLE_RENEWAL', 'MANUAL_ADJUST', 'REVERSAL'), allowNull: false },
        ref_id: { type: S.INTEGER, allowNull: true },
        amount: { type: S.DECIMAL(14, 2), allowNull: false },
        balance_after: { type: S.DECIMAL(14, 2), allowNull: false },
        counterparty_user_id: { type: S.INTEGER, allowNull: true },
        performed_by_user_id: { type: S.INTEGER, allowNull: true },
        group_ref: { type: S.STRING(40), allowNull: true },
        note: { type: S.STRING(300), allowNull: true },
        ...ts(),
      });
      await queryInterface.addIndex('di_wallet_transaction', ['user_id']);
      await queryInterface.addIndex('di_wallet_transaction', ['group_ref']);
      await queryInterface.addIndex('di_wallet_transaction', ['ref_type', 'ref_id']);
    }

    // ── di_billing_rate ────────────────────────────────────────────────────
    if (!hasTable('di_billing_rate')) {
      await queryInterface.createTable('di_billing_rate', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        client_id: { type: S.INTEGER, allowNull: false, unique: true },
        monthly_price: { type: S.DECIMAL(14, 2), allowNull: false },
        set_by_user_id: { type: S.INTEGER, allowNull: true },
        grace_days: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        ...ts(),
      });
    }

    // ── di_invoice ─────────────────────────────────────────────────────────
    if (!hasTable('di_invoice')) {
      await queryInterface.createTable('di_invoice', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        invoice_number: { type: S.STRING(40), allowNull: false, unique: true },
        type: { type: S.ENUM('RECHARGE', 'ACTIVATION', 'RENEWAL'), allowNull: false },
        status: { type: S.ENUM('PAID', 'VOID'), allowNull: false, defaultValue: 'PAID' },
        token_type: { type: S.ENUM('PAID', 'TESTING', 'GRACE'), allowNull: false, defaultValue: 'PAID' },
        accountable: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
        client_id: { type: S.INTEGER, allowNull: false },
        issued_by_user_id: { type: S.INTEGER, allowNull: false },
        vehicle_id: { type: S.INTEGER, allowNull: true },
        vehicle_count: { type: S.INTEGER, allowNull: true },
        cycle: { type: S.ENUM('MONTHLY', 'YEARLY'), allowNull: false, defaultValue: 'MONTHLY' },
        cycle_months: { type: S.INTEGER, allowNull: false, defaultValue: 1 },
        period_start: { type: S.DATE, allowNull: true },
        period_end: { type: S.DATE, allowNull: true },
        monthly_price: { type: S.DECIMAL(14, 2), allowNull: false },
        base_amount: { type: S.DECIMAL(14, 2), allowNull: false },
        tax_percent: { type: S.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        tax_amount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        total_amount: { type: S.DECIMAL(14, 2), allowNull: false },
        wallet_transaction_id: { type: S.INTEGER, allowNull: true },
        issuer_snapshot: { type: S.JSON, allowNull: true },
        client_snapshot: { type: S.JSON, allowNull: true },
        vehicle_snapshot: { type: S.JSON, allowNull: true },
        notes: { type: S.STRING(500), allowNull: true },
        ...ts(),
      });
      await queryInterface.addIndex('di_invoice', ['client_id']);
      await queryInterface.addIndex('di_invoice', ['issued_by_user_id']);
      await queryInterface.addIndex('di_invoice', ['vehicle_id']);
    }

    // ── di_invoice_counter ─────────────────────────────────────────────────
    if (!hasTable('di_invoice_counter')) {
      await queryInterface.createTable('di_invoice_counter', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        scope: { type: S.STRING(40), allowNull: false },
        year: { type: S.INTEGER, allowNull: false },
        seq: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        ...ts(),
      });
      await queryInterface.addIndex('di_invoice_counter', ['scope', 'year'], { unique: true });
    }

    // ── system_settings (single row id=1; camelCase columns to match model) ──
    if (!hasTable('system_settings')) {
      await queryInterface.createTable('system_settings', {
        id: { type: S.INTEGER, primaryKey: true, defaultValue: 1 },
        billingEnabled: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        defaultMonthlyPrice: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        defaultTaxPercent: { type: S.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
        createdAt: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.bulkInsert('system_settings', [{
        id: 1, billingEnabled: false, defaultMonthlyPrice: 0, defaultTaxPercent: 0,
        createdAt: new Date(), updatedAt: new Date(),
      }]);
    }

    // ── New columns on existing tables ──────────────────────────────────────
    await addColumnIfMissing('di_user', 'billing_type', {
      type: S.ENUM('prepaid', 'postpaid'), allowNull: false, defaultValue: 'postpaid',
    });
    await addColumnIfMissing('di_user', 'grace_days', {
      type: S.INTEGER, allowNull: false, defaultValue: 0,
    });

    await addColumnIfMissing('di_user_meta', 'gstin', { type: S.STRING(20), allowNull: true });
    await addColumnIfMissing('di_user_meta', 'invoice_tax_percent', { type: S.DECIMAL(5, 2), allowNull: true });
    await addColumnIfMissing('di_user_meta', 'invoice_prefix', { type: S.STRING(12), allowNull: true });
    await addColumnIfMissing('di_user_meta', 'logo_url', { type: S.STRING(500), allowNull: true });

    await addColumnIfMissing('di_user_vehicle', 'subscription_expires_at', { type: S.DATE, allowNull: true });
    await addColumnIfMissing('di_user_vehicle', 'grace_expires_at', { type: S.DATE, allowNull: true });
    await addColumnIfMissing('di_user_vehicle', 'expiry_reminder_sent_at', { type: S.DATE, allowNull: true });
  },

  down: async (queryInterface) => {
    const dropCol = async (table, column) => {
      try { await queryInterface.removeColumn(table, column); } catch (e) { /* already gone */ }
    };
    await dropCol('di_user_vehicle', 'subscription_expires_at');
    await dropCol('di_user_vehicle', 'grace_expires_at');
    await dropCol('di_user_vehicle', 'expiry_reminder_sent_at');
    await dropCol('di_user_meta', 'gstin');
    await dropCol('di_user_meta', 'invoice_tax_percent');
    await dropCol('di_user_meta', 'invoice_prefix');
    await dropCol('di_user_meta', 'logo_url');
    await dropCol('di_user', 'billing_type');
    await dropCol('di_user', 'grace_days');

    for (const t of ['di_invoice', 'di_invoice_counter', 'di_billing_rate', 'di_wallet_transaction', 'di_wallet', 'system_settings']) {
      try { await queryInterface.dropTable(t); } catch (e) { /* already gone */ }
    }
  },
};
