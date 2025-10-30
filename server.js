require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const consoleTable = require('console.table');
const bcrypt = require('bcryptjs');

const { sequelize, User, UserMeta, UserVehicle, UserVehicles, UserSettings, UserVehicleRtoData, VehicleRTOData, VehicleChallan, UserBilling } = require('./models');

// Setup association for User <-> UserMeta (if not already set)
if (!User.associations.meta) {
  User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
  UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

const models = { User, UserMeta, UserVehicle, UserVehicles, UserSettings, UserVehicleRtoData, VehicleRTOData, VehicleChallan, UserBilling };

const app = express();

app.locals.models = models;
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'https://app.smartchallan.com'],
  credentials: true
}));

// Health check route for diagnostics
app.get('/ping', (req, res) => res.send('pong'));

// Logging middleware
app.use((req, res, next) => {
  console.table({ method: req.method, url: req.url, body: req.body });
  next();
});

// Routers

// Register update vehicle status route
const  updateVehicleRouter = require('./routes/updateVehicle')(models);
const authRouter = require('./routes/auth');
const dealersRouter = require('./routes/dealers');
const countRouter = require('./routes/count');
const vehicleRTORouter = require('./routes/vehicleRTO');
const vehicleEChallanRouter = require('./routes/vehicleEChallan');
const driverDataRouter = require('./routes/driverData');
const fastagDataRouter = require('./routes/fastagData');
const userVehicleRouter = require('./routes/userVehicle')(UserVehicle);
const userVehicleRtoDataRouter = require('./routes/userVehicleRtoData')(UserVehicleRtoData);
const adminDataRouter = require('./routes/adminData')(models);
const clientDataRouter = require('./routes/clientData')(models);
const vehicleRTODataRouter = require('./routes/vehicleRTOData')(models);
const userBillingSettingRouter = require('./routes/userBillingSetting')(models);
const userProfileServiceRouter = require('./routes/userProfileService')(models);

// Application Endpoints
app.use('/auth', authRouter);
app.use('/dealers', dealersRouter);
app.use('/stats/', countRouter);
app.use('/', userBillingSettingRouter);
app.use('/', userProfileServiceRouter);
app.use('/updatevehiclestatus', updateVehicleRouter);


// ULIP Services
app.use('/getvehiclertodata', vehicleRTORouter);
app.use('/getvehicleechallandata', vehicleEChallanRouter);
app.use('/getdriverdata', driverDataRouter);
app.use('/getvehiclefastagdata', fastagDataRouter);
// app.use('/getulipdata', vehicleUlipRouter);

app.use('/uservehicle', userVehicleRouter);
app.use('/userrtodata', userVehicleRtoDataRouter);
app.use('/admindata', adminDataRouter);
app.use('/clientdata', clientDataRouter);

// DB connection check
sequelize.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to database:', err);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



