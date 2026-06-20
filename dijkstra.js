// ============================================================
// dijkstra.js — Dijkstra's Shortest Path Algorithm
// Karnal District Waste Management System (Learning Version)
// ============================================================
// This file runs IN THE BROWSER (not on the server).
// It calculates the most efficient order to visit all houses
// on a garbage truck route, saving fuel and time.
//
// CONCEPT: Imagine you need to visit 10 houses. There are
// millions of possible orderings. Dijkstra finds the SHORTEST
// total path without trying every combination.
// ============================================================

// ── Step 1: Measure real-world distance between two GPS points ──
// We use the "Haversine Formula" which accounts for Earth's curvature.
// Without this, we'd be calculating straight lines on a flat map —
// which is wrong for large distances.

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometres

  // Convert degrees to radians (Math functions need radians)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1); // difference in latitude
  const dLon = toRad(lon2 - lon1); // difference in longitude

  // The haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in kilometres
}

// ── Step 2: Priority Boost ────────────────────────────────────
// High-priority houses (waste piling up!) should be visited sooner.
// We reduce the "effective distance" so Dijkstra prefers visiting them.

function effectiveDistance(dist, priority) {
  if (priority === "CRITICAL") return dist * 0.70; // 30% boost → visited first
  if (priority === "HIGH")     return dist * 0.85; // 15% boost → visited sooner
  return dist;                                      // LOW/MEDIUM: no change
}

// ── Step 3: Dijkstra's Algorithm ─────────────────────────────
// Input:  nodes = array of { id, lat, lng, priority, address }
//         startId = the id of the depot / starting house
// Output: { path: [id, id, ...], totalDistance: number }

function runDijkstra(nodes, startId) {
  // "distances" stores the shortest known distance from startId to each node
  // We start with Infinity (unknown) for everything except the start
  const distances = {};
  const previous  = {};  // tracks which node we came from (to reconstruct path)
  const visited   = new Set(); // nodes we've already finalised

  for (const node of nodes) {
    distances[node.id] = node.id === startId ? 0 : Infinity;
    previous[node.id]  = null;
  }

  // Keep looping until every node has been finalised
  while (visited.size < nodes.length) {
    // ── Pick the unvisited node with the SMALLEST known distance ──
    // This is the key step: always expand the nearest unvisited node.
    let current = null;
    let smallest = Infinity;
    for (const node of nodes) {
      if (!visited.has(node.id) && distances[node.id] < smallest) {
        smallest = distances[node.id];
        current  = node;
      }
    }

    if (!current) break; // all remaining nodes are unreachable (shouldn't happen)

    visited.add(current.id); // mark as finalised

    // ── Update distances to all UNVISITED neighbours ──────────
    for (const neighbour of nodes) {
      if (visited.has(neighbour.id)) continue; // already done, skip

      // Real GPS distance between current and neighbour
      const realDist = haversineDistance(
        current.lat, current.lng,
        neighbour.lat, neighbour.lng
      );

      // Apply priority discount so urgent stops are visited first
      const adjustedDist = effectiveDistance(realDist, neighbour.priority);

      // If going via "current" gives a shorter path to "neighbour" → update
      const newDist = distances[current.id] + adjustedDist;
      if (newDist < distances[neighbour.id]) {
        distances[neighbour.id] = newDist;
        previous[neighbour.id]  = current.id;
      }
    }
  }

  // ── Reconstruct the path by following "previous" backwards ──
  // We trace from the last node back to the start to get the ordered path.
  const unvisitedNodes = nodes.filter((n) => n.id !== startId);

  // Build visit order by picking smallest distance repeatedly
  const orderedPath = [];
  const remaining   = new Set(unvisitedNodes.map((n) => n.id));

  let currentId = startId;
  orderedPath.push(startId);

  while (remaining.size > 0) {
    let nextId   = null;
    let nextDist = Infinity;

    for (const id of remaining) {
      const node    = nodes.find((n) => n.id === id);
      const current = nodes.find((n) => n.id === currentId);
      const d       = effectiveDistance(
        haversineDistance(current.lat, current.lng, node.lat, node.lng),
        node.priority
      );
      if (d < nextDist) {
        nextDist = d;
        nextId   = id;
      }
    }

    if (!nextId) break;
    orderedPath.push(nextId);
    remaining.delete(nextId);
    currentId = nextId;
  }

  // Calculate the REAL total distance (without priority adjustments)
  let totalDistance = 0;
  for (let i = 1; i < orderedPath.length; i++) {
    const a = nodes.find((n) => n.id === orderedPath[i - 1]);
    const b = nodes.find((n) => n.id === orderedPath[i]);
    totalDistance += haversineDistance(a.lat, a.lng, b.lat, b.lng);
  }

  return { path: orderedPath, totalDistance };
}

// ── Step 4: Draw the route as an SVG graph ────────────────────
// SVG = Scalable Vector Graphics — shapes drawn with code inside HTML.
// We convert GPS coordinates to pixel positions on a 2D canvas.

function drawDijkstraGraph(houses, optimalPath, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !houses.length) return;

  const W = container.clientWidth  || 600;
  const H = container.clientHeight || 340;
  const PADDING = 50;

  // Find min/max lat/lng so we can scale all points to fit in the box
  const lats = houses.map((h) => parseFloat(h.lat));
  const lngs = houses.map((h) => parseFloat(h.lng));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Convert GPS coordinates to SVG pixel coordinates
  function toSvg(lat, lng) {
    const latRange = maxLat - minLat || 0.001; // avoid division by zero
    const lngRange = maxLng - minLng || 0.001;
    // Note: lat increases upward (south → north) so we flip Y
    const x = PADDING + ((lng - minLng) / lngRange) * (W - 2 * PADDING);
    const y = PADDING + ((maxLat - lat) / latRange) * (H - 2 * PADDING);
    return { x, y };
  }

  // Colour-code nodes by priority
  function nodeColor(priority) {
    if (priority === "CRITICAL") return "#ef4444"; // red
    if (priority === "HIGH")     return "#f59e0b"; // amber
    if (priority === "MEDIUM")   return "#3b82f6"; // blue
    return "#22c55e";                              // green for LOW
  }

  const positions = {}; // store {x,y} for each house id

  // Build the SVG markup as a string
  // (This is like writing HTML but for graphics)
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += `<rect width="${W}" height="${H}" fill="#0f1a13" rx="8"/>`;

  // ── Draw faint lines between all consecutive houses ──────────
  for (let i = 0; i < houses.length - 1; i++) {
    const a = toSvg(houses[i].lat, houses[i].lng);
    const b = toSvg(houses[i + 1].lat, houses[i + 1].lng);
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
                  stroke="#1e3a2a" stroke-width="1"/>`;
  }
  // Store positions
  houses.forEach((h) => { positions[h.id] = toSvg(h.lat, h.lng); });

  // ── Draw the OPTIMAL PATH as an amber dashed line ─────────────
  if (optimalPath.length > 1) {
    for (let i = 0; i < optimalPath.length - 1; i++) {
      const a = positions[optimalPath[i]];
      const b = positions[optimalPath[i + 1]];
      if (a && b) {
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
                      stroke="#f59e0b" stroke-width="2.5"
                      stroke-dasharray="8,4" opacity="0.9"/>`;
      }
    }
  }

  // ── Draw nodes (circles) for each house ───────────────────────
  houses.forEach((h) => {
    const { x, y } = positions[h.id];
    const color     = nodeColor(h.priority);
    const stopIndex = optimalPath.indexOf(h.id);
    const stopNum   = stopIndex >= 0 ? stopIndex + 1 : "";

    // Outer circle (glow effect)
    svg += `<circle cx="${x}" cy="${y}" r="14" fill="${color}" opacity="0.15"/>`;
    // Inner filled circle
    svg += `<circle cx="${x}" cy="${y}" r="9" fill="${color}" stroke="#0f1a13" stroke-width="1.5"/>`;
    // Stop number inside the circle
    svg += `<text x="${x}" y="${y + 4}" text-anchor="middle"
                  font-size="8" fill="white" font-weight="bold">${stopNum}</text>`;
    // House address tooltip (title tag shows on hover)
    svg += `<title>${h.address} (${h.priority})</title>`;
  });

  svg += `</svg>`;

  // Inject the SVG into the page
  container.innerHTML = svg;
}
