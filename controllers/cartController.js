// GET /cart
exports.get = async (req, res) => {
  try {
    const { client_id, parent_id } = req.query;
    const carts = await cartService.getCarts({ client_id, parent_id });
    res.json({ success: true, data: carts });
  } catch (err) {
    console.error('Error fetching carts:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// GET /cart/inbox?user_id=X
// Returns every cart whose client is a descendant of user_id (anywhere in the subtree).
// Each row is decorated with client_name and parent (dealer) name for display.
exports.inbox = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }
    const carts = await cartService.getInbox({ user_id });
    res.json({ success: true, data: carts });
  } catch (err) {
    console.error('Error fetching cart inbox:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// PATCH /cart/:id/status — root operations only (caller must have no parent)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actor_user_id } = req.body;
    if (!status || !actor_user_id) {
      return res.status(400).json({ success: false, error: 'status and actor_user_id are required' });
    }
    const result = await cartService.updateStatus({ cart_id: id, status, actor_user_id });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error updating cart status:', err);
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    const payload = req.body;
    console.table([payload]);
    const result = await cartService.updateCart(payload);
    console.table([result]);
    res.json(result);
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};
const cartService = require('../services/cartService');

exports.create = async (req, res) => {
  try {
    const payload = req.body;
    const created = await cartService.createCart(payload);

    // Prepare order details as array of objects for email template
    let orderDetails = [];
    if (Array.isArray(payload.line_items)) {
      orderDetails = payload.line_items.map(item => ({
        vehicle_number: item.vehicle_number,
        challan_number: item.challan_number,
        challan_type: item.challan_type,
        challan_amount: item.challan_amount,
        service_fee: item.service_fee,
        gst_percent: item.gst_percent,
        gst_amt: item.gst_amt,
        discount: item.discount
      }));
    }

    // Send email notification to admin and client
    // const { sendOrderNotificationEmail } = require('../services/emailService');
    // try {
    //   const clientEmail = payload.client_email || process.env.FALLBACK_CLIENT_EMAIL;
    //   const adminEmail = process.env.ADMIN_EMAIL || process.env.FALLBACK_ADMIN_EMAIL;
    //   if (!clientEmail && !adminEmail) {
    //     throw new Error('No recipients defined for order notification email');
    //   }
    //   await sendOrderNotificationEmail({
    //     clientEmail,
    //     adminEmail,
    //     clientName: payload.client_name || 'Client',
    //     orderDetails
    //   });
    // } catch (emailErr) {
    //   console.error('Error sending order notification email:', emailErr);
    // }

    res.json({ success: true, data: created });
  } catch (err) {
    console.error('Error creating cart:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};
