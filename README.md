# DriveInnovate App Server

This is a Node.js Express backend that connects to both PostgreSQL (via Sequelize ORM) and MongoDB (via Mongoose ORM).

## Features
- User, Dealer, Client, Team, Vehicle management (PostgreSQL)
- Vehicle data retrieval (MongoDB)
- Secure communications (helmet, bcryptjs, environment variables)
- PII encryption and secure handling
- Logging with console.table for all requests and responses

## Setup
1. Install dependencies: `npm install`
2. Configure your `.env` file for database credentials
3. Run migrations: `npx sequelize-cli db:migrate`
4. Start the server: `npm start`

## API Endpoints
- Get all dealers, clients, clients by dealer
- Register dealer, client, team
- Get vehicle data by vehicle_no and imei_no

## Security
- All sensitive data is encrypted
- Communications are secured

## Logging
- All incoming requests and outgoing responses are logged using `console.table`

## Contribution
Feel free to contribute by opening issues or pull requests.
