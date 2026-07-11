'use strict';

/**
 * Challan settlement module — chain approval + PayU gateway.
 *
 * Creates:
 *   - di_payments        : PayU (or other gateway) payment attempts per request
 *   - di_cart_approvals  : the bottom-to-top approval chain for a request
 * and adds settlement columns onto di_cart:
 *   - total_amount, top_account_id, current_approver_id
 *
 * Every step is guarded (checks table/column existence first) so the migration
 * is safe to re-run. Apply with:  node run-settlement-migration.js
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const S = Sequelize;

    const existingTables = (await queryInterface.showAllTables()).map((t) =>
      (typeof t === 'string' ? t : t.tableName).toLowerCase()
    );
    const hasTable = (name) => existingTables.includes(name.toLowerCase());

    const addColumnIfMissing = async (table, column, spec) => {
      if (!hasTable(table)) return;
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, spec);
    };

    // ── di_payments ─────────────────────────────────────────────────────────
    if (!hasTable('di_payments')) {
      await queryInterface.createTable('di_payments', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        cart_id: { type: S.INTEGER, allowNull: false },
        user_id: { type: S.INTEGER, allowNull: false },
        gateway: { type: S.STRING(20), allowNull: false, defaultValue: 'payu' },
        txnid: { type: S.STRING(64), allowNull: false, unique: true },
        mihpayid: { type: S.STRING(64), allowNull: true },
        amount: { type: S.FLOAT, allowNull: false },
        productinfo: { type: S.STRING(255), allowNull: true },
        firstname: { type: S.STRING(150), allowNull: true },
        email: { type: S.STRING(150), allowNull: true },
        phone: { type: S.STRING(20), allowNull: true },
        status: { type: S.ENUM('initiated', 'success', 'failure', 'pending'), allowNull: false, defaultValue: 'initiated' },
        payu_mode: { type: S.STRING(20), allowNull: true },
        bank_ref_num: { type: S.STRING(64), allowNull: true },
        error_code: { type: S.STRING(64), allowNull: true },
        error_message: { type: S.STRING(255), allowNull: true },
        request_hash: { type: S.TEXT, allowNull: true },
        response: { type: S.JSON, allowNull: true },
        return_origin: { type: S.STRING(255), allowNull: true },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('di_payments', ['cart_id']);
      await queryInterface.addIndex('di_payments', ['user_id']);
    }

    // ── di_cart_approvals ───────────────────────────────────────────────────
    if (!hasTable('di_cart_approvals')) {
      await queryInterface.createTable('di_cart_approvals', {
        id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
        cart_id: { type: S.INTEGER, allowNull: false },
        approver_id: { type: S.INTEGER, allowNull: false },
        approver_name: { type: S.STRING(150), allowNull: true },
        level: { type: S.INTEGER, allowNull: false },
        is_top: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
        status: { type: S.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
        note: { type: S.STRING(500), allowNull: true },
        acted_at: { type: S.DATE, allowNull: true },
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('di_cart_approvals', ['cart_id']);
      await queryInterface.addIndex('di_cart_approvals', ['approver_id']);
    }

    // ── New columns on di_cart ──────────────────────────────────────────────
    await addColumnIfMissing('di_cart', 'total_amount', { type: S.FLOAT, allowNull: true });
    await addColumnIfMissing('di_cart', 'top_account_id', { type: S.INTEGER, allowNull: true });
    await addColumnIfMissing('di_cart', 'current_approver_id', { type: S.INTEGER, allowNull: true });
  },

  down: async (queryInterface) => {
    const dropCol = async (table, column) => {
      try { await queryInterface.removeColumn(table, column); } catch (e) { /* already gone */ }
    };
    await dropCol('di_cart', 'total_amount');
    await dropCol('di_cart', 'top_account_id');
    await dropCol('di_cart', 'current_approver_id');
    for (const t of ['di_cart_approvals', 'di_payments']) {
      try { await queryInterface.dropTable(t); } catch (e) { /* already gone */ }
    }
  },
};
