// services/userVehicleService.js
module.exports = (UserVehicle) => {
  /**
   * Get user vehicles by admin_id, dealer_id, or client_id
   * @param {Object} params - Query params: admin_id, dealer_id, client_id
   * @returns {Promise<Array>} - Array of vehicles
   */
  async function getUserVehicles(params) {
    const { admin_id, dealer_id, client_id } = params;
    let where = {};
    if (admin_id) {
      where.admin_id = admin_id;
    } else if (dealer_id) {
      where.dealer_id = dealer_id;
    } else if (client_id) {
      where.client_id = client_id;
    } else {
      throw new Error('At least one of admin_id, dealer_id, or client_id must be provided');
    }
    return await UserVehicle.findAll({ where });
  }

  return {
    getUserVehicles
  };
};
