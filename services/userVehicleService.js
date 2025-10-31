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

  /**
   * Register a new vehicle after checking duplicates by vehicle_number and client_id
   * @param {Object} payload - vehicle fields: vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id
   * @returns {Promise<Object>} - { message, vehicle }
   */
  async function registerVehicle(payload) {
    const {
      vehicle_number,
      chasis_number,
      engine_number,
      client_id,
      dealer_id,
      admin_id
    } = payload || {};

    // Normalize vehicle number to avoid case/spacing duplicates
    const normalizedVehicleNumber = vehicle_number ? vehicle_number.trim().toUpperCase() : null;

    // Basic validation
    if (!vehicle_number && !chasis_number && !engine_number) {
      throw new Error('At least one of vehicle_number, chasis_number, or engine_number is required.');
    }
    if (!client_id || !dealer_id || !admin_id) {
      throw new Error('client_id, dealer_id, and admin_id are required.');
    }

    // If vehicle_number provided, check duplicate for same client_id (use normalized value)
    if (normalizedVehicleNumber) {
      const existing = await UserVehicle.findOne({
        where: {
          vehicle_number: normalizedVehicleNumber,
          client_id
        }
      });
      if (existing) {
        // Match user's requested message text (note: spelling preserved)
        return { message: 'vehicle already registered' };
      }
    }

    const vehicle = await UserVehicle.create({
      vehicle_number: normalizedVehicleNumber || vehicle_number,
      chasis_number,
      engine_number,
      client_id,
      dealer_id,
      admin_id,
      status: 'active'
    });

    return { message: 'Vehicle registered successfully', vehicle };
  }

  return {
    getUserVehicles,
    registerVehicle
  };
};
