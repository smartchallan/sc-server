require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const consoleTable = require('console.table');
const cors = require('cors');

// Sequelize models
const UserModel = require('./models/user');
const UserMetaModel = require('./models/user_meta');
const UserSettingsModel = require('./models/user_settings');
const UserVehiclesModel = require('./models/user_vehicles');
// Mongoose model
const VehicleData = require('./mongoose/vehicle_data');
const dealersRouter = require('./routes/dealers');

const vehicleDataRouter = require('./routes/vehicleData');
const vehicleUlipRouter = require('./routes/vehicle');
const authRouter = require('./routes/auth');
const countRouter = require('./routes/count');

const app = express();

// Allow CORS from anywhere
app.use(cors());

app.use(express.json());
app.use(helmet());

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

sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to PostgreSQL:', err);
  });

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/driveinnovate', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('MongoDB connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to MongoDB:', err);
  });

// Initialize models
const User = UserModel(sequelize);
const UserMeta = UserMetaModel(sequelize);
const UserSettings = UserSettingsModel(sequelize);
const UserVehicles = UserVehiclesModel(sequelize);

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

app.use('/vehicle-data', vehicleDataRouter);
app.use('/auth', authRouter);
app.use('/dealers', dealersRouter);
app.use('/stats/', countRouter);
app.use('/challan', vehicleUlipRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



