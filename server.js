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
  Cart,
  UserBilling,
  ClientNotification,
  VehicleReport,
} = require('./models');
const { DiDriverData } = require('./models');

// Setup associations (if not already set)
if (!User.associations.meta) {
  User.hasOne(UserMeta, { foreignKey: 'user_id', as: 'meta' });
  UserMeta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

if (!User.associations.billing) {
  User.hasOne(UserBilling, { foreignKey: 'user_id', as: 'billing' });
  UserBilling.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

const { UserOptions } = require('./models');

const models = {
  User, UserMeta, UserVehicle, UserVehicles, UserSettings,
  UserVehicleRtoData, VehicleRTOData, VehicleChallan, Cart, UserBilling,
  ClientNotification, VehicleReport, UserOptions,
};

models.DiDriverData = DiDriverData;

const app = express();

// Apply security and middleware
app.locals.models = models;
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://app.smartchallan.com',
    'http://app.smartchallan.com', 
    'https://smartchallan.technoton.co.in', 
    'http://smartchallan.technoton.co.in', 
    'https://stage.smartchallan.com',
    'http://challan.nigraani.com',
    'https://challan.nigraani.com',
    'https://globalafs.smartchallan.com',
    'http://globalafs.smartchallan.com',
    'https://challan.eyeonfleet.com',
    'http://challan.eyeonfleet.com',
    'https://smartchallan.vt4india.com',
    'http://smartchallan.vt4india.com'
  ],
  credentials: true
}));

// Health check route
app.get('/ping', (req, res) => res.send('pong'));

// Log all incoming requests
app.use((req, res, next) => {
  console.table({ method: req.method, url: req.url, body: req.body });
  next();
});

// JWT auth — runs on every route except the public allowlist in the middleware
const validateClient = require('./middleware/validateClient');
app.use(validateClient);

// Routers

// Scheduled jobs
require('./jobs/vehicleEChallanBatchScheduler');
require('./jobs/dailyChallanNotifyScheduler');
require('./jobs/vehicleRTOBatchScheduler');
// Load expired insurance notification scheduler
require('./jobs/expiredInsuranceNotificationScheduler');
// Trial account expiry reminders and deactivation
require('./jobs/trialAccountScheduler');

// Register update vehicle status route
const updateVehicleRouter = require('./routes/updateVehicle')(models);
const authRouter = require('./routes/auth');
const countRouter = require('./routes/count');
const vehicleRTORouter = require('./routes/vehicleRTO');
const vehicleRTOBatchRouter = require('./routes/vehicleRTOBatch');
const vehicleEChallanRouter = require('./routes/vehicleEChallan');
const vehicleEChallanBatchRouter = require('./routes/vehicleEChallanBatch');
const driverDataRouter = require('./routes/driverData');
const fastagDataRouter = require('./routes/fastagData');
const saveDriveDataRouter = require('./routes/saveDriveData')(models);
const fetchDriverRouter = require('./routes/fetchDriver')(models);
const deleteDriverRouter = require('./routes/deleteDriver')(models);
const userVehicleRouter = require('./routes/userVehicle')(UserVehicle, models);
const userVehicleRtoDataRouter = require('./routes/userVehicleRtoData')(UserVehicleRtoData);
const adminDataRouter = require('./routes/adminData')(models);
const clientDataRouter = require('./routes/clientData')(models);
const dealerDataRouter = require('./routes/dealerData')(models);
const vehicleRTODataRouter = require('./routes/vehicleRTOData')(models);
const userBillingSettingRouter = require('./routes/userBillingSetting')(models);
const userProfileServiceRouter = require('./routes/userProfileService')(models);
const vehicleSummaryRouter = require('./routes/vehicleSummary');
const userOptionsRouter = require('./routes/userOptions');
const testEmailRouter = require('./routes/testEmail');
const sendEmailRouter = require('./routes/sendEmail');
const cartRouter = require('./routes/cart');
const userMetaRouter = require('./routes/userMeta')(models);
const vehicleReportRouter = require('./routes/getVehicleReport');
const vehicleReportNewRouter = require('./routes/vehicleReport');
const userNotificationEmailRouter = require('./routes/userNotificationEmail');
const getClientNetworkRouter = require('./routes/getClientNetwork');
const userActivityRouter = require('./routes/userActivity');

const getNetworkStatsRouter = require('./routes/getNetworkStats');
const notificationsRouter = require('./routes/notifications')(models);
const masterSearchRouter = require('./routes/masterSearch')(models);
const jobLastRunRouter = require('./routes/jobLastRun')(models);

app.use('/auth', authRouter);
app.use('/stats/', countRouter);
app.use('/', userBillingSettingRouter);
app.use('/userprofile', userProfileServiceRouter);
app.use('/vehiclesummary', vehicleSummaryRouter);
app.use('/updatevehiclestatus', updateVehicleRouter);
app.use('/useroptions', userOptionsRouter);
app.use('/testemail', testEmailRouter);
app.use('/sendemail', sendEmailRouter);
app.use('/cart', cartRouter);
app.use('/usermeta', userMetaRouter);
app.use('/usernotificationemail', userNotificationEmailRouter);
app.use('/saveuseractivity', userActivityRouter);

// New endpoint - get client network (separate module)
app.use('/getclientnetwork', getClientNetworkRouter);
app.use('/notifications', notificationsRouter);

// New endpoint - get network stats
app.use('/getnetworkstats', getNetworkStatsRouter);

// Master search across dealer network
app.use('/master-search', masterSearchRouter);

// Last successful run time of the RTO / challan background jobs
app.use('/joblastrun', jobLastRunRouter);

app.use('/getvehiclereport', vehicleReportRouter);
app.use('/vehiclereport', vehicleReportNewRouter);

// ULIP Services
app.use('/getvehiclertodata', vehicleRTORouter);
app.use('/getvehiclertodata/batch', vehicleRTOBatchRouter);
app.use('/getvehicleechallandata', vehicleEChallanRouter);
app.use('/getvehicleechallandata/batch', vehicleEChallanBatchRouter);
app.use('/getdriverdata', driverDataRouter);
app.use('/getvehiclefastagdata', fastagDataRouter);
app.use('/savedrivedata', saveDriveDataRouter);
app.use('/fetchdriver', fetchDriverRouter);
app.use('/deletedriver', deleteDriverRouter);
app.use('/uservehicle', userVehicleRouter);
app.use('/userrtodata', userVehicleRtoDataRouter);
app.use('/admindata', adminDataRouter);
app.use('/clientdata', clientDataRouter);
app.use('/dealerdata', dealerDataRouter);

// DB connection check
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection established successfully.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to database:', err);
  });

// ---- Server Configuration ----
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SSL_DIR = '/etc/letsencrypt/live/server.smartchallan.com';
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

// Check if we're in production and SSL certificates are available
if (NODE_ENV === 'production') {
  let httpsOptions;
  
  try {
    httpsOptions = {
      key: fs.readFileSync(path.join(SSL_DIR, 'privkey.pem')),
      cert: fs.readFileSync(path.join(SSL_DIR, 'fullchain.pem'))
    };
    
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
    
  } catch (error) {
    console.error('❌ SSL certificate not found. Please ensure certificates are present in', SSL_DIR);
    console.log('⚠️  Falling back to HTTP server...');
    
    // Fallback to HTTP in production if SSL fails
    app.listen(PORT, () => {
      console.log(`🚀 HTTP Server running on port ${PORT}`);
    });
  }
} else {
  // Development mode - use HTTP only
  app.listen(PORT, () => {
    console.log(`🚀 Development server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
  });
}

