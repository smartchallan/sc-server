module.exports = (models) => {
  return {
    saveDriverData: async (payload) => {
      const license_no = payload.licenseNo || payload.license_no;
      const client_id = payload.client_id || payload.clientId || null;
      const dob = payload.dob || null;
      const details = payload.details || null;

      if (!client_id) {
        const err = new Error('client_id is required');
        err.status = 400;
        throw err;
      }

      const record = await models.DiDriverData.create({
        license_no,
        client_id,
        dob,
        details
      });

      return record;
    }
  };
};
