const express = require('express');
const router = express.Router();
const db = require('../database');

// Validation helper
function validateShelfInput(name, temperature) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return 'Shelf name is required and must be a non-empty string.';
  }
  if (temperature === undefined || temperature === null || temperature === '' || isNaN(Number(temperature))) {
    return 'Shelf temperature is required and must be a valid number.';
  }
  return null;
}

// 1. GET /shelves - return active shelves with optional temperature search
router.get('/', (req, res) => {
  let sql = 'SELECT * FROM shelves WHERE is_deleted = 0';
  const params = [];

  // Exact temperature filter
  if (req.query.temperature !== undefined) {
    const temp = Number(req.query.temperature);
    if (isNaN(temp)) {
      return res.status(400).json({ error: 'Query parameter "temperature" must be a valid number.' });
    }
    sql += ' AND temperature = ?';
    params.push(temp);
  }

  // Maximum temperature filter (e.g. ?max_temp=4)
  if (req.query.max_temp !== undefined) {
    const maxTemp = Number(req.query.max_temp);
    if (isNaN(maxTemp)) {
      return res.status(400).json({ error: 'Query parameter "max_temp" must be a valid number.' });
    }
    sql += ' AND temperature <= ?';
    params.push(maxTemp);
  }

  // Minimum temperature filter (e.g. ?min_temp=-5)
  if (req.query.min_temp !== undefined) {
    const minTemp = Number(req.query.min_temp);
    if (isNaN(minTemp)) {
      return res.status(400).json({ error: 'Query parameter "min_temp" must be a valid number.' });
    }
    sql += ' AND temperature >= ?';
    params.push(minTemp);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 2. GET /shelves/:id - return one active shelf; 404 if missing or soft-deleted
router.get('/:id', (req, res) => {
  const shelfId = req.params.id;
  const sql = 'SELECT * FROM shelves WHERE id = ? AND is_deleted = 0';

  db.get(sql, [shelfId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Active shelf not found.' });
    }
    res.json(row);
  });
});

// 3. POST /shelves - create a shelf with validation
router.post('/', (req, res) => {
  const { name, temperature } = req.body || {};

  const validationError = validateShelfInput(name, temperature);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const sql = 'INSERT INTO shelves (name, temperature, is_deleted) VALUES (?, ?, 0)';
  const params = [name.trim(), Number(temperature)];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const newShelfId = this.lastID;
    db.get('SELECT * FROM shelves WHERE id = ?', [newShelfId], (fetchErr, newShelf) => {
      if (fetchErr) {
        return res.status(500).json({ error: fetchErr.message });
      }
      res.status(201).json(newShelf);
    });
  });
});

// 4. PUT /shelves/:id - update an active shelf with validation
router.put('/:id', (req, res) => {
  const shelfId = req.params.id;
  const { name, temperature } = req.body || {};

  const validationError = validateShelfInput(name, temperature);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Check if active shelf exists
  db.get('SELECT * FROM shelves WHERE id = ? AND is_deleted = 0', [shelfId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Active shelf not found.' });
    }

    const sql = 'UPDATE shelves SET name = ?, temperature = ? WHERE id = ?';
    const params = [name.trim(), Number(temperature), shelfId];

    db.run(sql, params, function (updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }
      db.get('SELECT * FROM shelves WHERE id = ?', [shelfId], (fetchErr, updatedShelf) => {
        if (fetchErr) {
          return res.status(500).json({ error: fetchErr.message });
        }
        res.json({
          message: 'Shelf updated successfully.',
          shelf: updatedShelf
        });
      });
    });
  });
});

// 5. DELETE /shelves/:id - soft delete by setting is_deleted = 1
router.delete('/:id', (req, res) => {
  const shelfId = req.params.id;

  db.get('SELECT * FROM shelves WHERE id = ?', [shelfId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Shelf not found.' });
    }
    if (row.is_deleted === 1) {
      return res.status(400).json({ error: 'Shelf is already deleted.' });
    }

    db.run('UPDATE shelves SET is_deleted = 1 WHERE id = ?', [shelfId], function (updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }
      res.json({
        message: 'Shelf soft-deleted successfully.',
        id: Number(shelfId)
      });
    });
  });
});

// 6. POST /shelves/:id/restore - restore by setting is_deleted = 0
router.post('/:id/restore', (req, res) => {
  const shelfId = req.params.id;

  db.get('SELECT * FROM shelves WHERE id = ?', [shelfId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Shelf not found.' });
    }
    if (row.is_deleted === 0) {
      return res.status(400).json({ error: 'Shelf is not deleted.' });
    }

    db.run('UPDATE shelves SET is_deleted = 0 WHERE id = ?', [shelfId], function (updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }
      res.json({
        message: 'Shelf restored successfully.',
        id: Number(shelfId)
      });
    });
  });
});

module.exports = router;
