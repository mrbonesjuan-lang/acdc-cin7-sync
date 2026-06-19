// db/schema.js
// Creates the tables we need in PostgreSQL. Safe to run multiple times —
// it only creates tables if they don't already exist.

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sales_orders (
  order_id        TEXT PRIMARY KEY,
  order_number    TEXT,
  customer_name   TEXT,
  sales_rep       TEXT,
  status          TEXT,
  order_date      DATE,
  total           NUMERIC(14,2),
  tax             NUMERIC(14,2),
  raw_json        JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  line_id         TEXT PRIMARY KEY,
  order_id        TEXT REFERENCES sales_orders(order_id),
  product_name    TEXT,
  product_sku     TEXT,
  category        TEXT,
  quantity        NUMERIC(14,3),
  unit_price      NUMERIC(14,2),
  line_total      NUMERIC(14,2),
  order_date      DATE,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  sku             TEXT PRIMARY KEY,
  product_name    TEXT,
  category        TEXT,
  stock_on_hand   NUMERIC(14,3),
  stock_available NUMERIC(14,3),
  reorder_point   NUMERIC(14,3),
  price           NUMERIC(14,2),
  cost             NUMERIC(14,2),
  raw_json        JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_log (
  id              SERIAL PRIMARY KEY,
  run_at          TIMESTAMPTZ DEFAULT now(),
  orders_synced   INT,
  products_synced INT,
  status          TEXT,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_date ON sales_order_lines(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_category ON sales_order_lines(category);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
`;

async function ensureSchema(pool) {
  await pool.query(SCHEMA_SQL);
  console.log('✓ Database schema ready');
}

module.exports = { ensureSchema };
