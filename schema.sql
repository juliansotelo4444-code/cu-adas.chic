-- ==============================================================================
-- SISTEMA DE GESTIÓN DE FARDOS DE ROPA USADA & BOUTIQUE VINTAGE
-- Esquema de Base de Datos Relacional SQLite (SQL Estándar)
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. TABLA DE FARDOS (Bales)
-- Registra los lotes/fardos adquiridos, desglosando todos sus costos y gastos asociados.
CREATE TABLE IF NOT EXISTS bales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,                       -- Ej: 'FAR-2026-001'
    name TEXT NOT NULL,                              -- Ej: 'Fardo Chaquetas Vintage Denim USA'
    category TEXT NOT NULL,                          -- Ej: 'Abrigos & Chaquetas', 'Vestidos Seda', etc.
    supplier TEXT,                                   -- Proveedor o importadora
    origin_country TEXT DEFAULT 'Estados Unidos',   -- País de procedencia (USA, Corea, etc.)
    purchase_cost REAL NOT NULL DEFAULT 0.0,         -- Costo base de adquisición del fardo
    shipping_cost REAL NOT NULL DEFAULT 0.0,         -- Flete / Transporte internacional o local
    customs_cost REAL NOT NULL DEFAULT 0.0,          -- Aranceles aduaneros / Impuestos de importación
    other_expenses REAL NOT NULL DEFAULT 0.0,        -- Gastos adicionales (lavado, desinfección, perchas)
    total_cost REAL GENERATED ALWAYS AS (purchase_cost + shipping_cost + customs_cost + other_expenses) VIRTUAL,
    weight_kg REAL DEFAULT 0.0,                      -- Peso del fardo en kg
    estimated_pieces INTEGER DEFAULT 0,              -- Cantidad estimada según el proveedor
    actual_pieces INTEGER DEFAULT 0,                 -- Cantidad real de prendas útiles al abrirlo
    arrival_date TEXT NOT NULL,                      -- Fecha de recepción (YYYY-MM-DD)
    status TEXT NOT NULL DEFAULT 'recibido',         -- 'recibido', 'clasificando', 'abierto_activo', 'agotado'
    notes TEXT,                                      -- Observaciones sobre calidad, estado de las prendas
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. TABLA DE PRENDAS / INVENTARIO (Garments)
-- Inventario individualizado de cada prenda con código único (SKU) vinculado a su fardo de origen.
CREATE TABLE IF NOT EXISTS garments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bale_id INTEGER,                                 -- Fardo de procedencia (FK opcional)
    sku TEXT NOT NULL UNIQUE,                        -- Código único (Ej: 'ROSA-0101', 'FAR1-TOP-002')
    name TEXT NOT NULL,                              -- Nombre descriptivo (Ej: 'Blazer Oversized Lana')
    category TEXT NOT NULL,                          -- 'Chaquetas', 'Vestidos', 'Tops', 'Jeans', 'Accesorios'
    brand TEXT DEFAULT 'Vintage / Sin Marca',        -- Marca de la prenda (Levi's, Zara, Polo, etc.)
    size TEXT DEFAULT 'M',                           -- Talle (XS, S, M, L, XL, Único, etc.)
    color TEXT,                                      -- Color predominante (Rosa pastel, Dorado, etc.)
    condition TEXT DEFAULT 'Excelente',              -- 'Premium / Nueva con etiqueta', 'Excelente', 'Muy Bueno', 'Con Detalle'
    cost_price REAL NOT NULL DEFAULT 0.0,            -- Costo unitario prorrateado o asignado
    sale_price REAL NOT NULL DEFAULT 0.0,            -- Precio de venta al público
    status TEXT NOT NULL DEFAULT 'disponible',       -- 'disponible', 'reservado', 'vendido', 'descarte_merma'
    barcode TEXT,                                    -- Código de barras generado para impresión
    notes TEXT,                                      -- Medidas, detalles de bordado, etc.
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (bale_id) REFERENCES bales(id) ON DELETE SET NULL
);

-- 3. TABLA DE CLIENTES (Customers)
-- Registro de clientas, contacto, usuario de redes sociales (Instagram/WhatsApp) y dirección.
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                              -- Nombre y apellido
    phone TEXT,                                      -- WhatsApp de contacto
    email TEXT,                                      -- Correo electrónico
    instagram TEXT,                                  -- Usuario de Instagram (Ej: '@sofia_vintage')
    city TEXT,                                       -- Ciudad / Localidad
    address TEXT,                                    -- Dirección de envío o entrega
    notes TEXT,                                      -- Gustos, talles frecuentes, clienta frecuente
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4. TABLA DE VENTAS (Sales)
-- Cabecera de venta: información comercial, montos, estado del pago, método y entrega.
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_code TEXT NOT NULL UNIQUE,               -- Ej: 'VTA-2026-0001'
    customer_id INTEGER,                             -- Cliente asociado (FK opcional para venta rápida)
    sale_date TEXT NOT NULL,                         -- Fecha y hora (YYYY-MM-DD HH:MM)
    subtotal REAL NOT NULL DEFAULT 0.0,              -- Suma de prendas
    discount REAL NOT NULL DEFAULT 0.0,              -- Descuentos aplicados
    total_amount REAL NOT NULL DEFAULT 0.0,          -- Monto final neto de la venta
    payment_status TEXT NOT NULL DEFAULT 'pagado',   -- 'pagado', 'pendiente', 'seña_anticipo'
    amount_paid REAL NOT NULL DEFAULT 0.0,           -- Monto efectivamente cobrado hasta la fecha
    payment_method TEXT DEFAULT 'Efectivo',          -- 'Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Dólares'
    delivery_status TEXT DEFAULT 'Entregado',        -- 'Entregado', 'Retira Showroom', 'Envío Pendiente', 'Enviado'
    notes TEXT,                                      -- Observaciones, número de seguimiento de envío
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 5. TABLA DE DETALLE DE VENTA (Sale Items)
-- Relación de prendas vendidas en cada transacción para cálculo exacto de ingresos y márgenes de ganancia.
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    garment_id INTEGER NOT NULL,
    unit_price REAL NOT NULL,                        -- Precio al que se vendió
    unit_cost REAL NOT NULL,                         -- Costo que tenía la prenda (para ROI histórico)
    profit REAL GENERATED ALWAYS AS (unit_price - unit_cost) VIRTUAL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE RESTRICT
);

-- 6. TABLA DE GASTOS GENERALES (Expenses)
-- Gastos operativos ajenos a un fardo directo (ej: bolsas boutique rosa gold, publicidad, insumos).
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,                          -- 'Publicidad & Redes', 'Packaging & Etiquetas', 'Alquiler / Showroom', 'Insumos'
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Índices para optimizar búsquedas y reportes
CREATE INDEX IF NOT EXISTS idx_garments_bale ON garments(bale_id);
CREATE INDEX IF NOT EXISTS idx_garments_sku ON garments(sku);
CREATE INDEX IF NOT EXISTS idx_garments_status ON garments(status);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_garment ON sale_items(garment_id);
