const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'inventory.db');

function initDatabase() {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
  if (count.cnt === 0) {
    const insert = db.prepare(`
      INSERT INTO products (name, category, sku, price, quantity, description)
      VALUES (@name, @category, @sku, @price, @quantity, @description)
    `);

    const products = [
      { name: 'Wireless Bluetooth Headphones', category: 'Electronics', sku: 'ELEC-001', price: 79.99, quantity: 45, description: 'Over-ear noise cancelling headphones with 30h battery life' },
      { name: 'Mechanical Keyboard', category: 'Electronics', sku: 'ELEC-002', price: 129.99, quantity: 30, description: 'Compact TKL layout with RGB backlighting and tactile switches' },
      { name: 'USB-C Charging Hub', category: 'Electronics', sku: 'ELEC-003', price: 49.99, quantity: 60, description: '7-in-1 hub with HDMI, USB 3.0 and PD charging' },
      { name: 'Running Shoes', category: 'Footwear', sku: 'FOOT-001', price: 89.99, quantity: 75, description: 'Lightweight mesh running shoes with cushioned sole' },
      { name: 'Leather Wallet', category: 'Accessories', sku: 'ACCS-001', price: 34.99, quantity: 120, description: 'Slim genuine leather bifold wallet with RFID blocking' },
      { name: 'Stainless Steel Water Bottle', category: 'Kitchen', sku: 'KITC-001', price: 24.99, quantity: 90, description: '32 oz double-wall insulated bottle keeps drinks cold 24h' },
      { name: 'Yoga Mat', category: 'Sports', sku: 'SPRT-001', price: 39.99, quantity: 55, description: 'Non-slip eco-friendly TPE yoga mat 6mm thick' },
      { name: 'Coffee Maker', category: 'Kitchen', sku: 'KITC-002', price: 59.99, quantity: 25, description: '12-cup programmable drip coffee maker with auto shut-off' },
      { name: 'Sunglasses', category: 'Accessories', sku: 'ACCS-002', price: 45.00, quantity: 80, description: 'Polarized UV400 protection sunglasses with metal frame' },
      { name: 'Backpack', category: 'Bags', sku: 'BAGS-001', price: 69.99, quantity: 40, description: '30L water-resistant laptop backpack with USB charging port' },
      { name: 'Desk Lamp', category: 'Home', sku: 'HOME-001', price: 32.99, quantity: 35, description: 'LED desk lamp with 5 colour modes and wireless charging base' },
      { name: 'Notebook Set', category: 'Stationery', sku: 'STAT-001', price: 14.99, quantity: 200, description: 'Set of 3 ruled A5 notebooks with hardcover' },
      { name: 'Dumbbell Set', category: 'Sports', sku: 'SPRT-002', price: 119.99, quantity: 20, description: 'Adjustable dumbbell set 5–52.5 lbs each' },
      { name: 'Scented Candle', category: 'Home', sku: 'HOME-002', price: 18.99, quantity: 150, description: 'Soy wax candle with vanilla and sandalwood scent, 60h burn' },
      { name: 'Wireless Mouse', category: 'Electronics', sku: 'ELEC-004', price: 39.99, quantity: 50, description: 'Ergonomic 2.4G wireless mouse with silent click' },
      { name: 'Plant Pot Set', category: 'Garden', sku: 'GARD-001', price: 22.99, quantity: 70, description: 'Set of 4 ceramic plant pots with drainage holes' },
      { name: 'Resistance Bands', category: 'Sports', sku: 'SPRT-003', price: 19.99, quantity: 110, description: 'Set of 5 latex resistance bands for strength training' },
      { name: 'Throw Pillow', category: 'Home', sku: 'HOME-003', price: 16.99, quantity: 95, description: '18×18 inch decorative throw pillow with removable cover' },
      { name: 'Portable Charger', category: 'Electronics', sku: 'ELEC-005', price: 29.99, quantity: 65, description: '10000mAh slim power bank with dual USB-A and USB-C ports' },
      { name: 'Kitchen Scale', category: 'Kitchen', sku: 'KITC-003', price: 17.99, quantity: 85, description: 'Digital kitchen scale with 5kg capacity and 1g precision' },
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item);
    });

    insertMany(products);
    console.log('Database seeded with 20 products.');
  }

  return db;
}

module.exports = { initDatabase };
