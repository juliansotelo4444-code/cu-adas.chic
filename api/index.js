// ==============================================================================
// ENTRYPOINT SERVERLESS PARA VERCEL (/api)
// Redirige las peticiones /api/* al handler central de server.js
// ==============================================================================

const handleRequest = require('../server.js');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
