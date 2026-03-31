/**
 * Simple API integration tests using Node's built-in `http` module.
 * Run with: node tests/api.test.js
 */

const http = require('http');

// Start server on a test port
process.env.PORT = 3099;

// Remove test DB if it exists so we start fresh
const fs = require('fs');
const path = require('path');
const DB_TEST = path.join(__dirname, '..', 'inventory.db');
if (fs.existsSync(DB_TEST)) fs.unlinkSync(DB_TEST);

const app = require('../server');

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3099,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 200));

  // 1. GET /api/products — should return 20 seeded products
  const list = await request('GET', '/api/products');
  assert('GET /api/products returns 200', list.status === 200);
  assert('GET /api/products returns 20 products', Array.isArray(list.body) && list.body.length === 20, `got ${list.body.length}`);

  // 2. GET /api/categories
  const cats = await request('GET', '/api/categories');
  assert('GET /api/categories returns 200', cats.status === 200);
  assert('Categories is a non-empty array', Array.isArray(cats.body) && cats.body.length > 0);

  // 3. POST /api/products — create new product
  const newProd = await request('POST', '/api/products', {
    name: 'Test Product', category: 'Testing', sku: 'TEST-001', price: 9.99, quantity: 5, description: 'A test item'
  });
  assert('POST /api/products returns 201', newProd.status === 201);
  assert('Created product has correct name', newProd.body.name === 'Test Product');
  const newId = newProd.body.id;

  // 4. POST duplicate SKU → 409
  const dup = await request('POST', '/api/products', {
    name: 'Dup', category: 'Testing', sku: 'TEST-001', price: 1, quantity: 1
  });
  assert('POST duplicate SKU returns 409', dup.status === 409);

  // 5. POST missing fields → 400
  const bad = await request('POST', '/api/products', { name: 'Incomplete' });
  assert('POST missing fields returns 400', bad.status === 400);

  // 6. PATCH /api/products/:id/quantity
  const patched = await request('PATCH', `/api/products/${newId}/quantity`, { quantity: 42 });
  assert('PATCH quantity returns 200', patched.status === 200);
  assert('PATCH quantity updates correctly', patched.body.quantity === 42);

  // 7. PATCH negative quantity → 400
  const badQty = await request('PATCH', `/api/products/${newId}/quantity`, { quantity: -1 });
  assert('PATCH negative quantity returns 400', badQty.status === 400);

  // 8. GET /api/products/:id
  const single = await request('GET', `/api/products/${newId}`);
  assert('GET /api/products/:id returns 200', single.status === 200);
  assert('GET single product returns correct id', single.body.id === newId);

  // 9. PUT /api/products/:id
  const updated = await request('PUT', `/api/products/${newId}`, {
    name: 'Updated Product', category: 'Testing', sku: 'TEST-001', price: 19.99, quantity: 10, description: 'updated'
  });
  assert('PUT /api/products/:id returns 200', updated.status === 200);
  assert('PUT updates product name', updated.body.name === 'Updated Product');

  // 10. GET with search filter
  const searched = await request('GET', '/api/products?search=Updated');
  assert('GET with search returns 200', searched.status === 200);
  assert('Search finds updated product', Array.isArray(searched.body) && searched.body.length >= 1);

  // 11. GET with category filter
  const filtered = await request('GET', '/api/products?category=Electronics');
  assert('GET with category filter returns 200', filtered.status === 200);
  assert('Category filter returns only Electronics', filtered.body.every(p => p.category === 'Electronics'));

  // 12. DELETE /api/products/:id
  const del = await request('DELETE', `/api/products/${newId}`);
  assert('DELETE /api/products/:id returns 200', del.status === 200);
  assert('DELETE returns success:true', del.body.success === true);

  // 13. GET deleted product → 404
  const gone = await request('GET', `/api/products/${newId}`);
  assert('GET deleted product returns 404', gone.status === 404);

  // Results
  console.log('\nInventory API Tests\n' + '─'.repeat(40));
  results.forEach(r => console.log(r));
  console.log('─'.repeat(40));
  console.log(`${passed} passed, ${failed} failed\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Small delay to let server bind
setTimeout(runTests, 300);
