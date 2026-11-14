# FreshMart Cold Storage - Backend Project

Backend REST API for **FreshMart Cold Storage**, built with Node.js, Express.js, and SQLite.

---

## Faculty Requirements Met
1. **Exactly Three Related Database Tables:** `vendors`, `shelves`, and `leases` (with foreign keys).
2. **Complete CRUD APIs for Shelves:** Create, Read, Update, Delete (Soft), and Read single shelf.
3. **API using SQL JOIN:** `GET /leases` joins `leases`, `vendors`, and `shelves` to show full lease details with vendor and shelf names.
4. **Validation with Clear Error Messages:** Validates non-empty names and numeric temperatures with HTTP 400 responses.
5. **Search Shelves with Query Parameters:** Filter active shelves by `?temperature=...` or `?max_temp=...`.
6. **Soft Delete Shelves:** Sets `is_deleted = 1` to hide deleted shelves from active views and searches.
7. **Restore Shelves:** `POST /shelves/:id/restore` sets `is_deleted = 0`.

---

## Tech Stack
- **Node.js**
- **Express.js** (`^5.3.0`)
- **SQLite3** (`^6.0.1`)
- **JavaScript (CommonJS)**

---

## Database Schema

Foreign key enforcement is enabled via `PRAGMA foreign_keys = ON;`.

```sql
-- 1. Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT NOT NULL
);

-- 2. Shelves
CREATE TABLE IF NOT EXISTS shelves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  temperature REAL NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

-- 3. Leases
CREATE TABLE IF NOT EXISTS leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  shelf_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (shelf_id) REFERENCES shelves(id)
);
```

---

## Getting Started

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Start the Server
Start the Express server on port 3000:
```bash
npm start
```
The server will start at: `http://localhost:3000`

### 3. Run Automated Verification Tests
Run the comprehensive verification test suite:
```bash
npm test
```
or
```bash
node test_verification.js
```

---

## API Documentation

### Shelves Endpoints (`/shelves`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shelves` | List all active shelves (`is_deleted = 0`) |
| `GET` | `/shelves?temperature=-20` | Filter active shelves with exact temperature |
| `GET` | `/shelves?max_temp=4` | Filter active shelves with temperature $\le 4^\circ\text{C}$ |
| `GET` | `/shelves/:id` | Get single active shelf by ID (404 if soft-deleted or missing) |
| `POST` | `/shelves` | Create a new shelf |
| `PUT` | `/shelves/:id` | Update an active shelf |
| `DELETE` | `/shelves/:id` | Soft delete a shelf (`is_deleted = 1`) |
| `POST` | `/shelves/:id/restore` | Restore a soft-deleted shelf (`is_deleted = 0`) |

#### Sample Request: Create Shelf
`POST /shelves`
```json
{
  "name": "Produce Freezer Zone G",
  "temperature": -15.0
}
```

#### Sample Response: Create Shelf (201 Created)
```json
{
  "id": 6,
  "name": "Produce Freezer Zone G",
  "temperature": -15,
  "is_deleted": 0
}
```

#### Sample Validation Error (400 Bad Request)
```json
{
  "error": "Shelf name is required and must be a non-empty string."
}
```

---

### Leases Endpoint (`/leases`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/leases` | List all leases with joined vendor and shelf details |

#### SQL JOIN Query:
```sql
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
INNER JOIN shelves ON leases.shelf_id = shelves.id;
```

#### Sample Response: `GET /leases` (200 OK)
```json
[
  {
    "id": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "vendor_id": 1,
    "vendor_name": "Green Valley Farms",
    "vendor_contact": "vendor1@greenvalley.com",
    "shelf_id": 2,
    "shelf_name": "Chilled Produce Shelf B",
    "shelf_temperature": 4,
    "shelf_is_deleted": 0
  }
]
```

---

## Postman Collection
Import the file [FreshMart_Cold_Storage.postman_collection.json](file:///c:/Users/L.%20Bharath%20Kumar/Downloads/FreshMart-Cold-Storage/FreshMart_Cold_Storage.postman_collection.json) into Postman to test:
- All active shelf listings
- Temperature search filters (`?temperature=-20`, `?max_temp=4`)
- Successful CRUD, soft delete, and restore
- 400 validation error cases
- 404 deleted shelf access case
- SQL JOIN lease query
