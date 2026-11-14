const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /leases - Return all leases with joined vendor and shelf details
router.get('/', (req, res) => {
  const sql = `
    SELECT 
      leases.id,
      leases.start_date,
      leases.end_date,
      leases.vendor_id,
      vendors.name AS vendor_name,
      vendors.contact AS vendor_contact,
      leases.shelf_id,
      shelves.name AS shelf_name,
      shelves.temperature AS shelf_temperature,
      shelves.is_deleted AS shelf_is_deleted
    FROM leases
    INNER JOIN vendors ON leases.vendor_id = vendors.id
    INNER JOIN shelves ON leases.shelf_id = shelves.id
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
