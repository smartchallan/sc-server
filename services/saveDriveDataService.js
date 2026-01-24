module.exports = (models) => {
  return {
    saveDriverData: async (payload) => {
      const license_no = payload.licenseNo || payload.license_no;
      const dob = payload.dob || null;
      const details = payload.details || null;

      const record = await models.DiDriverData.create({
        license_no,
        dob,
        details
      });

      return record;
    }
  };
};
