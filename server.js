// ============================================================
// server.js — Plain JavaScript Express Server
// Karnal District Waste Management System (Learning Version)
// ============================================================
// This file runs on Node.js (on the server, not in the browser).
// It does two things:
//   1. Serves the HTML/CSS/JS files to the browser (like a file host)
//   2. Handles API requests — reads from PostgreSQL and sends JSON back

// ── Imports ──────────────────────────────────────────────────
// "require" is how you import packages in Node.js (CommonJS style)
const express = require("express");        // web framework
const { Pool } = require("pg");            // PostgreSQL client
const path    = require("path");           // file path utilities

// ── Configuration ─────────────────────────────────────────────
// process.env reads environment variables (set by Replit/the OS)
const PORT      = process.env.PORT      || 3001;
const BASE_PATH = process.env.BASE_PATH || "/js-karnal";

// ── Database Connection ───────────────────────────────────────
// Pool manages multiple database connections automatically.
// DATABASE_URL is a single string like:
//   postgres://user:password@host:5432/dbname
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Test the connection on startup
db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL database"))
  .catch((err) => console.error("❌ Database connection error:", err.message));

// ── Express App Setup ─────────────────────────────────────────
const app = express();
app.use(express.json()); // parse JSON bodies from POST requests

// Serve static files (index.html, style.css, app.js, dijkstra.js)
// from the "public" folder
app.use(BASE_PATH, express.static(path.join(__dirname, "public")));

// ── Helper: run a SQL query and return rows ───────────────────
async function query(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows;
}

// ── API Endpoint 1: Dashboard Stats ───────────────────────────
// GET /js-karnal/api/dashboard
// Returns totals for the top stat cards
app.get(`${BASE_PATH}/api/dashboard`, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // "2026-06-19"

    // Count routes with status IN_PROGRESS
    const [{ active_trucks }] = await query(`
      SELECT COUNT(*) AS active_trucks FROM routes WHERE status = 'IN_PROGRESS'
    `);

    // Count houses collected today
    const [{ collected_today }] = await query(`
      SELECT COUNT(*) AS collected_today FROM collections
      WHERE DATE(collected_at) = $1
    `, [today]);

    // Count CRITICAL priority houses not collected in 21+ days
    const [{ critical_warnings }] = await query(`
      SELECT COUNT(*) AS critical_warnings FROM houses
      WHERE last_collected < NOW() - INTERVAL '21 days'
        AND priority = 'CRITICAL'
    `);

    // Sum fuel saved across all routes
    // Formula: (original_distance - optimized_distance) × 0.35 L/km × ₹105/L
    const [{ fuel_saved }] = await query(`
      SELECT COALESCE(SUM((distance_km - optimized_distance_km) * 0.35 * 105), 0) AS fuel_saved
      FROM routes WHERE optimized_distance_km IS NOT NULL
    `);

    // Zone breakdown — houses per zone with collection status
    const zones = await query(`
      SELECT r.zone,
             COUNT(h.id)                                          AS total_houses,
             COUNT(CASE WHEN h.is_collected_today THEN 1 END)    AS collected
      FROM routes r
      LEFT JOIN houses h ON h.route_id = r.id
      GROUP BY r.zone
      ORDER BY r.zone
    `);

    res.json({ active_trucks, collected_today, critical_warnings, fuel_saved, zones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 2: List All Routes ───────────────────────────
// GET /js-karnal/api/routes
app.get(`${BASE_PATH}/api/routes`, async (req, res) => {
  try {
    const routes = await query(`
      SELECT r.*,
             COUNT(h.id)                                        AS total_houses,
             COUNT(CASE WHEN h.is_collected_today THEN 1 END)  AS collected_count,
             COUNT(CASE WHEN h.priority IN ('HIGH','CRITICAL')
                        AND h.last_collected < NOW() - INTERVAL '14 days'
                        THEN 1 END)                             AS warning_count
      FROM routes r
      LEFT JOIN houses h ON h.route_id = r.id
      GROUP BY r.id
      ORDER BY r.id
    `);
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 3: Single Route + Houses ─────────────────────
// GET /js-karnal/api/routes/:id
app.get(`${BASE_PATH}/api/routes/:id`, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); // always parse to integer

    const [route] = await query(`SELECT * FROM routes WHERE id = $1`, [id]);
    if (!route) return res.status(404).json({ error: "Route not found" });

    const houses = await query(`
      SELECT * FROM houses WHERE route_id = $1 ORDER BY id
    `, [id]);

    res.json({ ...route, houses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 4: Mark House as Collected ───────────────────
// POST /js-karnal/api/houses/:id/collect
app.post(`${BASE_PATH}/api/houses/:id/collect`, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Update the house record
    const [house] = await query(`
      UPDATE houses
      SET is_collected_today = true, last_collected = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!house) return res.status(404).json({ error: "House not found" });

    // Also add a record to the collections log
    await query(`
      INSERT INTO collections (house_id, route_id, collected_at)
      VALUES ($1, $2, NOW())
    `, [house.id, house.route_id]);

    res.json(house);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 5: Priority Warnings ─────────────────────────
// GET /js-karnal/api/warnings
// Returns houses not collected in 14+ days with HIGH or CRITICAL priority
app.get(`${BASE_PATH}/api/warnings`, async (req, res) => {
  try {
    const warnings = await query(`
      SELECT h.*,
             r.name        AS route_name,
             r.zone        AS zone,
             EXTRACT(DAY FROM NOW() - h.last_collected)::int AS days_overdue
      FROM houses h
      JOIN routes r ON r.id = h.route_id
      WHERE h.last_collected < NOW() - INTERVAL '14 days'
        AND h.priority IN ('HIGH', 'CRITICAL')
      ORDER BY h.priority DESC, days_overdue DESC
    `);
    res.json(warnings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 6: Collection Log ────────────────────────────
// GET /js-karnal/api/collections?date=2026-06-19
app.get(`${BASE_PATH}/api/collections`, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];

    const collections = await query(`
      SELECT c.id, c.collected_at,
             h.address, h.area, h.priority,
             r.id   AS route_id,
             r.name AS route_name
      FROM collections c
      JOIN houses h ON h.id = c.house_id
      JOIN routes r ON r.id = c.route_id
      WHERE DATE(c.collected_at) = $1
      ORDER BY c.collected_at ASC
    `, [date]);

    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Endpoint 7: Fuel Savings ──────────────────────────────
// GET /js-karnal/api/fuel-savings
app.get(`${BASE_PATH}/api/fuel-savings`, async (req, res) => {
  try {
    const LITERS_PER_KM = 0.35;  // diesel consumption per km
    const PRICE_PER_LITER = 105; // ₹ per litre of diesel

    const routes = await query(`
      SELECT id, name, zone, distance_km, optimized_distance_km, status
      FROM routes ORDER BY id
    `);

    const routesWithSavings = routes.map((r) => {
      const original  = parseFloat(r.distance_km)          || 0;
      const optimized = parseFloat(r.optimized_distance_km) || original;
      const savedKm   = Math.max(0, original - optimized);
      const savedL    = savedKm * LITERS_PER_KM;
      const savedRs   = savedL  * PRICE_PER_LITER;
      return { ...r, original_km: original, optimized_km: optimized, saved_km: savedKm, saved_liters: savedL, saved_inr: savedRs };
    });

    const totalSavedKm = routesWithSavings.reduce((s, r) => s + r.saved_km, 0);
    const totalSavedL  = totalSavedKm * LITERS_PER_KM;
    const totalSavedRs = totalSavedL  * PRICE_PER_LITER;
    const avgOriginal  = routesWithSavings.reduce((s, r) => s + r.original_km, 0) / routesWithSavings.length;
    const avgOptimized = routesWithSavings.reduce((s, r) => s + r.optimized_km, 0) / routesWithSavings.length;
    const efficiency   = avgOriginal > 0 ? Math.round((1 - avgOptimized / avgOriginal) * 100) : 0;

    res.json({
      total_saved_km: totalSavedKm,
      total_saved_liters: totalSavedL,
      total_saved_inr: totalSavedRs,
      efficiency_percent: efficiency,
      routes: routesWithSavings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Catch-All: Serve index.html for all non-API routes ────────
// This makes the single-page app work when the user navigates directly
app.get(`${BASE_PATH}/*`, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start the Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚛 Karnal WMS (JS version) running at http://localhost:${PORT}${BASE_PATH}`);
});
