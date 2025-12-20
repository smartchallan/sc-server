// GET carts with line items
exports.getCarts = async ({ client_id, dealer_id, admin_id }) => {
  const where = {};
  if (client_id) where.client_id = client_id;
  if (dealer_id) where.dealer_id = dealer_id;
  if (admin_id) where.admin_id = admin_id;
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
  if (!payload.client_id || !payload.dealer_id || !payload.admin_id) {
    throw new Error('client_id, dealer_id and admin_id are mandatory');
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
      dealer_id: payload.dealer_id,
      admin_id: payload.admin_id
    };
  }
  const [affectedRows] = await Cart.update(updateFields, {
    where: whereClause
  });
  if (affectedRows === 0) throw new Error('No cart found to update');
  return { success: true };
};
const { Cart } = require('../models');
const { CartLineItem } = require('../models');

exports.createCart = async (payload) => {
  // Validate mandatory fields
  if (!payload.client_id || !payload.dealer_id || !payload.admin_id) {
    throw new Error('client_id, dealer_id and admin_id are mandatory');
  }

  // Log incoming payload for debugging
  console.table([payload]);

  // Create only one cart record per request
  const created = await Cart.create({
    client_id: payload.client_id,
    dealer_id: payload.dealer_id,
    admin_id: payload.admin_id,
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
