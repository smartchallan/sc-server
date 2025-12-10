// GET /cart
exports.get = async (req, res) => {
  try {
    const { client_id, dealer_id, admin_id } = req.query;
    const carts = await cartService.getCarts({ client_id, dealer_id, admin_id });
    res.json({ success: true, data: carts });
  } catch (err) {
    console.error('Error fetching carts:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    const payload = req.body;
    const result = await cartService.updateCart(payload);
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
    const { sendOrderNotificationEmail } = require('../services/emailService');
    try {
      const clientEmail = payload.client_email || process.env.FALLBACK_CLIENT_EMAIL;
      const adminEmail = process.env.ADMIN_EMAIL || process.env.FALLBACK_ADMIN_EMAIL;
      if (!clientEmail && !adminEmail) {
        throw new Error('No recipients defined for order notification email');
      }
      await sendOrderNotificationEmail({
        clientEmail,
        adminEmail,
        clientName: payload.client_name || 'Client',
        orderDetails
      });
    } catch (emailErr) {
      console.error('Error sending order notification email:', emailErr);
    }

    res.json({ success: true, data: created });
  } catch (err) {
    console.error('Error creating cart:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};
