// GET carts with line items
exports.getCarts = async ({ client_id, parent_id }) => {
  const where = {};
  if (client_id) where.client_id = client_id;
  if (parent_id) where.parent_id = parent_id;
  const carts = await Cart.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [{
      model: CartLineItem,
      as: 'line_items',
    }]
  });
  return carts;
};
exports.updateCart = async (payload) => {
  // Validate required fields
  if (!payload.client_id || !payload.parent_id) {
    throw new Error('client_id and parent_id are mandatory');
  }

  const updateFields = {};
  if (payload.status) updateFields.status = payload.status;
  if (payload.last_updated_by) updateFields.last_updated_by = payload.last_updated_by;
  if (payload.transaction_id) updateFields.transaction_id = payload.transaction_id;
  updateFields.updated_at = new Date();

  let whereClause;
  if (payload.request_id) {
    // If request_id is provided, update by id only
    whereClause = { id: payload.request_id };
  } else {
    // Otherwise, use composite keys
    whereClause = {
      client_id: payload.client_id,
      parent_id: payload.parent_id
    };
  }
  const [affectedRows] = await Cart.update(updateFields, {
    where: whereClause
  });
  if (affectedRows === 0) throw new Error('No cart found to update');
  return { success: true };
};
const { Cart, CartLineItem, User } = require('../models');
const { Op } = require('sequelize');

const ALLOWED_STATUSES = ['pending', 'payment_received', 'in_progress', 'completed'];

// BFS down a parent's subtree, returning all descendant user ids
async function collectDescendants(rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await User.findAll({ where: { parent_id: frontier }, attributes: ['id'] });
    const next = [];
    for (const c of children) {
      if (ids.has(c.id)) continue;
      ids.add(c.id);
      next.push(c.id);
    }
    frontier = next;
  }
  return Array.from(ids);
}

exports.getInbox = async ({ user_id }) => {
  const actor = await User.findOne({ where: { id: user_id }, attributes: ['id', 'parent_id'] });
  if (!actor) throw new Error('User not found');

  let whereClause;
  if (!actor.parent_id) {
    // Root / top account (no parent) — sees every request
    whereClause = {};
  } else {
    // Dealer or client — sees only requests where they are the immediate parent
    // (they are the direct dealer for those clients), plus their own requests.
    whereClause = {
      [Op.or]: [
        { parent_id: Number(user_id) },
        { client_id: Number(user_id) },
      ],
    };
  }

  const carts = await Cart.findAll({
    where: whereClause,
    order: [['created_at', 'DESC']],
    include: [{ model: CartLineItem, as: 'line_items' }],
  });

  // Attach client name + immediate dealer name for display
  const clientIds = Array.from(new Set(carts.map(c => c.client_id).filter(Boolean)));
  const parentIds = Array.from(new Set(carts.map(c => c.parent_id).filter(Boolean)));
  const allUserIds = Array.from(new Set([...clientIds, ...parentIds]));
  const users = allUserIds.length
    ? await User.findAll({ where: { id: { [Op.in]: allUserIds } }, attributes: ['id', 'name'], raw: true })
    : [];
  const nameById = {};
  users.forEach(u => { nameById[u.id] = u.name; });

  return carts.map(c => {
    const j = c.toJSON();
    j.client_name = nameById[j.client_id] || null;
    j.dealer_name = nameById[j.parent_id] || null;
    return j;
  });
};

exports.updateStatus = async ({ cart_id, status, actor_user_id }) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    const err = new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const actor = await User.findOne({ where: { id: actor_user_id }, attributes: ['id', 'parent_id'] });
  if (!actor) {
    const err = new Error('Actor user not found.');
    err.statusCode = 404;
    throw err;
  }
  if (actor.parent_id) {
    const err = new Error('Only the root operations account can update request status.');
    err.statusCode = 403;
    throw err;
  }
  const cart = await Cart.findOne({ where: { id: cart_id } });
  if (!cart) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    throw err;
  }
  await cart.update({ status, last_updated_by: 'admin', updated_at: new Date() });
  return cart;
};

exports.createCart = async (payload) => {
  // Validate mandatory fields
  if (!payload.client_id || !payload.parent_id) {
    throw new Error('client_id and parent_id are mandatory');
  }

  // Log incoming payload for debugging
  console.table([payload]);

  // Create only one cart record per request
  const created = await Cart.create({
    client_id: payload.client_id,
    parent_id: payload.parent_id,
    request_type: payload.request_type || null,
    item_count: Array.isArray(payload.line_items) ? payload.line_items.length : 0,
    transaction_id: payload.transaction_id || null,
    last_updated_by: payload.last_updated_by || null,
    status: payload.status || 'pending',
    created_at: payload.created_at || new Date(),
    updated_at: payload.updated_at || new Date(),
  });

  // Log created cart for debugging
  console.table([created.toJSON()]);

  // Insert line items into CartLineItem table
  if (Array.isArray(payload.line_items)) {
    for (const item of payload.line_items) {
      await CartLineItem.create({
        cart_id: created.id,
        vehicle_number: item.vehicle_number,
        challan_number: item.challan_number,
        challan_type: item.challan_type,
        challan_amount: item.challan_amount,
        discount: item.discount,
        discount_code: item.discount_code,
        service_fee: item.service_fee,
        gst_percent: item.gst_percent,
        gst_amt: item.gst_amt,
        created_at: payload.created_at || new Date(),
        updated_at: payload.updated_at || new Date(),
      });
    }
  }

  return created;
};
