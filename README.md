# Karnal District Waste Management System
### JavaScript Learning Version

A web-based waste management system for garbage trucks in the **Karnal district of Haryana, India**.  
Built with plain **HTML + CSS + JavaScript** (frontend) and **Node.js + Express** (backend).

---

## What it does

- 📊 **Dashboard** — live stats: active trucks, houses collected, critical warnings, fuel saved
- 🗺️ **Routes** — all 7 Karnal garbage collection routes with driver and truck info
- ⚡ **Dijkstra Algorithm** — finds the shortest path through all houses to save fuel
- ⚠️ **Warnings** — alerts for areas not collected in 14+ days (HIGH / CRITICAL badges)
- ☑️ **Collections** — 7-day log of every garbage pickup with timestamps
- ⛽ **Fuel Savings** — daily report: litres saved, ₹ cost saved, efficiency %

---

## Technologies used

| Layer | Technology | What it does |
|---|---|---|
| Frontend | HTML5 | Page structure |
| Frontend | CSS3 | Styling and layout |
| Frontend | Vanilla JavaScript | All interactivity and API calls |
| Backend | Node.js | Runs JavaScript on the server |
| Backend | Express.js | Web server and API routes |
| Database | PostgreSQL | Stores routes, houses, collections |
| Algorithm | Dijkstra (pure JS) | Finds optimal garbage collection path |

> **No React. No TypeScript. No build tools.** Just plain JavaScript — perfect for learning.

---

## Project structure

```
karnal-waste-management/
├── server.js          ← Express backend: API routes + serve static files
├── package.json       ← Project dependencies (express, pg)
├── README.md          ← This file
└── public/
    ├── index.html     ← Single HTML page (SPA)
    ├── style.css      ← All styling (dark green theme)
    ├── dijkstra.js    ← Dijkstra algorithm with step-by-step comments
    └── app.js         ← All frontend JavaScript with comments
```

---

## How to run locally

### Requirements
- [Node.js](https://nodejs.org/) v18 or higher
- A PostgreSQL database (free options: [Neon](https://neon.tech), [ElephantSQL](https://elephantsql.com))

### Steps

```bash
# 1. Clone or download this repository
git clone https://github.com/YOUR-USERNAME/karnal-waste-management.git
cd karnal-waste-management

# 2. Install dependencies
npm install

# 3. Set your database connection string
# On Windows:
set DATABASE_URL=postgres://user:password@host:5432/dbname

# On Mac/Linux:
export DATABASE_URL=postgres://user:password@host:5432/dbname

# 4. Start the server
node server.js

# 5. Open in browser
# Go to: http://localhost:3001/js-karnal
```

---

## How the Dijkstra algorithm works

```
Start (Depot)
    │
    ├─── House 1 (LOW priority)    distance: 0.74 km
    ├─── House 2 (HIGH priority)   effective distance: 0.63 km  ← boosted
    ├─── House 3 (CRITICAL)        effective distance: 0.52 km  ← boosted most
    └─── House 4 (LOW priority)    distance: 1.10 km

Dijkstra always picks the NEAREST unvisited house next.
CRITICAL houses get 30% distance reduction → visited first.
```

**Fuel formula:**  
`Distance saved (km) × 0.35 L/km × ₹105/L = Money saved (₹)`

---

## JavaScript concepts demonstrated in this project

| File | Concept |
|---|---|
| `app.js` | `async/await`, `fetch()`, template literals, `.map()`, `.reduce()` |
| `dijkstra.js` | functions, loops, `Math` functions, arrays, algorithm logic |
| `server.js` | `require()`, Express routes, `async/await`, SQL queries |
| `index.html` | linking HTML to JavaScript with `<script>` tags |

---

## Routes in Karnal district

| Route | Zone | Driver |
|---|---|---|
| Route A | Civil Lines | Ramesh Kumar |
| Route B | Model Town | Suresh Singh |
| Route C | Sector 6-12 | Vijay Sharma |
| Route D | Kunjpura | Dinesh Sharma |
| Route E | Taraori | Rajesh Yadav |
| Route F | Assandh | Harpal Singh |
| Route G | Nilokheri | Mohan Lal |

---

## Author

Built as a student learning project to demonstrate:
- JavaScript web development (frontend + backend)
- Algorithm implementation (Dijkstra's shortest path)
- Database integration (PostgreSQL)
- Real-world civic tech application

---

## License

MIT — free to use, modify, and learn from.
