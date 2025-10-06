// Router requires (add before app.use calls)
const authRouter = require('./routes/auth');
const dealersRouter = require('./routes/dealers');
const countRouter = require('./routes/count');
// ...existing code...
const vehicleRTORouter = require('./routes/vehicleRTO');
const vehicleEChallanRouter = require('./routes/vehicleEChallan');
const driverDataRouter = require('./routes/driverData');
const fastagDataRouter = require('./routes/fastagData');

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const consoleTable = require('console.table');
const cors = require('cors');

// PostgreSQL connection
const sequelize = new Sequelize(
  process.env.PG_DATABASE,
  process.env.PG_USER,
  process.env.PG_PASSWORD,
  {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: process.env.PG_SSL === 'false' ? {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      }
    } : {},
  }
);

// Initialize models once
const UserModel = require('./models/user');
const UserMetaModel = require('./models/user_meta');
const UserVehicleModel = require('./models/userVehicle');
const UserVehiclesModel = require('./models/user_vehicles');
const UserSettingsModel = require('./models/user_settings');
const UserVehicleRtoDataModel = require('./models/userVehicleRtoData');


const User = UserModel(sequelize);
const UserMeta = UserMetaModel(sequelize);
const UserVehicle = UserVehicleModel(sequelize);
const UserVehicles = UserVehiclesModel(sequelize);
const UserSettings = UserSettingsModel(sequelize);
const UserVehicleRtoData = UserVehicleRtoDataModel(sequelize);

// Setup association for User <-> UserMeta
if (!User.associations.meta) {
  User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
  UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

const VehicleRTODataModel = require('./models/vehicle_rto_data');
const VehicleRTOData = VehicleRTODataModel(sequelize);
const models = { User, UserMeta, UserVehicle, UserVehicles, UserSettings, UserVehicleRtoData, VehicleRTOData };

// Routers that depend on models (must be initialized after models)
const userVehicleRouter = require('./routes/userVehicle')(UserVehicle);
const userVehicleRtoDataRouter = require('./routes/userVehicleRtoData')(UserVehicleRtoData);
const adminDataRouter = require('./routes/adminData')(models);
const clientDataRouter = require('./routes/clientData')(models);
const vehicleRTODataRouter = require('./routes/vehicleRTOData')(models);

// ...existing code...

const app = express();
app.use(express.json());
app.use(helmet());


sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to PostgreSQL:', err);
  });

// Sequelize models (already initialized above)
// (User, UserMeta, UserVehicle, UserVehicles, UserSettings, UserVehicleRtoData already initialized above)

// UserBilling model
const UserBillingModel = require('./models/user_billing');
const UserBilling = UserBillingModel(sequelize);

// Add UserBilling to models object
models.UserBilling = UserBilling;

// UserBillingSetting route
const userBillingSettingRouter = require('./routes/userBillingSetting')(models);

// UserProfileService route
const userProfileServiceRouter = require('./routes/userProfileService')(models);

// Helper: Encrypt PII
function encryptPII(data) {
  // Example: hash email, phone, address
  if (data.email) data.email = bcrypt.hashSync(data.email, 10);
  if (data.phone) data.phone = bcrypt.hashSync(data.phone, 10);
  if (data.address) data.address = bcrypt.hashSync(data.address, 10);
  return data;
}

// Logging middleware
app.use((req, res, next) => {
  console.table({ method: req.method, url: req.url, body: req.body });
  next();
});


// Application Endpoints
app.use('/auth', authRouter);

// app.use('/trackvehicle', vehicleDataRouter);
app.use('/dealers', dealersRouter);
app.use('/stats/', countRouter);
app.use('/', userBillingSettingRouter);
app.use('/', userProfileServiceRouter);



// ULIP Services

//route to get data from VAHAN services
app.use('/getvehiclertodata', vehicleRTORouter);
// ...existing code...

//route to get data from E-CHALLAN services
app.use('/getvehicleechallandata', vehicleEChallanRouter);

//route to get data from SARTHI services
app.use('/getdriverdata', driverDataRouter);

//route to get data from FASTAG services
app.use('/getvehiclefastagdata', fastagDataRouter);


// app.use('/getulipdata', vehicleUlipRouter);
// ULIP Services end

app.use('/uservehicle', userVehicleRouter);

// route to store and get vehicle RTO data from database
app.use('/userrtodata', userVehicleRtoDataRouter);
app.use('/admindata', adminDataRouter);
app.use('/clientdata', clientDataRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



