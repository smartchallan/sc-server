const { Op } = require('sequelize');

async function getDealerData(models, dealer_id) {
  const { User, UserBilling, UserMeta } = models;

  if (!dealer_id) {
    throw new Error('dealer_id is required');
  }

  try {
    // Get all clients for the dealer with their billing and meta data
    const clients = await User.findAll({
      where: {
        dealer_id: dealer_id,
        role: 'client' // Assuming you want only client type users
      },
      include: [
        {
          model: UserBilling,
          required: false, // Left join - include clients even without billing data
          as: 'billing'
        },
        {
          model: UserMeta,
          required: false, // Left join - include clients even without meta data
          as: 'meta'
        }
      ],
      order: [['created_at', 'DESC']] // Most recent clients first
    });

    if (clients.length === 0) {
      return {
        success: true,
        message: 'No clients found for this dealer',
        data: []
      };
    }

    return {
      success: true,
      message: `Found ${clients.length} clients for dealer ${dealer_id}`,
      data: clients
    };

  } catch (error) {
    console.error('Error in getDealerData:', error);
    throw new Error(`Failed to fetch dealer data: ${error.message}`);
  }
}

module.exports = {
  getDealerData
};