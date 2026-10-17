// ==============================================================================
// SERVIDOR WEB HTTP & REST API (NATIVO NODE.JS - ZERO DEPENDENCIAS)
// Servidor de archivos estáticos y API REST para ChicBoutique Fardos & Vintage
// ==============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

// Cargar variables de entorno desde .env antes de requerir db
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch (_) {}
  } else {
    try {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || '').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (_) {}
  }
}

const db = require('./db.js');

// Inicializar la base de datos (SQLite local o Neon PostgreSQL según el entorno)
Promise.resolve(db.initDatabase()).catch(err => {
  console.error('Error inicializando base de datos:', err);
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Tipos MIME soportados para archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Utilidad para responder en formato JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Utilidad para parsear el cuerpo JSON de peticiones POST/PUT
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    // Si la plataforma (ej. Vercel) ya parseó el body
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') return resolve(req.body);
      try {
        return resolve(JSON.parse(req.body));
      } catch (err) {
        return reject(new Error('JSON malformado en la petición'));
      }
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) { // Límite de 5MB
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON malformado en la petición'));
      }
    });
    req.on('error', reject);
  });
}

// Servir archivos estáticos
function serveStaticFile(req, res, pathname) {
  let safePath = pathname === '/' ? '/index.html' : pathname;
  // Prevenir Directory Traversal
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Si no existe, servir index.html para soportar rutas SPA
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Recurso no encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Error de lectura de archivo');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        res.end(content);
      }
    });
  });
}

// Router principal del servidor
async function handleRequest(req, res) {
  // Determinar la URL y ruta solicitada (soportando Vercel Serverless, proxies y Node nativo)
  const forwardedUri = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'];
  const rawUrl = forwardedUri || req.url;
  const reqUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
  let pathname = reqUrl.pathname;

  // Si Vercel rewrote la llamada a /api/index.js?path=...
  if (pathname === '/api/index.js' || pathname === '/api/index' || pathname === '/api') {
    const subpath = reqUrl.searchParams.get('path') || (req.query && req.query.path);
    if (subpath) {
      pathname = subpath.startsWith('/') ? `/api${subpath}` : `/api/${subpath}`;
    }
  }

  const method = req.method;
  const queryParams = Object.fromEntries(reqUrl.searchParams.entries());

  // Manejo de CORS pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Rutas de API REST
  if (pathname.startsWith('/api/') || pathname === '/api') {
    try {
      // 1. MÉTRICAS FINANCIERAS Y DASHBOARD
      if (pathname === '/api/metrics' && method === 'GET') {
        const metrics = await db.getDashboardMetrics();
        return sendJSON(res, 200, { success: true, data: metrics });
      }

      // 2. FARDOS (Bales)
      if (pathname === '/api/bales' && method === 'GET') {
        const bales = await db.getAllBales();
        return sendJSON(res, 200, { success: true, data: bales });
      }

      const baleMatch = pathname.match(/^\/api\/bales\/(\d+)$/);
      if (baleMatch && method === 'GET') {
        const bale = await db.getBaleById(parseInt(baleMatch[1]));
        if (!bale) return sendJSON(res, 404, { success: false, error: 'Fardo no encontrado' });
        return sendJSON(res, 200, { success: true, data: bale });
      }

      if (pathname === '/api/bales' && method === 'POST') {
        const body = await parseRequestBody(req);
        const newBale = await db.createBale(body);
        return sendJSON(res, 201, { success: true, data: newBale });
      }

      if (baleMatch && method === 'PUT') {
        const body = await parseRequestBody(req);
        const updated = await db.updateBale(parseInt(baleMatch[1]), body);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      if (baleMatch && method === 'DELETE') {
        await db.deleteBale(parseInt(baleMatch[1]));
        return sendJSON(res, 200, { success: true, message: 'Fardo eliminado correctamente' });
      }

      // Desempacar fardo (crear prendas en lote)
      const unpackMatch = pathname.match(/^\/api\/bales\/(\d+)\/unpack$/);
      if (unpackMatch && method === 'POST') {
        const body = await parseRequestBody(req);
        const result = await db.unpackBaleGarments(
          parseInt(unpackMatch[1]),
          parseInt(body.count || 20),
          body.category,
          Number(body.default_price || 0)
        );
        return sendJSON(res, 200, { success: true, data: result });
      }

      // 3. PRENDAS / INVENTARIO (Garments)
      if (pathname === '/api/garments' && method === 'GET') {
        const garments = await db.getAllGarments(queryParams);
        return sendJSON(res, 200, { success: true, data: garments });
      }

      const garmentMatch = pathname.match(/^\/api\/garments\/(\d+)$/);
      if (garmentMatch && method === 'GET') {
        const garment = await db.getGarmentById(parseInt(garmentMatch[1]));
        if (!garment) return sendJSON(res, 404, { success: false, error: 'Prenda no encontrada' });
        return sendJSON(res, 200, { success: true, data: garment });
      }

      if (pathname === '/api/garments' && method === 'POST') {
        const body = await parseRequestBody(req);
        const newGarment = await db.createGarment(body);
        return sendJSON(res, 201, { success: true, data: newGarment });
      }

      if (garmentMatch && method === 'PUT') {
        const body = await parseRequestBody(req);
        const updated = await db.updateGarment(parseInt(garmentMatch[1]), body);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      if (garmentMatch && method === 'DELETE') {
        await db.deleteGarment(parseInt(garmentMatch[1]));
        return sendJSON(res, 200, { success: true, message: 'Prenda eliminada correctamente' });
      }

      // 4. CLIENTES (Customers)
      if (pathname === '/api/customers' && method === 'GET') {
        const customers = await db.getAllCustomers();
        return sendJSON(res, 200, { success: true, data: customers });
      }

      if (pathname === '/api/customers' && method === 'POST') {
        const body = await parseRequestBody(req);
        const newCustomer = await db.createCustomer(body);
        return sendJSON(res, 201, { success: true, data: newCustomer });
      }

      const customerMatch = pathname.match(/^\/api\/customers\/(\d+)$/);
      if (customerMatch && method === 'PUT') {
        const body = await parseRequestBody(req);
        const updated = await db.updateCustomer(parseInt(customerMatch[1]), body);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      if (customerMatch && method === 'DELETE') {
        await db.deleteCustomer(parseInt(customerMatch[1]));
        return sendJSON(res, 200, { success: true, message: 'Cliente eliminado correctamente' });
      }

      // 5. VENTAS (Sales)
      if (pathname === '/api/sales' && method === 'GET') {
        const sales = await db.getAllSales();
        return sendJSON(res, 200, { success: true, data: sales });
      }

      const saleMatch = pathname.match(/^\/api\/sales\/(\d+)$/);
      if (saleMatch && method === 'GET') {
        const sale = await db.getSaleById(parseInt(saleMatch[1]));
        if (!sale) return sendJSON(res, 404, { success: false, error: 'Venta no encontrada' });
        return sendJSON(res, 200, { success: true, data: sale });
      }

      if (pathname === '/api/sales' && method === 'POST') {
        const body = await parseRequestBody(req);
        const newSale = await db.createSale(body);
        return sendJSON(res, 201, { success: true, data: newSale });
      }

      const paymentMatch = pathname.match(/^\/api\/sales\/(\d+)\/payment$/);
      if (paymentMatch && method === 'PUT') {
        const body = await parseRequestBody(req);
        const updated = await db.updateSalePayment(parseInt(paymentMatch[1]), body.payment_status, body.amount_paid);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      // 6. GASTOS GENERALES (Expenses)
      if (pathname === '/api/expenses' && method === 'GET') {
        const expenses = await db.getAllExpenses();
        return sendJSON(res, 200, { success: true, data: expenses });
      }

      if (pathname === '/api/expenses' && method === 'POST') {
        const body = await parseRequestBody(req);
        const newExpense = await db.createExpense(body);
        return sendJSON(res, 201, { success: true, data: newExpense });
      }

      const expenseMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
      if (expenseMatch && method === 'DELETE') {
        await db.deleteExpense(parseInt(expenseMatch[1]));
        return sendJSON(res, 200, { success: true, message: 'Gasto eliminado' });
      }

      // 7. EXPLORADOR SQL DIRECTO
      if (pathname === '/api/sql' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.query) {
          return sendJSON(res, 400, { success: false, error: 'Se requiere el parámetro "query"' });
        }
        const result = db.executeQuery(body.query);
        return sendJSON(res, 200, { success: true, data: result });
      }

      // Ruta de API no encontrada
      return sendJSON(res, 404, { success: false, error: 'Endpoint no encontrado' });

    } catch (err) {
      console.error('Error en API:', err);
      return sendJSON(res, 500, { success: false, error: err.message || 'Error interno del servidor' });
    }
  }

  // Si no es /api/, servir archivo estático de la carpeta public
  serveStaticFile(req, res, pathname);
}

// Servidor HTTP
const server = http.createServer(handleRequest);

// Si se ejecuta directamente (ej. en local o Render), iniciar el puerto
if (require.main === module) {
  server.listen(PORT, () => {
    const dbEngine = process.env.DATABASE_URL ? 'Neon Cloud (PostgreSQL)' : 'SQLite (Local database.sqlite)';
    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║   🌸 CUÑADAS CHIC - SISTEMA DE FARDOS DE ROPA USADA & VINTAGE 🌸       ║
║                                                                        ║
║   Servidor iniciado con éxito en:                                      ║
║   👉  http://localhost:${PORT}                                          ║
║                                                                        ║
║   Base de Datos SQL: ${dbEngine.padEnd(50)}║
║   Estética: Más Rosa & Oro, HTML5, CSS3, JS ES6+, REST API             ║
╚════════════════════════════════════════════════════════════════════════╝
    `);
  });
}

// Manejo de errores no capturados
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

// Exportar handler para compatibilidad con Vercel Serverless
module.exports = handleRequest;
module.exports.server = server;
