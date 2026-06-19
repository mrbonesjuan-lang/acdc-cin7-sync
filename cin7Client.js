// cin7Client.js
// Small wrapper around the Cin7 Omni API. Handles auth and pagination.

const axios = require('axios');

const BASE_URL = 'https://api.cin7.com/api/v1';

function makeClient() {
  const user = process.env.CIN7_API_USER;
  const key  = process.env.CIN7_API_KEY;

  if (!user || !key) {
    throw new Error('Missing CIN7_API_USER or CIN7_API_KEY in environment');
  }

  const auth = Buffer.from(`${user}:${key}`).toString('base64');

  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

// Fetch all sales orders updated since a given date, paging through results.
// `sinceISO` should look like '2026-06-01T00:00:00'
async function fetchSalesOrders(sinceISO, maxPages = 20) {
  const client = makeClient();
  let page = 1;
  let allOrders = [];

  while (page <= maxPages) {
    const res = await client.get('/SalesOrders', {
      params: {
        page,
        rows: 100,
        updatedSince: sinceISO,
      },
    });

    const items = res.data.SaleList || res.data.Items || res.data || [];
    if (!Array.isArray(items) || items.length === 0) break;

    allOrders = allOrders.concat(items);
    if (items.length < 100) break; // last page
    page++;
  }

  return allOrders;
}

// Fetch full product/stock list, paging through results.
async function fetchProducts(maxPages = 20) {
  const client = makeClient();
  let page = 1;
  let allProducts = [];

  while (page <= maxPages) {
    const res = await client.get('/Products', {
      params: {
        page,
        rows: 100,
        includeDeprecated: false,
      },
    });

    const items = res.data.ProductList || res.data.Items || res.data || [];
    if (!Array.isArray(items) || items.length === 0) break;

    allProducts = allProducts.concat(items);
    if (items.length < 100) break;
    page++;
  }

  return allProducts;
}

// Some Cin7 Omni accounts return full line-item detail only from a
// single-order detail endpoint. If your /SalesOrders response above
// already includes a `Lines` array per order, you don't need this.
async function fetchSalesOrderDetail(orderId) {
  const client = makeClient();
  const res = await client.get(`/SalesOrders/${orderId}`);
  return res.data;
}

module.exports = { fetchSalesOrders, fetchProducts, fetchSalesOrderDetail };
