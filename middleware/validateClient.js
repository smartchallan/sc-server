const { verifyToken } = require('../utils/jwt');

// Paths that don't require a JWT. Matched against req.path on the mounted prefix
// (i.e. after app-level middleware; compared with req.originalUrl).
const PUBLIC_PATHS = [
  '/ping',
  '/auth/login',
  '/auth/register',
  // PayU posts its payment result back here without our JWT (server-to-browser redirect).
  '/settlement/payu/callback/success',
  '/settlement/payu/callback/failure',
];

function isPublic(req) {
  const url = (req.originalUrl || req.url || '').split('?')[0];
  return PUBLIC_PATHS.some(p => url === p || url.startsWith(p + '/'));
}

function validateClient(req, res, next) {
  if (isPublic(req)) return next();

  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Empty bearer token' });
  }

  try {
    const decoded = verifyToken(token);
    req.client = decoded;
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({ error: code, message: err.message });
  }
}

module.exports = validateClient;
module.exports.PUBLIC_PATHS = PUBLIC_PATHS;
