const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    if (req.path.endsWith('.db') || req.path.endsWith('.db-shm') || req.path.endsWith('.db-wal')) {
        return res.status(403).send('Interdit');
    }
    next();
});
app.use(express.static(__dirname));

/* ===== BDD ===== */
const db = new Database(path.join(__dirname, "maison-ghali.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL,
    adresse TEXT NOT NULL,
    ville TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    total REAL NOT NULL,
    date TEXT NOT NULL DEFAULT (datetime('now','+1 hour'))
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT (date('now')) UNIQUE,
    count INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT (date('now')) UNIQUE,
    count INTEGER NOT NULL DEFAULT 1
  );
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (prenom, nom, telephone, adresse, ville, product_id, product_name, product_price, quantite, total)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertVisit = db.prepare(`
  INSERT INTO visits (date, count) VALUES (date('now'), 1)
  ON CONFLICT(date) DO UPDATE SET count = count + 1
`);

const upsertPageView = db.prepare(`
  INSERT INTO page_views (date, count) VALUES (date('now'), 1)
  ON CONFLICT(date) DO UPDATE SET count = count + 1
`);

/* ===== ROUTES ===== */

// Commande
app.post("/api/order", (req, res) => {
  const { prenom, nom, telephone, adresse, ville, product_id, product_name, product_price, quantite } = req.body;
  if (!prenom || !nom || !telephone || !adresse || !ville || !product_id) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }
  const total = (product_price || 0) * (quantite || 1);
  insertOrder.run(prenom, nom, telephone, adresse, ville, product_id, product_name, product_price, quantite || 1, total);
  res.json({ success: true });
});

// Tracker visite
app.post("/api/visit", (req, res) => {
  upsertVisit.run();
  res.json({ success: true });
});

// Tracker page view
app.post("/api/pageview", (req, res) => {
  upsertPageView.run();
  res.json({ success: true });
});

// Stats dashboard
app.get("/api/stats", (req, res) => {
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM orders").get();
  const totalOrders = db.prepare("SELECT COUNT(*) as count FROM orders").get();
  const totalProducts = db.prepare("SELECT COUNT(DISTINCT product_id) as count FROM orders").get();
  const todayVisits = db.prepare("SELECT COALESCE(SUM(count),0) as total FROM visits").get();
    const productsCount = 2;

  res.json({
    revenue: totalRevenue.total,
    orders: totalOrders.count,
    products: productsCount,
    visitors: todayVisits.total
  });
});

// Stats par période
app.get("/api/stats/periods", (req, res) => {
  const total = db.prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders").get();
  const week = db.prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE date >= datetime('now', '-7 days', '+1 hour')").get();
  const month = db.prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE date >= datetime('now', '-30 days', '+1 hour')").get();
  const quarter = db.prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE date >= datetime('now', '-90 days', '+1 hour')").get();

  res.json({ total, week, month, quarter });
});

// Revenus quotidiens (30 jours)
app.get("/api/revenue/daily", (req, res) => {
  const rows = db.prepare(`
    SELECT date(date) as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders
    FROM orders
    WHERE date >= date('now', '-30 days')
    GROUP BY date(date)
    ORDER BY day ASC
  `).all();
  res.json(rows);
});

// Trafic quotidien (30 jours)
app.get("/api/traffic/daily", (req, res) => {
  const visits = db.prepare(`
    SELECT date, count as visits
    FROM visits
    WHERE date >= date('now', '-30 days')
    ORDER BY date ASC
  `).all();
  const views = db.prepare(`
    SELECT date, count as views
    FROM page_views
    WHERE date >= date('now', '-30 days')
    ORDER BY date ASC
  `).all();
  res.json({ visits, views });
});

// Ventes par catégorie
app.get("/api/categories", (req, res) => {
  const rows = db.prepare(`
    SELECT product_name, SUM(quantite) as count
    FROM orders
    GROUP BY product_name
    ORDER BY count DESC
  `).all();
  res.json(rows);
});

// Top produits
app.get("/api/products/top", (req, res) => {
  const rows = db.prepare(`
    SELECT product_id, product_name, SUM(quantite) as total_qty, SUM(total) as total_revenue, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
    ORDER BY total_qty DESC
    LIMIT 5
  `).all();
  res.json(rows);
});

// Dernières commandes
app.get("/api/orders/latest", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM orders ORDER BY date DESC LIMIT 15
  `).all();
  res.json(rows);
});

// Sources de trafic (mock enrichi depuis les vrais visites)
app.get("/api/traffic/sources", (req, res) => {
  const totalVisits = db.prepare("SELECT COALESCE(SUM(count),0) as total FROM visits").get().total || 1;
  res.json([
    { name: "Recherche organique", visitors: Math.round(totalVisits * 0.42), pps: 4.2, conv: 3.8 },
    { name: "Réseaux sociaux", visitors: Math.round(totalVisits * 0.28), pps: 3.1, conv: 2.1 },
    { name: "Direct", visitors: Math.round(totalVisits * 0.16), pps: 2.8, conv: 1.5 },
    { name: "Email", visitors: Math.round(totalVisits * 0.09), pps: 3.5, conv: 4.2 },
    { name: "Publicité", visitors: Math.round(totalVisits * 0.05), pps: 2.3, conv: 1.8 }
  ]);
});

app.listen(PORT, () => {
  console.log(`Serveur Maison Ghali démarré sur http://localhost:${PORT}`);
});
