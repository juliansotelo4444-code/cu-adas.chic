// ==============================================================================
// GESTOR DE BASE DE DATOS POSTGRESQL PARA NEON.TECH (RENDER CLOUD)
// Implementación asíncrona compatible con Neon Serverless Postgres y Pool de Conexiones
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const SCHEMA_POSTGRES_PATH = path.join(__dirname, 'schema.postgres.sql');

// Limpiar parámetros incompatibles con pg (como channel_binding) si vienen en el connection string
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl) {
  dbUrl = dbUrl.replace(/([?&])channel_binding=[^&]*(&|$)/, (match, prefix, suffix) => {
    return prefix === '?' && suffix ? '?' : '';
  }).replace(/[?&]$/, '');
}

// Configuración del Pool de conexiones para Neon (requiere SSL)
const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Error imprevisto en el cliente PostgreSQL de Neon:', err);
});

// Inicializar tablas en Neon si no existen
async function initDatabase() {
  console.log('🌸 Conectando a la base de datos Neon (PostgreSQL)...');
  const client = await pool.connect();
  try {
    const schemaSql = fs.readFileSync(SCHEMA_POSTGRES_PATH, 'utf-8');
    await client.query(schemaSql);
    console.log('✅ Base de datos Neon de Cuñadas Chic lista y sincronizada.');
  } catch (err) {
    console.error('Error al inicializar esquema en Neon:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------------------------
// MÉTRICAS FINANCIERAS (DASHBOARD)
// ------------------------------------------------------------------------------
async function getDashboardMetrics() {
  const client = await pool.connect();
  try {
    // 1. Resumen de ventas
    const salesRes = await client.query(`
      SELECT 
        COUNT(*)::int as total_sales_count,
        COALESCE(SUM(total_amount), 0)::float as total_revenue,
        COALESCE(SUM(amount_paid), 0)::float as total_collected,
        COALESCE(SUM(CASE WHEN payment_status = 'pendiente' OR payment_status = 'seña_anticipo' THEN (total_amount - amount_paid) ELSE 0 END), 0)::float as pending_receivables
      FROM sales
    `);
    const salesSummary = salesRes.rows[0];

    // 2. Costo de mercancía vendida
    const cogsRes = await client.query(`
      SELECT 
        COALESCE(SUM(unit_cost), 0)::float as cost_of_goods_sold,
        COALESCE(SUM(profit), 0)::float as gross_profit
      FROM sale_items
    `);
    const cogsSummary = cogsRes.rows[0];

    // 3. Fardos e inversión
    const balesRes = await client.query(`
      SELECT 
        COALESCE(SUM(purchase_cost), 0)::float as total_purchase,
        COALESCE(SUM(shipping_cost), 0)::float as total_shipping,
        COALESCE(SUM(customs_cost), 0)::float as total_customs,
        COALESCE(SUM(other_expenses), 0)::float as total_conditioning,
        COALESCE(SUM(purchase_cost + shipping_cost + customs_cost + other_expenses), 0)::float as total_bales_invested,
        COUNT(*)::int as total_bales_count,
        COALESCE(SUM(CASE WHEN status = 'abierto_activo' THEN 1 ELSE 0 END), 0)::int as active_bales_count
      FROM bales
    `);
    const balesCostSummary = balesRes.rows[0];

    // 4. Gastos operativos
    const expensesRes = await client.query(`
      SELECT COALESCE(SUM(amount), 0)::float as total_operating_expenses
      FROM expenses
    `);
    const expensesSummary = expensesRes.rows[0];

    // 5. Inventario de prendas
    const invRes = await client.query(`
      SELECT 
        COUNT(*)::int as total_garments,
        COALESCE(SUM(CASE WHEN status = 'disponible' THEN 1 ELSE 0 END), 0)::int as available_count,
        COALESCE(SUM(CASE WHEN status = 'reservado' THEN 1 ELSE 0 END), 0)::int as reserved_count,
        COALESCE(SUM(CASE WHEN status = 'vendido' THEN 1 ELSE 0 END), 0)::int as sold_count,
        COALESCE(SUM(CASE WHEN status = 'descarte_merma' THEN 1 ELSE 0 END), 0)::int as waste_count,
        COALESCE(SUM(CASE WHEN status = 'disponible' THEN sale_price ELSE 0 END), 0)::float as potential_inventory_revenue
      FROM garments
    `);
    const inventorySummary = invRes.rows[0];

    const totalRevenue = salesSummary.total_revenue || 0;
    const costOfSold = cogsSummary.cost_of_goods_sold || 0;
    const operatingExpenses = expensesSummary.total_operating_expenses || 0;
    const netProfitOnSold = (totalRevenue - costOfSold) - operatingExpenses;
    const grossProfitMargin = totalRevenue > 0 ? ((totalRevenue - costOfSold) / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfitOnSold / totalRevenue) * 100 : 0;

    // 6. Línea de tiempo
    const timelineRes = await client.query(`
      SELECT 
        TO_CHAR(s.sale_date, 'YYYY-MM-DD') as date,
        COUNT(DISTINCT s.id)::int as sales_count,
        ROUND(COALESCE(SUM(s.total_amount), 0)::numeric, 2)::float as revenue,
        ROUND(COALESCE(SUM(si.unit_cost), 0)::numeric, 2)::float as cost,
        ROUND((COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(si.unit_cost), 0))::numeric, 2)::float as profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM-DD')
      ORDER BY date ASC
      LIMIT 15
    `);

    // 7. Retorno de fardos (ROI)
    const balesPerfRes = await client.query(`
      SELECT 
        b.id,
        b.code,
        b.name,
        b.category,
        ROUND((b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses)::numeric, 2)::float as invested_cost,
        b.actual_pieces as total_pieces,
        COUNT(g.id)::int as registered_pieces,
        COALESCE(SUM(CASE WHEN g.status = 'vendido' THEN 1 ELSE 0 END), 0)::int as sold_pieces,
        COALESCE(SUM(CASE WHEN g.status = 'disponible' THEN 1 ELSE 0 END), 0)::int as available_pieces,
        COALESCE(ROUND(SUM(CASE WHEN g.status = 'vendido' THEN si.unit_price ELSE 0 END)::numeric, 2), 0)::float as recovered_revenue
      FROM bales b
      LEFT JOIN garments g ON b.id = g.bale_id
      LEFT JOIN sale_items si ON g.id = si.garment_id
      GROUP BY b.id
      ORDER BY b.id ASC
    `);

    const balePerformance = balesPerfRes.rows.map(b => {
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

    // 8. Ventas por categoría
    const catRes = await client.query(`
      SELECT 
        g.category,
        COUNT(si.id)::int as count,
        ROUND(COALESCE(SUM(si.unit_price), 0)::numeric, 2)::float as revenue,
        ROUND(COALESCE(SUM(si.profit), 0)::numeric, 2)::float as profit
      FROM sale_items si
      JOIN garments g ON si.garment_id = g.id
      GROUP BY g.category
      ORDER BY revenue DESC
    `);

    // 9. Desglose de costos
    const costBreakdown = {
      purchase: balesCostSummary.total_purchase,
      shipping: balesCostSummary.total_shipping,
      customs: balesCostSummary.total_customs,
      conditioning: balesCostSummary.total_conditioning,
      operating_expenses: expensesSummary.total_operating_expenses
    };

    // 10. Ventas recientes
    const recentRes = await client.query(`
      SELECT 
        s.id,
        s.invoice_code,
        TO_CHAR(s.sale_date, 'YYYY-MM-DD HH24:MI') as sale_date,
        s.total_amount::float as total_amount,
        s.payment_status,
        s.payment_method,
        c.name as customer_name,
        c.instagram as customer_instagram
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
      LIMIT 5
    `);

    return {
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCollected: Number((salesSummary.total_collected || 0).toFixed(2)),
        pendingReceivables: Number((salesSummary.pending_receivables || 0).toFixed(2)),
        costOfSold: Number(costOfSold.toFixed(2)),
        totalBalesInvested: Number((balesCostSummary.total_bales_invested || 0).toFixed(2)),
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
      salesTimeline: timelineRes.rows,
      balePerformance,
      salesByCategory: catRes.rows,
      costBreakdown,
      recentSales: recentRes.rows
    };
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------------------------
// FARDOS (Bales) - POSTGRESQL
// ------------------------------------------------------------------------------
async function getAllBales() {
  const query = `
    SELECT 
      b.*,
      ROUND((b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses)::numeric, 2)::float as calculated_total_cost,
      (SELECT COUNT(*)::int FROM garments g WHERE g.bale_id = b.id) as garments_count,
      (SELECT COUNT(*)::int FROM garments g WHERE g.bale_id = b.id AND g.status = 'disponible') as garments_available,
      (SELECT COUNT(*)::int FROM garments g WHERE g.bale_id = b.id AND g.status = 'vendido') as garments_sold,
      (SELECT COALESCE(SUM(si.unit_price), 0)::float FROM garments g JOIN sale_items si ON g.id = si.garment_id WHERE g.bale_id = b.id) as total_recovered
    FROM bales b
    ORDER BY b.id DESC
  `;
  const res = await pool.query(query);
  return res.rows;
}

async function getBaleById(id) {
  const baleRes = await pool.query(`
    SELECT b.*, ROUND((b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses)::numeric, 2)::float as calculated_total_cost
    FROM bales b WHERE b.id = $1
  `, [id]);
  if (baleRes.rows.length === 0) return null;

  const garmentsRes = await pool.query('SELECT * FROM garments WHERE bale_id = $1 ORDER BY id DESC', [id]);
  return { ...baleRes.rows[0], garments: garmentsRes.rows };
}

async function createBale(data) {
  const code = data.code || `FARDO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
  const query = `
    INSERT INTO bales (code, name, category, supplier, origin_country, purchase_cost, shipping_cost, customs_cost, other_expenses, weight_kg, estimated_pieces, actual_pieces, arrival_date, status, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id
  `;
  const values = [
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
  ];
  const res = await pool.query(query, values);
  return getBaleById(res.rows[0].id);
}

async function updateBale(id, data) {
  const query = `
    UPDATE bales 
    SET name = $1, category = $2, supplier = $3, origin_country = $4, purchase_cost = $5, shipping_cost = $6, customs_cost = $7, other_expenses = $8, weight_kg = $9, estimated_pieces = $10, actual_pieces = $11, arrival_date = $12, status = $13, notes = $14
    WHERE id = $15
  `;
  const values = [
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
  ];
  await pool.query(query, values);
  return getBaleById(id);
}

async function deleteBale(id) {
  return pool.query('DELETE FROM bales WHERE id = $1', [id]);
}

async function unpackBaleGarments(baleId, count, baseCategory, defaultPrice) {
  const baleRes = await pool.query(`
    SELECT *, (purchase_cost + shipping_cost + customs_cost + other_expenses) as total_cost
    FROM bales WHERE id = $1
  `, [baleId]);

  if (baleRes.rows.length === 0) throw new Error('Fardo no encontrado');
  const bale = baleRes.rows[0];

  const unitCost = count > 0 ? Number((bale.total_cost / count).toFixed(2)) : 0;
  const timestamp = Date.now();

  for (let i = 1; i <= count; i++) {
    const sku = `${bale.code.replace('FARDO-', 'F').replace('FAR-', 'F')}-${String(i).padStart(3, '0')}`;
    const name = `Prenda #${i} - ${baseCategory || bale.category}`;
    const barcode = `779${String(timestamp + i).slice(-9)}`;

    await pool.query(`
      INSERT INTO garments (bale_id, sku, name, category, brand, size, color, condition, cost_price, sale_price, status, barcode, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
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
    ]);
  }

  await pool.query(`
    UPDATE bales 
    SET actual_pieces = (SELECT COUNT(*)::int FROM garments WHERE bale_id = $1), status = 'abierto_activo' 
    WHERE id = $1
  `, [baleId]);

  return { message: `Se generaron exitosamente ${count} prendas del fardo ${bale.code}`, count };
}

// ------------------------------------------------------------------------------
// PRENDAS / INVENTARIO - POSTGRESQL
// ------------------------------------------------------------------------------
async function getAllGarments(filters = {}) {
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
    params.push(filters.status);
    sql += ` AND g.status = $${params.length}`;
  }
  if (filters.bale_id) {
    params.push(filters.bale_id);
    sql += ` AND g.bale_id = $${params.length}`;
  }
  if (filters.category) {
    params.push(filters.category);
    sql += ` AND g.category = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const pIdx = params.length;
    sql += ` AND (g.name ILIKE $${pIdx} OR g.sku ILIKE $${pIdx} OR g.brand ILIKE $${pIdx} OR g.color ILIKE $${pIdx})`;
  }

  sql += ` ORDER BY g.id DESC`;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function getGarmentById(id) {
  const res = await pool.query(`
    SELECT g.*, b.code as bale_code, b.name as bale_name
    FROM garments g
    LEFT JOIN bales b ON g.bale_id = b.id
    WHERE g.id = $1
  `, [id]);
  return res.rows[0] || null;
}

async function createGarment(data) {
  const sku = data.sku && data.sku.trim() !== '' 
    ? data.sku.trim().toUpperCase() 
    : `CHIC-${String(Date.now()).slice(-4)}`;
  const barcode = data.barcode || `779${String(Date.now()).slice(-9)}`;

  const query = `
    INSERT INTO garments (bale_id, sku, name, category, brand, size, color, condition, cost_price, sale_price, status, barcode, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `;
  const values = [
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
  ];
  const res = await pool.query(query, values);
  return getGarmentById(res.rows[0].id);
}

async function updateGarment(id, data) {
  const query = `
    UPDATE garments
    SET bale_id = $1, sku = $2, name = $3, category = $4, brand = $5, size = $6, color = $7, condition = $8, cost_price = $9, sale_price = $10, status = $11, barcode = $12, notes = $13
    WHERE id = $14
  `;
  const values = [
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
  ];
  await pool.query(query, values);
  return getGarmentById(id);
}

async function deleteGarment(id) {
  return pool.query('DELETE FROM garments WHERE id = $1', [id]);
}

// ------------------------------------------------------------------------------
// CLIENTAS - POSTGRESQL
// ------------------------------------------------------------------------------
async function getAllCustomers() {
  const query = `
    SELECT 
      c.*,
      COUNT(s.id)::int as sales_count,
      COALESCE(SUM(s.total_amount), 0)::float as total_spent,
      COALESCE(SUM(CASE WHEN s.payment_status = 'pendiente' OR s.payment_status = 'seña_anticipo' THEN (s.total_amount - s.amount_paid) ELSE 0 END), 0)::float as debt_amount
    FROM customers c
    LEFT JOIN sales s ON c.id = s.customer_id
    GROUP BY c.id
    ORDER BY c.name ASC
  `;
  const res = await pool.query(query);
  return res.rows;
}

async function createCustomer(data) {
  const query = `
    INSERT INTO customers (name, phone, email, instagram, city, address, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    data.name,
    data.phone || '',
    data.email || '',
    data.instagram || '',
    data.city || '',
    data.address || '',
    data.notes || ''
  ];
  const res = await pool.query(query, values);
  return res.rows[0];
}

async function updateCustomer(id, data) {
  const query = `
    UPDATE customers
    SET name = $1, phone = $2, email = $3, instagram = $4, city = $5, address = $6, notes = $7
    WHERE id = $8
    RETURNING *
  `;
  const values = [
    data.name,
    data.phone,
    data.email,
    data.instagram,
    data.city,
    data.address,
    data.notes,
    id
  ];
  const res = await pool.query(query, values);
  return res.rows[0];
}

async function deleteCustomer(id) {
  return pool.query('DELETE FROM customers WHERE id = $1', [id]);
}

// ------------------------------------------------------------------------------
// VENTAS - POSTGRESQL
// ------------------------------------------------------------------------------
async function getAllSales() {
  const query = `
    SELECT 
      s.*,
      TO_CHAR(s.sale_date, 'YYYY-MM-DD HH24:MI') as sale_date,
      c.name as customer_name,
      c.phone as customer_phone,
      c.instagram as customer_instagram,
      (SELECT COUNT(*)::int FROM sale_items si WHERE si.sale_id = s.id) as items_count,
      (SELECT COALESCE(SUM(si.profit), 0)::float FROM sale_items si WHERE si.sale_id = s.id) as total_profit
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.id DESC
  `;
  const res = await pool.query(query);
  return res.rows;
}

async function getSaleById(id) {
  const saleRes = await pool.query(`
    SELECT 
      s.*,
      TO_CHAR(s.sale_date, 'YYYY-MM-DD HH24:MI') as sale_date,
      c.name as customer_name,
      c.phone as customer_phone,
      c.email as customer_email,
      c.instagram as customer_instagram,
      c.address as customer_address,
      c.city as customer_city
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = $1
  `, [id]);

  if (saleRes.rows.length === 0) return null;
  const sale = saleRes.rows[0];

  const itemsRes = await pool.query(`
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
    WHERE si.sale_id = $1
  `, [id]);

  return { ...sale, items: itemsRes.rows };
}

async function createSale(data) {
  if (!data.items || data.items.length === 0) {
    throw new Error('La venta debe incluir al menos una prenda');
  }

  const invoiceCode = data.invoice_code || `TICKET-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const garmentIds = data.items.map(item => typeof item === 'object' ? item.id : item);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Consultar prendas seleccionadas
    const garmentsRes = await client.query(`SELECT * FROM garments WHERE id = ANY($1::int[])`, [garmentIds]);
    const garments = garmentsRes.rows;

    if (garments.length !== garmentIds.length) {
      throw new Error('Una o más prendas seleccionadas no existen');
    }

    let subtotal = 0;
    for (const g of garments) {
      subtotal += parseFloat(g.sale_price);
    }

    const discount = Number(data.discount || 0);
    const totalAmount = Math.max(0, subtotal - discount);
    const paymentStatus = data.payment_status || 'pagado';
    const amountPaid = paymentStatus === 'pagado' ? totalAmount : Number(data.amount_paid || 0);

    const insertSaleRes = await client.query(`
      INSERT INTO sales (invoice_code, customer_id, subtotal, discount, total_amount, payment_status, amount_paid, payment_method, delivery_status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      invoiceCode,
      data.customer_id ? parseInt(data.customer_id) : null,
      subtotal,
      discount,
      totalAmount,
      paymentStatus,
      amountPaid,
      data.payment_method || 'Efectivo',
      data.delivery_status || 'Entregado en Mano',
      data.notes || ''
    ]);

    const saleId = insertSaleRes.rows[0].id;

    for (const g of garments) {
      await client.query(`
        INSERT INTO sale_items (sale_id, garment_id, unit_price, unit_cost)
        VALUES ($1, $2, $3, $4)
      `, [saleId, g.id, g.sale_price, g.cost_price]);

      await client.query(`UPDATE garments SET status = 'vendido' WHERE id = $1`, [g.id]);
    }

    await client.query('COMMIT');
    return getSaleById(saleId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateSalePayment(saleId, paymentStatus, amountPaid) {
  await pool.query(`
    UPDATE sales 
    SET payment_status = $1, amount_paid = $2 
    WHERE id = $3
  `, [paymentStatus, Number(amountPaid), saleId]);
  return getSaleById(saleId);
}

// ------------------------------------------------------------------------------
// GASTOS GENERALES - POSTGRESQL
// ------------------------------------------------------------------------------
async function getAllExpenses() {
  const res = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC');
  return res.rows;
}

async function createExpense(data) {
  const res = await pool.query(`
    INSERT INTO expenses (category, description, amount, expense_date, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    data.category || 'Varios',
    data.description,
    Number(data.amount || 0),
    data.expense_date || new Date().toISOString().slice(0, 10),
    data.notes || ''
  ]);
  return res.rows[0];
}

async function deleteExpense(id) {
  return pool.query('DELETE FROM expenses WHERE id = $1', [id]);
}

// Exportar funciones
module.exports = {
  pool,
  initDatabase,
  getDashboardMetrics,
  getAllBales,
  getBaleById,
  createBale,
  updateBale,
  deleteBale,
  unpackBaleGarments,
  getAllGarments,
  getGarmentById,
  createGarment,
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
  deleteExpense
};
