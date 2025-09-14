// services/userVehicleRtoDataService.js
module.exports = (UserVehicleRtoData) => {
  /**
   * Store vehicle RTO data in the database
   * @param {Object} rtoData - The RTO data object matching the UserVehicleRtoData model
   * @returns {Promise<Object>} - The created record
   */
  async function storeRtoData(rtoData) {
    try {
      const created = await UserVehicleRtoData.create(rtoData);
      return created;
    } catch (error) {
      throw new Error('Failed to store RTO data: ' + error.message);
    }
  }

  return {
    storeRtoData
  };
};
