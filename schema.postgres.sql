-- ==============================================================================
-- CUÑADAS CHIC - ESQUEMA DE BASE DE DATOS POSTGRESQL (NEON.TECH)
-- ==============================================================================

-- 1. TABLA DE FARDOS
CREATE TABLE IF NOT EXISTS bales (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    supplier VARCHAR(255),
    origin_country VARCHAR(100) DEFAULT 'Estados Unidos',
    purchase_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    customs_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    other_expenses NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (purchase_cost + shipping_cost + customs_cost + other_expenses) STORED,
    weight_kg NUMERIC(8, 2) DEFAULT 0.00,
    estimated_pieces INTEGER DEFAULT 0,
    actual_pieces INTEGER DEFAULT 0,
    arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'recibido',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE PRENDAS
CREATE TABLE IF NOT EXISTS garments (
    id SERIAL PRIMARY KEY,
    bale_id INTEGER REFERENCES bales(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100) DEFAULT 'Vintage',
    size VARCHAR(50) DEFAULT 'M',
    color VARCHAR(100),
    condition VARCHAR(100) DEFAULT 'Excelente',
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'disponible',
    barcode VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE CLIENTAS
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    email VARCHAR(255),
    instagram VARCHAR(100),
    city VARCHAR(100),
    address VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE VENTAS
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    invoice_code VARCHAR(100) NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pagado',
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(100) DEFAULT 'Efectivo',
    delivery_status VARCHAR(100) DEFAULT 'Entregado en Mano',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA DE DETALLE DE VENTA
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    garment_id INTEGER NOT NULL REFERENCES garments(id) ON DELETE RESTRICT,
    unit_price NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    profit NUMERIC(10, 2) GENERATED ALWAYS AS (unit_price - unit_cost) STORED
);

-- 6. TABLA DE GASTOS
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas en Neon
CREATE INDEX IF NOT EXISTS idx_pg_garments_bale ON garments(bale_id);
CREATE INDEX IF NOT EXISTS idx_pg_garments_sku ON garments(sku);
CREATE INDEX IF NOT EXISTS idx_pg_garments_status ON garments(status);
CREATE INDEX IF NOT EXISTS idx_pg_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_pg_sale_items_sale ON sale_items(sale_id);
