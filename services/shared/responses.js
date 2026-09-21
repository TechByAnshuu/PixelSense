/**
 * responses.js — Shared API Gateway response builder
 *
 * All Lambda handlers must return responses through this helper to guarantee
 * a consistent shape that API Gateway proxy integration expects.
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

/**
 * Build a standard API Gateway proxy response.
 * @param {number} statusCode  HTTP status code
 * @param {object|string} body Response body (objects are JSON-stringified)
 * @param {object} [headers]   Additional headers to merge
 * @returns {{ statusCode, headers, body }}
 */
function buildResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

const responses = {
  ok: (body)                  => buildResponse(200, body),
  created: (body)             => buildResponse(201, body),
  badRequest: (message)       => buildResponse(400, { error: 'Bad Request', message }),
  unauthorized: (message)     => buildResponse(401, { error: 'Unauthorized', message: message || 'Invalid or missing token' }),
  forbidden: (message)        => buildResponse(403, { error: 'Forbidden', message }),
  notFound: (message)         => buildResponse(404, { error: 'Not Found', message }),
  internalError: (message)    => buildResponse(500, { error: 'Internal Server Error', message }),
};

module.exports = responses;
