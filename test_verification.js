const app = require('./src/server');
const db = require('./src/database');
const http = require('http');

// In-memory HTTP request dispatcher for Express app testing
function request(app, options) {
  return new Promise((resolve) => {
    const { method = 'GET', url = '/', body = null } = options;

    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;

    if (body) {
      req.body = body;
      req._body = true; // Signals express body parsers that body is already parsed
    }

    const res = new http.ServerResponse(req);
    let resBody = '';

    res.write = function(chunk) {
      if (chunk) resBody += chunk;
      return true;
    };

    res.end = function(chunk) {
      if (chunk) resBody += chunk;
      let json = resBody;
      try {
        json = JSON.parse(resBody);
      } catch (e) {}
      resolve({
        statusCode: res.statusCode,
        body: json
      });
    };

    app.handle(req, res);
  });
}

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('       FRESHMART COLD STORAGE - FACULTY REQUIREMENTS TEST       ');
  console.log('================================================================\n');

  let allPassed = true;
  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Detail: ${details}`);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Express server starts successfully
  // -------------------------------------------------------------
  await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      assert(port > 0, '1. Express server starts and binds to port successfully');
      server.close(resolve);
    });
  });

  // -------------------------------------------------------------
  // Test 2: SQLite has exactly three related tables: vendors, shelves, leases
  // -------------------------------------------------------------
  await new Promise((resolve) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, tables) => {
      if (err) {
        assert(false, '2. SQLite table check', err.message);
        return resolve();
      }
      const tableNames = tables.map(t => t.name).sort();
      const expected = ['leases', 'shelves', 'vendors'];
      const isMatch = tableNames.length === 3 && JSON.stringify(tableNames) === JSON.stringify(expected);
      assert(isMatch, `2. SQLite has exactly three tables: ${tableNames.join(', ')}`, `Found: ${JSON.stringify(tableNames)}`);
      resolve();
    });
  });

  // -------------------------------------------------------------
  // Test 3: Complete CRUD shelf APIs work
  // -------------------------------------------------------------
  // 3a: GET /shelves (list active shelves)
  const listRes = await request(app, { method: 'GET', url: '/shelves' });
  const listActiveOnly = Array.isArray(listRes.body) && listRes.body.every(s => s.is_deleted === 0);
  assert(listRes.statusCode === 200 && listActiveOnly, '3a. GET /shelves returns 200 and lists active shelves only');

  // 3b: POST /shelves (Create new shelf)
  const postRes = await request(app, {
    method: 'POST',
    url: '/shelves',
    body: { name: 'Fresh Berry Freezer #9', temperature: -15.5 }
  });
  const createdId = postRes.body && postRes.body.id;
  assert(postRes.statusCode === 201 && createdId && postRes.body.name === 'Fresh Berry Freezer #9',
    `3b. POST /shelves creates shelf and returns 201 (Created ID: ${createdId})`);

  // 3c: GET /shelves/:id (Read by ID)
  const getByIdRes = await request(app, { method: 'GET', url: `/shelves/${createdId}` });
  assert(getByIdRes.statusCode === 200 && getByIdRes.body.id === createdId,
    `3c. GET /shelves/${createdId} returns 200 with shelf details`);

  // 3d: PUT /shelves/:id (Update shelf)
  const putRes = await request(app, {
    method: 'PUT',
    url: `/shelves/${createdId}`,
    body: { name: 'Fresh Berry Freezer #9 - Updated', temperature: -18.0 }
  });
  assert(putRes.statusCode === 200 && putRes.body.shelf && putRes.body.shelf.temperature === -18.0,
    `3d. PUT /shelves/${createdId} updates shelf successfully`);

  // 3e: DELETE /shelves/:id (Soft delete)
  const deleteCrudRes = await request(app, { method: 'DELETE', url: `/shelves/${createdId}` });
  assert(deleteCrudRes.statusCode === 200 && deleteCrudRes.body.message,
    `3e. DELETE /shelves/${createdId} soft-deletes shelf`);

  // -------------------------------------------------------------
  // Test 4: GET /leases returns correct vendor and shelf names using SQL JOIN
  // -------------------------------------------------------------
  const leasesRes = await request(app, { method: 'GET', url: '/leases' });
  const validLeases = leasesRes.statusCode === 200 &&
    leasesRes.body.length > 0 &&
    leasesRes.body.every(l => l.id && l.vendor_name && l.shelf_name && l.start_date && l.end_date);
  assert(validLeases, '4. GET /leases returns joined data with vendor_name and shelf_name via SQL INNER JOIN',
    JSON.stringify(leasesRes.body[0]));

  // -------------------------------------------------------------
  // Test 5: Validation with clear 400 error messages
  // -------------------------------------------------------------
  const emptyNameRes = await request(app, {
    method: 'POST',
    url: '/shelves',
    body: { name: '   ', temperature: 4 }
  });
  assert(emptyNameRes.statusCode === 400 && emptyNameRes.body.error === 'Shelf name is required and must be a non-empty string.',
    '5a. Validation: Empty shelf name returns 400 with clear message', JSON.stringify(emptyNameRes.body));

  const invalidTempRes = await request(app, {
    method: 'POST',
    url: '/shelves',
    body: { name: 'Valid Shelf Name', temperature: 'frozen' }
  });
  assert(invalidTempRes.statusCode === 400 && invalidTempRes.body.error === 'Shelf temperature is required and must be a valid number.',
    '5b. Validation: Non-numeric temperature returns 400 with clear message', JSON.stringify(invalidTempRes.body));

  // -------------------------------------------------------------
  // Test 6: Search works using temperature query parameters
  // -------------------------------------------------------------
  const tempExactRes = await request(app, { method: 'GET', url: '/shelves?temperature=-20' });
  const exactMatch = tempExactRes.statusCode === 200 &&
    tempExactRes.body.length > 0 &&
    tempExactRes.body.every(s => s.temperature === -20 && s.is_deleted === 0);
  assert(exactMatch, '6a. Search GET /shelves?temperature=-20 returns only active shelves with temperature = -20');

  const maxTempRes = await request(app, { method: 'GET', url: '/shelves?max_temp=4' });
  const maxTempMatch = maxTempRes.statusCode === 200 &&
    maxTempRes.body.length > 0 &&
    maxTempRes.body.every(s => s.temperature <= 4 && s.is_deleted === 0);
  assert(maxTempMatch, '6b. Search GET /shelves?max_temp=4 returns only active shelves with temperature <= 4');

  // -------------------------------------------------------------
  // Test 7: Soft delete and restore exact sequence
  // -------------------------------------------------------------
  // First, check whether shelf ID 7 exists in the database
  const targetId = await new Promise((resolve) => {
    db.get('SELECT id, is_deleted FROM shelves WHERE id = 7', async (err, row) => {
      if (row) {
        // Shelf 7 exists. If it was deleted, restore it first so we can run the test sequence cleanly
        if (row.is_deleted === 1) {
          db.run('UPDATE shelves SET is_deleted = 0 WHERE id = 7', () => resolve(7));
        } else {
          resolve(7);
        }
      } else {
        // Shelf 7 doesn't exist, insert shelf with id 7 or take created ID
        db.run("INSERT INTO shelves (id, name, temperature, is_deleted) VALUES (7, 'Faculty Test Shelf 7', -10.0, 0)", function(insertErr) {
          if (!insertErr) {
            resolve(7);
          } else {
            // If explicit ID insertion fails, resolve with createdId
            resolve(createdId);
          }
        });
      }
    });
  });

  console.log(`\n--- Requirement 7: Soft Delete & Restore Sequence on Shelf ID: ${targetId} ---`);

  // Step 7a: DELETE /shelves/:id returns 200
  const stepDelete = await request(app, { method: 'DELETE', url: `/shelves/${targetId}` });
  assert(stepDelete.statusCode === 200 && stepDelete.body.message,
    `7a. DELETE /shelves/${targetId} returns 200 (is_deleted set to 1)`);

  // Step 7b: GET /shelves/:id returns 404
  const stepGetDeleted = await request(app, { method: 'GET', url: `/shelves/${targetId}` });
  assert(stepGetDeleted.statusCode === 404,
    `7b. GET /shelves/${targetId} returns 404 (soft-deleted shelf is hidden)`);

  // Step 7c: POST /shelves/:id/restore restores it
  const stepRestore = await request(app, { method: 'POST', url: `/shelves/${targetId}/restore` });
  assert(stepRestore.statusCode === 200 && stepRestore.body.message,
    `7c. POST /shelves/${targetId}/restore returns 200 (is_deleted set to 0)`);

  // Step 7d: GET /shelves/:id returns 200
  const stepGetRestored = await request(app, { method: 'GET', url: `/shelves/${targetId}` });
  assert(stepGetRestored.statusCode === 200 && stepGetRestored.body.id === targetId,
    `7d. GET /shelves/${targetId} returns 200 (restored shelf is active)`);

  // Clean up any extra temporary test shelves created during testing (createdId and targetId if created)
  await new Promise((resolve) => {
    db.run('DELETE FROM shelves WHERE id IN (?, 7)', [createdId], () => {
      resolve();
    });
  });

  console.log('\n================================================================');
  if (allPassed) {
    console.log('   ALL 7 FACULTY REQUIREMENTS VERIFIED AND PASSED 100%!         ');
  } else {
    console.error('   VERIFICATION FAILED: See details above.                      ');
  }
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runComprehensiveVerification();
