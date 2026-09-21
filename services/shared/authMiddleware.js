/**
 * authMiddleware.js — Cognito JWT verification
 *
 * Verifies the Cognito JWT signature against the User Pool's JWKS endpoint,
 * then extracts `sub` as the userId. Uses the `jsonwebtoken` + `jwks-rsa`
 * libraries (no AWS SDK required — JWKS is a public HTTPS endpoint).
 *
 * Usage:
 *   const { verifyToken } = require('../shared/authMiddleware');
 *   const { userId } = await verifyToken(event.headers.Authorization);
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION;

if (!USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID environment variable is required');
}

const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600_000, // 10 minutes
  rateLimit: true,
});

/**
 * Retrieve the signing key for a given JWT key ID (kid).
 * @param {object} header  JWT header containing { kid }
 * @returns {Promise<string>} RSA public key in PEM format
 */
function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verify a Cognito-issued JWT and extract the userId.
 *
 * @param {string} authorizationHeader  Value of the Authorization header
 *                                      (with or without "Bearer " prefix)
 * @returns {Promise<{ userId: string, email: string, claims: object }>}
 * @throws {Error} If the token is missing, expired, or has an invalid signature
 */
async function verifyToken(authorizationHeader) {
  if (!authorizationHeader) {
    throw new Error('Authorization header is missing');
  }

  // Strip "Bearer " prefix if present
  const token = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : authorizationHeader;

  // Decode header without verification to get the key ID
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    throw new Error('Invalid JWT structure');
  }

  const signingKey = await getSigningKey(decoded.header);

  // Verify signature, expiry, and issuer
  const claims = await new Promise((resolve, reject) => {
    jwt.verify(
      token,
      signingKey,
      {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
      },
      (err, payload) => {
        if (err) return reject(err);
        resolve(payload);
      }
    );
  });

  return {
    userId: claims.sub,
    email: claims.email,
    claims,
  };
}

module.exports = { verifyToken };
