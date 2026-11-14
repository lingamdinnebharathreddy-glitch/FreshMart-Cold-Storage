const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'cold_storage.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Initialize database schema and seed data
db.serialize(() => {
  // 1. Enable foreign key enforcement
  db.run('PRAGMA foreign_keys = ON;');

  // 2. Create tables
  // Table 1: vendors
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL
    );
  `);

  // Table 2: shelves
  db.run(`
    CREATE TABLE IF NOT EXISTS shelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      temperature REAL NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Table 3: leases
  db.run(`
    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      shelf_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (shelf_id) REFERENCES shelves(id)
    );
  `);

  // 3. Seed sample data if tables are empty
  db.get('SELECT COUNT(*) as count FROM vendors', (err, row) => {
    if (err) {
      console.error('Error checking vendors count:', err.message);
      return;
    }
    if (row.count === 0) {
      db.serialize(() => {
        // Seed vendors
        db.run("INSERT INTO vendors (name, contact) VALUES ('Green Valley Farms', 'vendor1@greenvalley.com')");
        db.run("INSERT INTO vendors (name, contact) VALUES ('Ocean Fresh Seafood', 'contact@oceanfresh.com')");
        db.run("INSERT INTO vendors (name, contact) VALUES ('Dairy Delight Co.', 'info@dairydelight.com')");

        // Seed shelves
        db.run("INSERT INTO shelves (name, temperature, is_deleted) VALUES ('Deep Freeze Zone A', -20.0, 0)");
        db.run("INSERT INTO shelves (name, temperature, is_deleted) VALUES ('Chilled Produce Shelf B', 4.0, 0)");
        db.run("INSERT INTO shelves (name, temperature, is_deleted) VALUES ('Dairy Cooler Shelf C', 2.0, 0)");
        db.run("INSERT INTO shelves (name, temperature, is_deleted) VALUES ('Meat Chiller Shelf D', -2.0, 0)");
        db.run("INSERT INTO shelves (name, temperature, is_deleted) VALUES ('Decommissioned Shelf E', 15.0, 1)");

        // Seed leases
        db.run("INSERT INTO leases (vendor_id, shelf_id, start_date, end_date) VALUES (1, 2, '2026-01-01', '2026-12-31')");
        db.run("INSERT INTO leases (vendor_id, shelf_id, start_date, end_date) VALUES (2, 1, '2026-02-01', '2026-08-31')");
        db.run("INSERT INTO leases (vendor_id, shelf_id, start_date, end_date) VALUES (3, 3, '2026-03-01', '2026-09-30')", (leaseErr) => {
          if (leaseErr) {
            console.error('Error seeding leases:', leaseErr.message);
          } else {
            console.log('Sample data seeded successfully.');
          }
        });
      });
    }
  });
});

module.exports = db;
