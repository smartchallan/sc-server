const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const ISSUER = process.env.JWT_ISSUER || 'smartchallan-server';

if (!SECRET) {
  throw new Error('JWT_SECRET is not set in environment');
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN, issuer: ISSUER });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { issuer: ISSUER });
}

module.exports = { signToken, verifyToken };
