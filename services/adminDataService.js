// services/adminDataService.js

module.exports = async function fetchAdminData(models, adminId) {
  const { User, UserMeta, UserVehicle } = models;

  // Fetch admin user and meta
  const admin = await User.findOne({
    where: { id: adminId, role: 'admin' },
    attributes: { exclude: ['password'] },
    include: [{
      model: UserMeta,
      as: 'meta',
      required: false
    }]
  });

  // Fetch all dealers for the admin, include meta info
  const dealers = await User.findAll({
    where: { role: 'dealer', admin_id: adminId },
    attributes: { exclude: ['password'] },
    include: [{
      model: UserMeta,
      as: 'meta',
      required: false
    }]
  });

  // Fetch all clients for the admin, include meta info
  const clients = await User.findAll({
    where: { role: 'client', admin_id: adminId },
    attributes: { exclude: ['password'] },
    include: [{
      model: UserMeta,
      as: 'meta',
      required: false
    }]
  });

  // Fetch all vehicles for the admin
  const vehicles = await UserVehicle.findAll({
    where: { admin_id: adminId }
  });

  // Logging for audit
  console.table([
    { type: 'admin', found: !!admin },
    { type: 'dealers', count: dealers.length },
    { type: 'clients', count: clients.length },
    { type: 'vehicles', count: vehicles.length }
  ]);

  return {
    admin,
    dealers,
    clients,
    vehicles
  };
};
