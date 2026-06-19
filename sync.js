// sync.js
// Pulls fresh data from Cin7 Omni and upserts it into PostgreSQL.
// This is what runs on a schedule (every N minutes) instead of a webhook,
// since Cin7 Omni does not support custom webhooks for sales/stock events.

const { fetchSalesOrders, fetchProducts } = require('./cin7Client');

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('.')[0];
}

async function upsertOrder(pool, order) {
  const orderId = String(order.ID || order.SaleID || order.OrderID);
  const orderDate = order.CreatedDate || order.Date || order.OrderDate;

  await pool.query(
    `INSERT INTO sales_orders
      (order_id, order_number, customer_name, sales_rep, status, order_date, total, tax, raw_json, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (order_id) DO UPDATE SET
       order_number = EXCLUDED.order_number,
       customer_name = EXCLUDED.customer_name,
       sales_rep = EXCLUDED.sales_rep,
       status = EXCLUDED.status,
       order_date = EXCLUDED.order_date,
       total = EXCLUDED.total,
       tax = EXCLUDED.tax,
       raw_json = EXCLUDED.raw_json,
       synced_at = now()`,
    [
      orderId,
      order.OrderNumber || order.SaleOrderNumber || null,
      order.Customer || order.CustomerName || null,
      order.SalesRep || order.SalesPerson || null,
      order.Status || null,
      orderDate ? new Date(orderDate) : null,
      parseFloat(order.Total || order.GrandTotal || 0),
      parseFloat(order.Tax || 0),
      JSON.stringify(order),
    ]
  );

  const lines = order.Lines || order.SaleOrderLines || [];
  for (const line of lines) {
    const lineId = `${orderId}_${line.LineID || line.ID || Math.random().toString(36).slice(2)}`;
    await pool.query(
      `INSERT INTO sales_order_lines
        (line_id, order_id, product_name, product_sku, category, quantity, unit_price, line_total, order_date, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (line_id) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         product_sku = EXCLUDED.product_sku,
         category = EXCLUDED.category,
         quantity = EXCLUDED.quantity,
         unit_price = EXCLUDED.unit_price,
         line_total = EXCLUDED.line_total,
         order_date = EXCLUDED.order_date,
         synced_at = now()`,
      [
        lineId,
        orderId,
        line.Name || line.ProductName || null,
        line.SKU || line.ProductCode || null,
        line.ProductCategory || line.Category || 'Uncategorised',
        parseFloat(line.Quantity || 0),
        parseFloat(line.Price || line.UnitPrice || 0),
        parseFloat(line.Total || 0),
        orderDate ? new Date(orderDate) : null,
      ]
    );
  }
}

async function upsertProduct(pool, product) {
  const sku = product.SKU || product.ProductCode || product.Code;
  if (!sku) return;

  await pool.query(
    `INSERT INTO products
      (sku, product_name, category, stock_on_hand, stock_available, reorder_point, price, cost, raw_json, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (sku) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       category = EXCLUDED.category,
       stock_on_hand = EXCLUDED.stock_on_hand,
       stock_available = EXCLUDED.stock_available,
       reorder_point = EXCLUDED.reorder_point,
       price = EXCLUDED.price,
       cost = EXCLUDED.cost,
       raw_json = EXCLUDED.raw_json,
       synced_at = now()`,
    [
      sku,
      product.Name || product.ProductName || null,
      product.Category || product.CategoryName || 'Uncategorised',
      parseFloat(product.StockOnHand || product.OnHand || 0),
      parseFloat(product.Available || product.StockAvailable || 0),
      parseFloat(product.ReorderPoint || 0),
      parseFloat(product.PriceTier1 || product.Price || 0),
      parseFloat(product.AverageCost || product.Cost || 0),
      JSON.stringify(product),
    ]
  );
}

// Main sync job — call this on a schedule.
async function runSync(pool, { lookbackDays = 7 } = {}) {
  const startedAt = Date.now();
  let ordersSynced = 0;
  let productsSynced = 0;

  try {
    console.log(`[sync] starting — looking back ${lookbackDays} days`);

    const orders = await fetchSalesOrders(daysAgoISO(lookbackDays));
    for (const order of orders) {
      await upsertOrder(pool, order);
      ordersSynced++;
    }

    const products = await fetchProducts();
    for (const product of products) {
      await upsertProduct(pool, product);
      productsSynced++;
    }

    await pool.query(
      `INSERT INTO sync_log (orders_synced, products_synced, status) VALUES ($1,$2,$3)`,
      [ordersSynced, productsSynced, 'ok']
    );

    console.log(`[sync] done in ${Date.now() - startedAt}ms — ${ordersSynced} orders, ${productsSynced} products`);
  } catch (err) {
    console.error('[sync] FAILED:', err.message);
    await pool.query(
      `INSERT INTO sync_log (orders_synced, products_synced, status, error_message) VALUES ($1,$2,$3,$4)`,
      [ordersSynced, productsSynced, 'error', err.message]
    ).catch(() => {});
  }
}

module.exports = { runSync };
