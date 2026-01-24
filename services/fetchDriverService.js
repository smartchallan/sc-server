module.exports = (models) => {
  return {
    fetchByClient: async (client_id) => {
      if (!client_id) {
        const err = new Error('client_id is required');
        err.status = 400;
        throw err;
      }

      const records = await models.DiDriverData.findAll({ where: { client_id } });
      return records;
    }
  };
};
