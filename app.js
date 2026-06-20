// ============================================================
// app.js — Frontend JavaScript for Karnal WMS (Learning Version)
// ============================================================
// This file runs IN THE BROWSER.
// It:
//   1. Handles page navigation (show/hide sections)
//   2. Fetches data from our Express server using fetch()
//   3. Builds HTML strings and inserts them into the page
//   4. Handles button clicks (mark house collected, etc.)
// ============================================================

// ── BASE_PATH: where our server is mounted ─────────────────────
// All API calls must include this prefix.
// In production this will be '/js-karnal', but we read it
// dynamically so this file works in any environment.
const BASE = window.location.pathname.replace(/\/(index\.html.*)?$/, "").replace(/\/$/, "");

// ── Helper: fetch JSON from the server ────────────────────────
// This wraps the browser's built-in fetch() to always parse JSON.
async function api(path) {
  const response = await fetch(`${BASE}/api${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}: ${path}`);
  return response.json();
}

// ── Helper: POST to the server ────────────────────────────────
async function apiPost(path) {
  const response = await fetch(`${BASE}/api${path}`, { method: "POST" });
  if (!response.ok) throw new Error(`API error ${response.status}: ${path}`);
  return response.json();
}

// ============================================================
// NAVIGATION
// ============================================================
// currentPage tracks which page is currently visible
let currentPage = "dashboard";

// showPage() hides all sections and shows the requested one.
// It also updates the nav link styles.
function showPage(name) {
  // Hide every page section
  document.querySelectorAll("section[id^='page-']").forEach((el) => {
    el.hidden = true;
  });

  // Show the requested page
  const target = document.getElementById(`page-${name}`);
  if (target) target.hidden = false;

  // Update nav link "active" class
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.remove("active");
  });
  const navBtn = document.getElementById(`nav-${name}`);
  if (navBtn) navBtn.classList.add("active");

  currentPage = name;

  // Load data for the page (each page has its own loader function)
  if (name === "dashboard")   loadDashboard();
  if (name === "routes")      loadRoutes();
  if (name === "warnings")    loadWarnings();
  if (name === "collections") loadCollections();
  if (name === "fuel")        loadFuel();
}

// ============================================================
// PAGE 1: DASHBOARD
// ============================================================
async function loadDashboard() {
  const el = document.getElementById("dashboard-content");
  el.innerHTML = `<div class="spinner">Loading…</div>`;

  try {
    // Fetch all dashboard data from the server in one call
    const data = await api("/dashboard");

    // ── Stat Cards ────────────────────────────────────────────
    // We use template literals (backtick strings) to build HTML.
    // ${variable} inserts a value into the string.
    const stats = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Active Trucks</div>
          <div class="value">${data.active_trucks}</div>
          <div class="sub">currently collecting</div>
        </div>
        <div class="stat-card">
          <div class="label">Houses Collected Today</div>
          <div class="value">${data.collected_today}</div>
          <div class="sub">across all routes</div>
        </div>
        <div class="stat-card">
          <div class="label">Critical Warnings</div>
          <div class="value" style="color:var(--red)">${data.critical_warnings}</div>
          <div class="sub">zones overdue 21+ days</div>
        </div>
        <div class="stat-card">
          <div class="label">Fuel Cost Saved Today</div>
          <div class="value" style="color:var(--green-light)">
            ₹${Math.round(data.fuel_saved).toLocaleString("en-IN")}
          </div>
          <div class="sub">via route optimization</div>
        </div>
      </div>
    `;

    // ── Zone Breakdown Table ───────────────────────────────────
    // data.zones is an array — we use .map() to convert each item
    // to an HTML table row, then join them into one string.
    const zoneRows = (data.zones || []).map((z) => {
      const pct = z.total_houses > 0
        ? Math.round((z.collected / z.total_houses) * 100)
        : 0;
      return `
        <tr>
          <td>${z.zone}</td>
          <td>${z.total_houses}</td>
          <td>${z.collected}</td>
          <td>${pct}%</td>
        </tr>
      `;
    }).join("");

    const zoneTable = `
      <div class="card">
        <div class="card-header">Zone Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Zone</th>
              <th>Total Houses</th>
              <th>Collected Today</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>${zoneRows}</tbody>
        </table>
      </div>
    `;

    // Put it all together on the page
    el.innerHTML = stats + zoneTable;

  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ============================================================
// PAGE 2: ROUTES LIST
// ============================================================
async function loadRoutes() {
  const el = document.getElementById("routes-content");
  el.innerHTML = `<div class="spinner">Loading…</div>`;

  try {
    const routes = await api("/routes");

    // Map status code to a readable badge
    function statusBadge(status) {
      if (status === "COMPLETED")   return `<span class="badge badge-green">Completed</span>`;
      if (status === "IN_PROGRESS") return `<span class="badge badge-blue">In Progress</span>`;
      return `<span class="badge badge-muted">Pending</span>`;
    }

    // Build a card for each route
    const cards = routes.map((r) => `
      <div class="route-card" onclick="loadRouteDetail(${r.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="route-name">${r.name}</div>
          ${statusBadge(r.status)}
        </div>
        <div class="route-meta">
          🚛 ${r.truck_id} &nbsp;·&nbsp; 👤 ${r.driver_name}
        </div>
        <div class="route-stats">
          <div>
            <strong>${r.total_houses || 0}</strong>
            Total Houses
          </div>
          <div>
            <strong>${r.collected_count || 0}</strong>
            Collected Today
          </div>
          <div>
            <strong style="color:var(--amber)">${r.warning_count || 0}</strong>
            Warnings
          </div>
          <div>
            <strong>${parseFloat(r.distance_km).toFixed(1)} km</strong>
            Distance
          </div>
        </div>
      </div>
    `).join("");

    el.innerHTML = `<div class="route-cards">${cards}</div>`;

  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ============================================================
// PAGE 3: ROUTE DETAIL
// ============================================================
async function loadRouteDetail(routeId) {
  // Show the route-detail section, hide others
  document.querySelectorAll("section[id^='page-']").forEach((el) => {
    el.hidden = true;
  });
  document.getElementById("page-route-detail").hidden = false;

  // Remove active class from nav
  document.querySelectorAll(".nav-link").forEach((b) => b.classList.remove("active"));
  document.getElementById("nav-routes").classList.add("active");

  const el = document.getElementById("route-detail-content");
  el.innerHTML = `<div class="spinner">Loading route data…</div>`;

  try {
    const route = await api(`/routes/${routeId}`);
    const houses = route.houses || [];

    // Run Dijkstra in the browser using our dijkstra.js file
    // We need at least 2 houses to run the algorithm
    let optimalPath = houses.map((h) => h.id); // fallback: original order
    let optimizedDist = parseFloat(route.distance_km) || 0;

    if (houses.length >= 2) {
      const dijkResult = runDijkstra(
        houses.map((h) => ({
          id:       h.id,
          lat:      parseFloat(h.lat),
          lng:      parseFloat(h.lng),
          priority: h.priority,
          address:  h.address,
        })),
        houses[0].id  // start from first house (depot)
      );
      optimalPath    = dijkResult.path;
      optimizedDist  = dijkResult.totalDistance;
    }

    // ── Dijkstra Result Card ──────────────────────────────────
    const originalDist  = parseFloat(route.distance_km) || 0;
    const savedKm       = Math.max(0, originalDist - optimizedDist);
    const savedL        = savedKm * 0.35;
    const savedRs       = savedL  * 105;

    const dijkCard = `
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          ⚡ Dijkstra Optimization Result
          <span class="badge badge-green">Optimized</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Original Distance</div>
              <div style="font-size:22px;font-weight:700;color:var(--text);margin-top:4px">${originalDist.toFixed(2)} km</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Optimized Distance</div>
              <div style="font-size:22px;font-weight:700;color:var(--green-light);margin-top:4px">${optimizedDist.toFixed(2)} km</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Fuel Saved</div>
              <div style="font-size:22px;font-weight:700;color:var(--amber);margin-top:4px">${savedL.toFixed(2)} L</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Cost Saved</div>
              <div style="font-size:22px;font-weight:700;color:var(--amber);margin-top:4px">₹${Math.round(savedRs)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // ── Priority Houses (those needing urgent collection) ─────
    const priorityHouses = houses.filter(
      (h) => h.priority === "CRITICAL" || h.priority === "HIGH"
    );

    function priorityBadge(p) {
      if (p === "CRITICAL") return `<span class="badge badge-red">CRITICAL</span>`;
      if (p === "HIGH")     return `<span class="badge badge-amber">HIGH</span>`;
      return `<span class="badge badge-muted">${p}</span>`;
    }

    const prioritySection = priorityHouses.length > 0 ? `
      <div class="card" style="margin-top:20px">
        <div class="card-header">⚠️ Priority Houses</div>
        <div class="card-body" style="padding-bottom:8px">
          ${priorityHouses.map((h) => `
            <div class="house-row">
              <div>
                <div class="house-address">${h.address}</div>
                <div class="house-meta">Last collected: ${
                  h.last_collected
                    ? new Date(h.last_collected).toLocaleDateString("en-IN")
                    : "Never"
                }</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                ${priorityBadge(h.priority)}
                ${h.is_collected_today
                  ? `<span class="badge badge-green">✓ Collected</span>`
                  : `<button class="btn btn-green btn-sm"
                             onclick="collectHouse(${h.id}, ${routeId})">
                       Collect
                     </button>`
                }
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    // ── Full House Table ──────────────────────────────────────
    const houseRows = houses.map((h, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${h.address}</td>
        <td>${h.resident_name || "—"}</td>
        <td>${priorityBadge(h.priority)}</td>
        <td>${h.last_collected ? new Date(h.last_collected).toLocaleDateString("en-IN") : "Never"}</td>
        <td>${h.is_collected_today
          ? `<span class="badge badge-green">✓ Done</span>`
          : `<button class="btn btn-ghost btn-sm"
                     onclick="collectHouse(${h.id}, ${routeId})">
               Mark Collected
             </button>`
        }</td>
      </tr>
    `).join("");

    const houseTable = `
      <div class="card" style="margin-top:20px">
        <div class="card-header">All Houses (${houses.length})</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Address</th>
              <th>Resident</th>
              <th>Priority</th>
              <th>Last Collected</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${houseRows}</tbody>
        </table>
      </div>
    `;

    // ── Status badge for route header ─────────────────────────
    function statusBadge(s) {
      if (s === "COMPLETED")   return `<span class="badge badge-green">Completed</span>`;
      if (s === "IN_PROGRESS") return `<span class="badge badge-blue">In Progress</span>`;
      return `<span class="badge badge-muted">Pending</span>`;
    }

    // ── Put everything together ───────────────────────────────
    el.innerHTML = `
      <div class="page-header">
        <h1 style="display:flex;align-items:center;gap:12px">
          ${route.name} ${statusBadge(route.status)}
        </h1>
        <p>🚛 ${route.truck_id} &nbsp;·&nbsp; 👤 ${route.driver_name} &nbsp;·&nbsp; 📍 ${route.zone}</p>
      </div>

      <!-- Dijkstra Graph -->
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          Dijkstra Route Graph
          <span style="font-size:11px;color:var(--muted);font-weight:400">
            Amber dashes = optimal path · Numbers = stop order
          </span>
        </div>
        <div class="card-body" style="padding:12px">
          <div class="graph-box" id="dijkstra-graph"></div>
        </div>
      </div>

      ${dijkCard}
      ${prioritySection}
      ${houseTable}
    `;

    // Draw the SVG graph AFTER the HTML is in the page
    // (the container div must exist in the DOM first)
    drawDijkstraGraph(
      houses.map((h) => ({
        id:       h.id,
        lat:      parseFloat(h.lat),
        lng:      parseFloat(h.lng),
        priority: h.priority,
        address:  h.address,
      })),
      optimalPath,
      "dijkstra-graph"
    );

  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ── Collect a single house ─────────────────────────────────────
// Called when the user clicks "Mark Collected" or "Collect"
async function collectHouse(houseId, routeId) {
  try {
    await apiPost(`/houses/${houseId}/collect`);
    // Reload the route detail page to show the updated state
    loadRouteDetail(routeId);
    // Also refresh the dashboard stats silently
    // (we don't navigate away, just update its data for next visit)
  } catch (err) {
    alert("Failed to mark house as collected: " + err.message);
  }
}

// ============================================================
// PAGE 4: WARNINGS
// ============================================================
async function loadWarnings() {
  const el = document.getElementById("warnings-content");
  el.innerHTML = `<div class="spinner">Loading…</div>`;

  try {
    const warnings = await api("/warnings");

    const critical = warnings.filter((w) => w.priority === "CRITICAL");
    const high     = warnings.filter((w) => w.priority === "HIGH");

    // Show red alert banner if there are CRITICAL zones
    const banner = critical.length > 0 ? `
      <div class="warning-banner">
        <div class="banner-icon">🚨</div>
        <div>
          <div class="banner-title">
            ${critical.length} Critical Zone${critical.length !== 1 ? "s" : ""} — Immediate Collection Required
          </div>
          <div class="banner-body">
            These areas have not had garbage collected in 21+ days.
            Health risk is high. Dispatch a truck immediately.
          </div>
        </div>
      </div>
    ` : "";

    // Build a row for each warning
    function warningRow(w) {
      const badgeClass = w.priority === "CRITICAL" ? "badge-red" : "badge-amber";
      return `
        <tr>
          <td>${w.address}</td>
          <td>${w.zone}</td>
          <td>${w.route_name}</td>
          <td>
            <span class="badge ${badgeClass}">${w.priority}</span>
          </td>
          <td style="color:var(--red);font-weight:600">
            ${w.days_overdue} days
          </td>
          <td>${w.last_collected ? new Date(w.last_collected).toLocaleDateString("en-IN") : "Never"}</td>
        </tr>
      `;
    }

    const table = warnings.length === 0
      ? `<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px">
           ✅ No priority warnings — all zones are up to date.
         </div></div>`
      : `
        <div class="card">
          <div class="card-header">
            Overdue Houses (${warnings.length})
            <span class="badge badge-red">${critical.length} Critical</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Zone</th>
                <th>Route</th>
                <th>Priority</th>
                <th>Days Overdue</th>
                <th>Last Collected</th>
              </tr>
            </thead>
            <tbody>
              ${warnings.map(warningRow).join("")}
            </tbody>
          </table>
        </div>
      `;

    el.innerHTML = banner + table;

  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ============================================================
// PAGE 5: COLLECTIONS LOG (with 7-day tab selector)
// ============================================================
// Track which date is currently selected
let selectedCollectionDate = todayDateString();

// Returns today's date as "YYYY-MM-DD"
function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

// Build an array of the last 7 days [{label, value, short}, ...]
function getLast7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const value = d.toISOString().split("T")[0];
    const short = i === 0 ? "Today" : i === 1 ? "Yesterday"
      : d.toLocaleDateString("en-IN", { weekday: "short" });
    const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const label   = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    days.push({ value, short, dateStr, label });
  }
  return days;
}

async function loadCollections(date) {
  if (date) selectedCollectionDate = date;

  const el = document.getElementById("collections-content");

  const days = getLast7Days();

  // Build the tab strip HTML
  const tabs = days.map((d) => `
    <button class="tab-btn ${d.value === selectedCollectionDate ? "active" : ""}"
            onclick="loadCollections('${d.value}')">
      <span class="tab-day">${d.short}</span>
      <span class="tab-date">${d.dateStr}</span>
    </button>
  `).join("");

  const tabBar = `<div class="tab-bar">${tabs}</div>`;

  // Show a "loading" spinner while we fetch
  el.innerHTML = tabBar + `<div class="spinner">Loading…</div>`;

  try {
    const collections = await api(`/collections?date=${selectedCollectionDate}`);

    const selectedDay = days.find((d) => d.value === selectedCollectionDate);

    if (collections.length === 0) {
      el.innerHTML = tabBar + `
        <div class="card">
          <div class="card-body" style="text-align:center;color:var(--muted);padding:40px">
            No collections recorded for ${selectedDay?.label || selectedCollectionDate}.
          </div>
        </div>
      `;
      return;
    }

    // Group collections by route_id
    // reduce() builds a dictionary: { routeId: [collection, ...], ... }
    const grouped = collections.reduce((acc, c) => {
      if (!acc[c.route_id]) acc[c.route_id] = [];
      acc[c.route_id].push(c);
      return acc;
    }, {});

    const summary = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13px">
        <span style="color:var(--green-light)">✓</span>
        <strong>${selectedDay?.label}</strong>
        <span style="color:var(--muted)">—</span>
        <span style="color:var(--green-light);font-weight:600">${collections.length} houses collected</span>
        <span style="color:var(--muted)">across ${Object.keys(grouped).length} route(s)</span>
      </div>
    `;

    // Build a card for each route group
    const routeCards = Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([routeId, cols]) => {
        const routeName = cols[0].route_name;
        const rows = cols.map((c) => `
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:10px 16px;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:500">
                ✅ ${c.address}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">
                📍 ${c.area || ""}
              </div>
            </div>
            <div style="font-size:12px;color:var(--muted);font-family:monospace">
              ${new Date(c.collected_at).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit", hour12: true
              })}
            </div>
          </div>
        `).join("");

        return `
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              🚛 ${routeName}
              <span style="font-size:12px;color:var(--muted);font-weight:400">
                ${cols.length} collection${cols.length !== 1 ? "s" : ""}
              </span>
            </div>
            ${rows}
          </div>
        `;
      }).join("");

    el.innerHTML = tabBar + summary + routeCards;

  } catch (err) {
    el.innerHTML = tabBar + `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ============================================================
// PAGE 6: FUEL SAVINGS
// ============================================================
async function loadFuel() {
  const el = document.getElementById("fuel-content");
  el.innerHTML = `<div class="spinner">Loading…</div>`;

  try {
    const data = await api("/fuel-savings");

    // Top summary boxes
    const summaryBoxes = `
      <div class="fuel-stat-grid">
        <div class="fuel-stat">
          <div class="fs-value" style="color:var(--green-light)">
            ${data.total_saved_km.toFixed(1)} km
          </div>
          <div class="fs-label">Total Distance Saved</div>
        </div>
        <div class="fuel-stat">
          <div class="fs-value" style="color:var(--amber)">
            ${data.total_saved_liters.toFixed(2)} L
          </div>
          <div class="fs-label">Fuel Saved (litres)</div>
        </div>
        <div class="fuel-stat">
          <div class="fs-value" style="color:var(--amber)">
            ₹${Math.round(data.total_saved_inr).toLocaleString("en-IN")}
          </div>
          <div class="fs-label">Cost Saved (₹)</div>
        </div>
        <div class="fuel-stat">
          <div class="fs-value" style="color:var(--blue)">
            ${data.efficiency_percent}%
          </div>
          <div class="fs-label">Route Efficiency</div>
        </div>
      </div>
    `;

    // Per-route breakdown table
    const rows = (data.routes || []).map((r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.zone}</td>
        <td>${parseFloat(r.original_km).toFixed(2)} km</td>
        <td style="color:var(--green-light)">${parseFloat(r.optimized_km).toFixed(2)} km</td>
        <td style="color:var(--amber)">
          ${r.saved_km > 0 ? `${parseFloat(r.saved_km).toFixed(2)} km` : "—"}
        </td>
        <td style="color:var(--amber)">
          ${r.saved_liters > 0 ? `${parseFloat(r.saved_liters).toFixed(2)} L` : "—"}
        </td>
        <td style="color:var(--green-light);font-weight:600">
          ${r.saved_inr > 0 ? `₹${Math.round(r.saved_inr)}` : "—"}
        </td>
      </tr>
    `).join("");

    const table = `
      <div class="card">
        <div class="card-header">Per-Route Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>Zone</th>
              <th>Original</th>
              <th>Optimized</th>
              <th>Saved (km)</th>
              <th>Fuel Saved</th>
              <th>Cost Saved</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    el.innerHTML = summaryBoxes + table;

  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ============================================================
// STARTUP — load the dashboard when the page first opens
// ============================================================
// This runs once when the browser loads app.js
loadDashboard();
