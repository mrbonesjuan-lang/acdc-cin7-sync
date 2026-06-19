function registerDashboardRoutes(app, pool) {

  app.use('/dashboard', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    next();
  });

  app.get('/dashboard/revenue-over-time', async (req, res) => {
    const days = parseInt(req.query.days || '90', 10);
    try {
      const result = await pool.query(
        `SELECT date_trunc('week', order_date) AS week, SUM(total) AS revenue, COUNT(*) AS order_count
         FROM sales_orders WHERE order_date >= now() - interval '${days} days'
         GROUP BY week ORDER BY week ASC`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/dashboard/kpis', async (req, res) => {
    const days = parseInt(req.query.days || '90', 10);
    try {
      const totals = await pool.query(
        `SELECT COALESCE(SUM(total), 0) AS total_revenue, COUNT(*) AS order_count, COALESCE(AVG(total), 0) AS avg_order_value
         FROM sales_orders WHERE order_date >= now() - interval '${days} days'`
      );
      const lowStock = await pool.query(
        `SELECT COUNT(*) AS low_stock_count FROM products WHERE stock_available < 20`
      );
      res.json({ ...totals.rows[0], ...lowStock.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/dashboard/orders-by-status', async (req, res) => {
    const days = parseInt(req.query.days || '90', 10);
    try {
      const result = await pool.query(
        `SELECT status, COUNT(*) AS count FROM sales_orders
         WHERE order_date >= now() - interval '${days} days'
         GROUP BY status ORDER BY count DESC`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/dashboard/top-products', async (req, res) => {
    const days = parseInt(req.query.days || '90', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    try {
      const result = await pool.query(
        `SELECT product_name, category, SUM(line_total) AS revenue, SUM(quantity) AS qty
         FROM sales_order_lines WHERE order_date >= now() - interval '${days} days'
         GROUP BY product_name, category ORDER BY revenue DESC LIMIT ${limit}`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/dashboard/revenue-by-category', async (req, res) => {
    const days = parseInt(req.query.days || '90', 10);
    try {
      const result = await pool.query(
        `SELECT category, SUM(line_total) AS revenue FROM sales_order_lines
         WHERE order_date >= now() - interval '${days} days'
         GROUP BY category ORDER BY revenue DESC`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/dashboard/stock', async (req, res) => {
    const limit = parseInt(req.query.limit || '20', 10);
    try {
      const result = await pool.query(
        `SELECT product_name, category, stock_on_hand, stock_available
         FROM products ORDER BY stock_available ASC LIMIT ${limit}`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = { registerDashboardRoutes };
