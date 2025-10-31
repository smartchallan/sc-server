require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const consoleTable = require('console.table');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const {
  sequelize,
  User,
  UserMeta,
  UserVehicle,
  UserVehicles,
  UserSettings,
  UserVehicleRtoData,
  VehicleRTOData,
  VehicleChallan,
  UserBilling
} = require('./models');

// Setup association for User <-> UserMeta (if not already set)
if (!User.associations.meta) {
  User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
  UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

const models = { 
  User, UserMeta, UserVehicle, UserVehicles, UserSettings, 
  UserVehicleRtoData, VehicleRTOData, VehicleChallan, UserBilling 
};

const app = express();

// Apply security and middleware
app.locals.models = models;
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'https://app.smartchallan.com'],
  credentials: true
}));

// Health check route
app.get('/ping', (req, res) => res.send('pong'));

// Log all incoming requests
app.use((req, res, next) => {
  console.table({ method: req.method, url: req.url, body: req.body });
  next();
});

// Routers
const updateVehicleRouter = require('./routes/updateVehicle')(models);
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

// Application routes
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
app.use('/uservehicle', userVehicleRouter);
app.use('/userrtodata', userVehicleRtoDataRouter);
app.use('/admindata', adminDataRouter);
app.use('/clientdata', clientDataRouter);

// DB connection check
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to database:', err);
  });

// ---- SSL Configuration ----
const SSL_DIR = '/etc/letsencrypt/live/server.smartchallan.com';
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

let httpsOptions;

try {
  httpsOptions = {
    key: fs.readFileSync(path.join(SSL_DIR, 'privkey.pem')),
    cert: fs.readFileSync(path.join(SSL_DIR, 'fullchain.pem'))
  };
} catch (error) {
  console.error('❌ SSL certificate not found. Please ensure certificates are present in', SSL_DIR);
  process.exit(1);
}

// ---- Create HTTPS Server ----
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`🚀 HTTPS Server running at https://server.smartchallan.com`);
});

// ---- Create HTTP -> HTTPS Redirect Server ----
http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP redirect running on port ${HTTP_PORT}`);
});

