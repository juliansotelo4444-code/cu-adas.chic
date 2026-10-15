// ==============================================================================
// GESTOR DE BASE DE DATOS (DUAL: POSTGRESQL NEON EN PRODUCCIÓN / SQLITE EN LOCAL)
// ==============================================================================

// Si se configuró DATABASE_URL (en Render con Neon.tech), usar PostgreSQL
if (process.env.DATABASE_URL) {
  module.exports = require('./db-postgres.js');
  return;
}

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Inicializar conexión local SQLite
const db = new DatabaseSync(DB_PATH);

// Activar claves foráneas
db.exec('PRAGMA foreign_keys = ON;');

// Ejecutar esquema SQL inicial si no existe
function initDatabase() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schemaSql);
  console.log('🌸 Base de datos de Cuñadas Chic inicializada (vacía y lista para datos reales).');
}

// ------------------------------------------------------------------------------
// CONSULTAS DE MÉTRICAS Y GRÁFICOS FINANCIEROS (DASHBOARD)
// ------------------------------------------------------------------------------
function getDashboardMetrics() {
  // 1. Ventas Totales y recaudación
  const salesSummary = db.prepare(`
    SELECT 
      COUNT(*) as total_sales_count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(amount_paid), 0) as total_collected,
      COALESCE(SUM(CASE WHEN payment_status = 'pendiente' OR payment_status = 'seña_anticipo' THEN (total_amount - amount_paid) ELSE 0 END), 0) as pending_receivables
    FROM sales
  `).get();

  // 2. Costo de mercancía vendida (COGS)
  const cogsSummary = db.prepare(`
    SELECT 
      COALESCE(SUM(unit_cost), 0) as cost_of_goods_sold,
      COALESCE(SUM(profit), 0) as gross_profit
    FROM sale_items
  `).get();

  // 3. Inversión Total en Fardos (Costos de compra + flete + aduana + acondicionamiento)
  const balesCostSummary = db.prepare(`
    SELECT 
      COALESCE(SUM(purchase_cost), 0) as total_purchase,
      COALESCE(SUM(shipping_cost), 0) as total_shipping,
      COALESCE(SUM(customs_cost), 0) as total_customs,
      COALESCE(SUM(other_expenses), 0) as total_conditioning,
      COALESCE(SUM(purchase_cost + shipping_cost + customs_cost + other_expenses), 0) as total_bales_invested,
      COUNT(*) as total_bales_count,
      SUM(CASE WHEN status = 'abierto_activo' THEN 1 ELSE 0 END) as active_bales_count
    FROM bales
  `).get();

  // 4. Gastos operativos generales
  const expensesSummary = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_operating_expenses
    FROM expenses
  `).get();

  // 5. Inventario de prendas
  const inventorySummary = db.prepare(`
    SELECT 
      COUNT(*) as total_garments,
      SUM(CASE WHEN status = 'disponible' THEN 1 ELSE 0 END) as available_count,
      SUM(CASE WHEN status = 'reservado' THEN 1 ELSE 0 END) as reserved_count,
      SUM(CASE WHEN status = 'vendido' THEN 1 ELSE 0 END) as sold_count,
      SUM(CASE WHEN status = 'descarte_merma' THEN 1 ELSE 0 END) as waste_count,
      COALESCE(SUM(CASE WHEN status = 'disponible' THEN sale_price ELSE 0 END), 0) as potential_inventory_revenue,
      COALESCE(SUM(CASE WHEN status = 'disponible' THEN cost_price ELSE 0 END), 0) as inventory_cost_valuation
    FROM garments
  `).get();

  // Cálculos financieros globales
  const totalRevenue = salesSummary.total_revenue;
  const costOfSold = cogsSummary.cost_of_goods_sold;
  const operatingExpenses = expensesSummary.total_operating_expenses;
  const netProfitOnSold = (totalRevenue - costOfSold) - operatingExpenses;
  const grossProfitMargin = totalRevenue > 0 ? ((totalRevenue - costOfSold) / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfitOnSold / totalRevenue) * 100 : 0;

  // 6. Evolución de Ventas vs Costo por Fecha
  const salesTimeline = db.prepare(`
    SELECT 
      substr(s.sale_date, 1, 10) as date,
      COUNT(DISTINCT s.id) as sales_count,
      ROUND(SUM(s.total_amount), 2) as revenue,
      ROUND(SUM(si.unit_cost), 2) as cost,
      ROUND(SUM(s.total_amount) - SUM(si.unit_cost), 2) as profit
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    GROUP BY substr(s.sale_date, 1, 10)
    ORDER BY date ASC
    LIMIT 15
  `).all();

  // 7. Rendimiento y Rentabilidad por Fardo (ROI)
  const balePerformance = db.prepare(`
    SELECT 
      b.id,
      b.code,
      b.name,
      b.category,
      ROUND(b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses, 2) as invested_cost,
      b.actual_pieces as total_pieces,
      COUNT(g.id) as registered_pieces,
      SUM(CASE WHEN g.status = 'vendido' THEN 1 ELSE 0 END) as sold_pieces,
      SUM(CASE WHEN g.status = 'disponible' THEN 1 ELSE 0 END) as available_pieces,
      COALESCE(ROUND(SUM(CASE WHEN g.status = 'vendido' THEN si.unit_price ELSE 0 END), 2), 0) as recovered_revenue,
      COALESCE(ROUND(SUM(CASE WHEN g.status = 'disponible' THEN g.sale_price ELSE 0 END), 2), 0) as remaining_potential_revenue
    FROM bales b
    LEFT JOIN garments g ON b.id = g.bale_id
    LEFT JOIN sale_items si ON g.id = si.garment_id
    GROUP BY b.id
    ORDER BY b.id ASC
  `).all().map(b => {
    const recovered = b.recovered_revenue || 0;
    const invested = b.invested_cost || 1;
    const balance = recovered - invested;
    const roiPercentage = ((recovered - invested) / invested) * 100;
    const recoveryProgress = Math.min(100, Math.round((recovered / invested) * 100));
    return {
      ...b,
      balance,
      roiPercentage: Number(roiPercentage.toFixed(1)),
      recoveryProgress
    };
  });

  // 8. Ventas por Categoría de Prendas
  const salesByCategory = db.prepare(`
    SELECT 
      g.category,
      COUNT(si.id) as count,
      ROUND(SUM(si.unit_price), 2) as revenue,
      ROUND(SUM(si.profit), 2) as profit
    FROM sale_items si
    JOIN garments g ON si.garment_id = g.id
    GROUP BY g.category
    ORDER BY revenue DESC
  `).all();

  // 9. Desglose de Gastos y Costos Totales de Fardos
  const costBreakdown = {
    purchase: balesCostSummary.total_purchase,
    shipping: balesCostSummary.total_shipping,
    customs: balesCostSummary.total_customs,
    conditioning: balesCostSummary.total_conditioning,
    operating_expenses: expensesSummary.total_operating_expenses
  };

  // 10. Últimas Ventas
  const recentSales = db.prepare(`
    SELECT 
      s.id,
      s.invoice_code,
      s.sale_date,
      s.total_amount,
      s.payment_status,
      s.payment_method,
      c.name as customer_name,
      c.instagram as customer_instagram
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.id DESC
    LIMIT 5
  `).all();

  return {
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCollected: Number(salesSummary.total_collected.toFixed(2)),
      pendingReceivables: Number(salesSummary.pending_receivables.toFixed(2)),
      costOfSold: Number(costOfSold.toFixed(2)),
      totalBalesInvested: Number(balesCostSummary.total_bales_invested.toFixed(2)),
      operatingExpenses: Number(operatingExpenses.toFixed(2)),
      netProfitOnSold: Number(netProfitOnSold.toFixed(2)),
      grossProfitMargin: Number(grossProfitMargin.toFixed(1)),
      netMargin: Number(netMargin.toFixed(1)),
      totalBalesCount: balesCostSummary.total_bales_count || 0,
      activeBalesCount: balesCostSummary.active_bales_count || 0,
      totalGarments: inventorySummary.total_garments || 0,
      availableCount: inventorySummary.available_count || 0,
      soldCount: inventorySummary.sold_count || 0,
      reservedCount: inventorySummary.reserved_count || 0,
      potentialInventoryRevenue: Number((inventorySummary.potential_inventory_revenue || 0).toFixed(2))
    },
    salesTimeline,
    balePerformance,
    salesByCategory,
    costBreakdown,
    recentSales
  };
}

// ------------------------------------------------------------------------------
// OPERACIONES CRUD: FARDOS (Bales)
// ------------------------------------------------------------------------------
function getAllBales() {
  return db.prepare(`
    SELECT 
      b.*,
      ROUND(b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses, 2) as calculated_total_cost,
      (SELECT COUNT(*) FROM garments g WHERE g.bale_id = b.id) as garments_count,
      (SELECT COUNT(*) FROM garments g WHERE g.bale_id = b.id AND g.status = 'disponible') as garments_available,
      (SELECT COUNT(*) FROM garments g WHERE g.bale_id = b.id AND g.status = 'vendido') as garments_sold,
      (SELECT COALESCE(SUM(si.unit_price), 0) FROM garments g JOIN sale_items si ON g.id = si.garment_id WHERE g.bale_id = b.id) as total_recovered
    FROM bales b
    ORDER BY b.id DESC
  `).all();
}

function getBaleById(id) {
  const bale = db.prepare(`
    SELECT b.*, ROUND(b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses, 2) as calculated_total_cost
    FROM bales b WHERE b.id = ?
  `).get(id);
  if (!bale) return null;

  const garments = db.prepare('SELECT * FROM garments WHERE bale_id = ? ORDER BY id DESC').all(id);
  return { ...bale, garments };
}

function createBale(data) {
  const code = data.code || `FAR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const stmt = db.prepare(`
    INSERT INTO bales (code, name, category, supplier, origin_country, purchase_cost, shipping_cost, customs_cost, other_expenses, weight_kg, estimated_pieces, actual_pieces, arrival_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    code,
    data.name,
    data.category || 'Varios',
    data.supplier || '',
    data.origin_country || 'Estados Unidos',
    Number(data.purchase_cost || 0),
    Number(data.shipping_cost || 0),
    Number(data.customs_cost || 0),
    Number(data.other_expenses || 0),
    Number(data.weight_kg || 0),
    parseInt(data.estimated_pieces || 0),
    parseInt(data.actual_pieces || 0),
    data.arrival_date || new Date().toISOString().slice(0, 10),
    data.status || 'recibido',
    data.notes || ''
  );
  return getBaleById(result.lastInsertRowid);
}

function updateBale(id, data) {
  const stmt = db.prepare(`
    UPDATE bales 
    SET name = ?, category = ?, supplier = ?, origin_country = ?, purchase_cost = ?, shipping_cost = ?, customs_cost = ?, other_expenses = ?, weight_kg = ?, estimated_pieces = ?, actual_pieces = ?, arrival_date = ?, status = ?, notes = ?
    WHERE id = ?
  `);
  stmt.run(
    data.name,
    data.category,
    data.supplier,
    data.origin_country,
    Number(data.purchase_cost || 0),
    Number(data.shipping_cost || 0),
    Number(data.customs_cost || 0),
    Number(data.other_expenses || 0),
    Number(data.weight_kg || 0),
    parseInt(data.estimated_pieces || 0),
    parseInt(data.actual_pieces || 0),
    data.arrival_date,
    data.status,
    data.notes,
    id
  );
  return getBaleById(id);
}

function deleteBale(id) {
  return db.prepare('DELETE FROM bales WHERE id = ?').run(id);
}

// ------------------------------------------------------------------------------
// OPERACIONES CRUD: PRENDAS / INVENTARIO (Garments)
// ------------------------------------------------------------------------------
function getAllGarments(filters = {}) {
  let sql = `
    SELECT 
      g.*,
      b.code as bale_code,
      b.name as bale_name
    FROM garments g
    LEFT JOIN bales b ON g.bale_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    sql += ` AND g.status = ?`;
    params.push(filters.status);
  }
  if (filters.bale_id) {
    sql += ` AND g.bale_id = ?`;
    params.push(filters.bale_id);
  }
  if (filters.category) {
    sql += ` AND g.category = ?`;
    params.push(filters.category);
  }
  if (filters.search) {
    sql += ` AND (g.name LIKE ? OR g.sku LIKE ? OR g.brand LIKE ? OR g.color LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY g.id DESC`;
  return db.prepare(sql).all(...params);
}

function getGarmentById(id) {
  return db.prepare(`
    SELECT g.*, b.code as bale_code, b.name as bale_name
    FROM garments g
    LEFT JOIN bales b ON g.bale_id = b.id
    WHERE g.id = ?
  `).get(id);
}

function createGarment(data) {
  // Generar SKU único si no viene provisto
  const sku = data.sku && data.sku.trim() !== '' 
    ? data.sku.trim().toUpperCase() 
    : `GLAM-${String(Date.now()).slice(-5)}`;
  
  const barcode = data.barcode || `779${String(Date.now()).slice(-9)}`;

  const stmt = db.prepare(`
    INSERT INTO garments (bale_id, sku, name, category, brand, size, color, condition, cost_price, sale_price, status, barcode, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.bale_id ? parseInt(data.bale_id) : null,
    sku,
    data.name,
    data.category || 'Otros',
    data.brand || 'Vintage',
    data.size || 'M',
    data.color || '',
    data.condition || 'Excelente',
    Number(data.cost_price || 0),
    Number(data.sale_price || 0),
    data.status || 'disponible',
    barcode,
    data.notes || ''
  );
  return getGarmentById(result.lastInsertRowid);
}

// Carga rápida masiva de prendas para un fardo (Desempacar fardo)
function unpackBaleGarments(baleId, count, baseCategory, defaultPrice) {
  const bale = db.prepare(`
    SELECT *, (purchase_cost + shipping_cost + customs_cost + other_expenses) as total_cost
    FROM bales WHERE id = ?
  `).get(baleId);

  if (!bale) throw new Error('Fardo no encontrado');

  const unitCost = count > 0 ? Number((bale.total_cost / count).toFixed(2)) : 0;
  const createdItems = [];

  const insertStmt = db.prepare(`
    INSERT INTO garments (bale_id, sku, name, category, brand, size, color, condition, cost_price, sale_price, status, barcode, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = Date.now();
  for (let i = 1; i <= count; i++) {
    const sku = `${bale.code.replace('FAR-', 'F')}-${String(i).padStart(3, '0')}`;
    const name = `Prenda #${i} - ${baseCategory || bale.category}`;
    const barcode = `779${String(timestamp + i).slice(-9)}`;

    const res = insertStmt.run(
      bale.id,
      sku,
      name,
      baseCategory || bale.category,
      'Vintage Selección',
      'M',
      'Surtido',
      'Excelente',
      unitCost,
      defaultPrice || Number((unitCost * 3).toFixed(2)),
      'disponible',
      barcode,
      `Generada desde fardo ${bale.code}`
    );
    createdItems.push(res.lastInsertRowid);
  }

  // Actualizar actual_pieces en el fardo si estaba en 0
  db.prepare(`UPDATE bales SET actual_pieces = (SELECT COUNT(*) FROM garments WHERE bale_id = ?), status = 'abierto_activo' WHERE id = ?`).run(baleId, baleId);

  return { message: `Se generaron exitosamente ${createdItems.length} prendas vinculadas al fardo ${bale.code}`, count: createdItems.length };
}

function updateGarment(id, data) {
  const stmt = db.prepare(`
    UPDATE garments
    SET bale_id = ?, sku = ?, name = ?, category = ?, brand = ?, size = ?, color = ?, condition = ?, cost_price = ?, sale_price = ?, status = ?, barcode = ?, notes = ?
    WHERE id = ?
  `);
  stmt.run(
    data.bale_id ? parseInt(data.bale_id) : null,
    data.sku.toUpperCase(),
    data.name,
    data.category,
    data.brand,
    data.size,
    data.color,
    data.condition,
    Number(data.cost_price || 0),
    Number(data.sale_price || 0),
    data.status,
    data.barcode,
    data.notes,
    id
  );
  return getGarmentById(id);
}

function deleteGarment(id) {
  return db.prepare('DELETE FROM garments WHERE id = ?').run(id);
}

// ------------------------------------------------------------------------------
// OPERACIONES CRUD: CLIENTES (Customers)
// ------------------------------------------------------------------------------
function getAllCustomers() {
  return db.prepare(`
    SELECT 
      c.*,
      COUNT(s.id) as sales_count,
      COALESCE(SUM(s.total_amount), 0) as total_spent,
      COALESCE(SUM(CASE WHEN s.payment_status = 'pendiente' OR s.payment_status = 'seña_anticipo' THEN (s.total_amount - s.amount_paid) ELSE 0 END), 0) as debt_amount
    FROM customers c
    LEFT JOIN sales s ON c.id = s.customer_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
}

function createCustomer(data) {
  const stmt = db.prepare(`
    INSERT INTO customers (name, phone, email, instagram, city, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name,
    data.phone || '',
    data.email || '',
    data.instagram || '',
    data.city || '',
    data.address || '',
    data.notes || ''
  );
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
}

function updateCustomer(id, data) {
  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, email = ?, instagram = ?, city = ?, address = ?, notes = ?
    WHERE id = ?
  `).run(
    data.name,
    data.phone,
    data.email,
    data.instagram,
    data.city,
    data.address,
    data.notes,
    id
  );
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function deleteCustomer(id) {
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
}

// ------------------------------------------------------------------------------
// OPERACIONES: VENTAS (Sales) Y REGISTRO DE TRANSACCIÓN
// ------------------------------------------------------------------------------
function getAllSales() {
  const sales = db.prepare(`
    SELECT 
      s.*,
      c.name as customer_name,
      c.phone as customer_phone,
      c.instagram as customer_instagram,
      (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count,
      (SELECT COALESCE(SUM(si.profit), 0) FROM sale_items si WHERE si.sale_id = s.id) as total_profit
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.id DESC
  `).all();
  return sales;
}

function getSaleById(id) {
  const sale = db.prepare(`
    SELECT 
      s.*,
      c.name as customer_name,
      c.phone as customer_phone,
      c.email as customer_email,
      c.instagram as customer_instagram,
      c.address as customer_address,
      c.city as customer_city
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `).get(id);

  if (!sale) return null;

  const items = db.prepare(`
    SELECT 
      si.*,
      g.sku,
      g.name as garment_name,
      g.category as garment_category,
      g.brand,
      g.size,
      g.color
    FROM sale_items si
    JOIN garments g ON si.garment_id = g.id
    WHERE si.sale_id = ?
  `).all(id);

  return { ...sale, items };
}

// Registrar una nueva venta completa
function createSale(data) {
  // data: { customer_id, items: [garment_id], discount, payment_status, amount_paid, payment_method, delivery_status, notes }
  if (!data.items || data.items.length === 0) {
    throw new Error('La venta debe incluir al menos una prenda');
  }

  const invoiceCode = data.invoice_code || `VTA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const saleDate = data.sale_date || new Date().toISOString().replace('T', ' ').slice(0, 16);

  // Obtener prendas y validar que estén disponibles
  const garmentIds = data.items.map(item => typeof item === 'object' ? item.id : item);
  const placeholders = garmentIds.map(() => '?').join(',');
  const garments = db.prepare(`SELECT * FROM garments WHERE id IN (${placeholders})`).all(...garmentIds);

  if (garments.length !== garmentIds.length) {
    throw new Error('Una o más prendas seleccionadas no existen');
  }

  let subtotal = 0;
  for (const g of garments) {
    subtotal += g.sale_price;
  }

  const discount = Number(data.discount || 0);
  const totalAmount = Math.max(0, subtotal - discount);
  const paymentStatus = data.payment_status || 'pagado';
  const amountPaid = paymentStatus === 'pagado' ? totalAmount : Number(data.amount_paid || 0);

  // Insertar cabecera de venta
  const insertSaleStmt = db.prepare(`
    INSERT INTO sales (invoice_code, customer_id, sale_date, subtotal, discount, total_amount, payment_status, amount_paid, payment_method, delivery_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const saleResult = insertSaleStmt.run(
    invoiceCode,
    data.customer_id ? parseInt(data.customer_id) : null,
    saleDate,
    subtotal,
    discount,
    totalAmount,
    paymentStatus,
    amountPaid,
    data.payment_method || 'Efectivo',
    data.delivery_status || 'Entregado',
    data.notes || ''
  );

  const saleId = saleResult.lastInsertRowid;

  // Insertar cada ítem de venta y actualizar estado de la prenda a 'vendido'
  const insertItemStmt = db.prepare(`
    INSERT INTO sale_items (sale_id, garment_id, unit_price, unit_cost)
    VALUES (?, ?, ?, ?)
  `);

  const updateGarmentStmt = db.prepare(`UPDATE garments SET status = 'vendido' WHERE id = ?`);

  for (const g of garments) {
    insertItemStmt.run(saleId, g.id, g.sale_price, g.cost_price);
    updateGarmentStmt.run(g.id);
  }

  return getSaleById(saleId);
}

// Actualizar estado de pago de una venta existente
function updateSalePayment(saleId, paymentStatus, amountPaid) {
  db.prepare(`
    UPDATE sales 
    SET payment_status = ?, amount_paid = ? 
    WHERE id = ?
  `).run(paymentStatus, Number(amountPaid), saleId);
  return getSaleById(saleId);
}

// ------------------------------------------------------------------------------
// OPERACIONES: GASTOS GENERALES (Expenses)
// ------------------------------------------------------------------------------
function getAllExpenses() {
  return db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC').all();
}

function createExpense(data) {
  const stmt = db.prepare(`
    INSERT INTO expenses (category, description, amount, expense_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.category || 'Varios',
    data.description,
    Number(data.amount || 0),
    data.expense_date || new Date().toISOString().slice(0, 10),
    data.notes || ''
  );
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(res.lastInsertRowid);
}

function deleteExpense(id) {
  return db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

// ------------------------------------------------------------------------------
// EXPLORADOR SQL DIRECTO (Para visualizar o ejecutar queries en vivo)
// ------------------------------------------------------------------------------
function executeQuery(sql) {
  const trimmed = sql.trim();
  const isSelect = /^SELECT\b/i.test(trimmed) || /^PRAGMA\b/i.test(trimmed);

  if (isSelect) {
    return {
      type: 'select',
      rows: db.prepare(trimmed).all()
    };
  } else {
    // Para INSERT, UPDATE, DELETE
    const info = db.prepare(trimmed).run();
    return {
      type: 'mutation',
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid
    };
  }
}

// Exportar módulos y funciones
module.exports = {
  db,
  initDatabase,
  getDashboardMetrics,
  getAllBales,
  getBaleById,
  createBale,
  updateBale,
  deleteBale,
  getAllGarments,
  getGarmentById,
  createGarment,
  unpackBaleGarments,
  updateGarment,
  deleteGarment,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getAllSales,
  getSaleById,
  createSale,
  updateSalePayment,
  getAllExpenses,
  createExpense,
  deleteExpense,
  executeQuery
};
