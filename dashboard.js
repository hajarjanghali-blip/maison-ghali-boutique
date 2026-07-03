/* ===== PROTECTION ===== */
if (localStorage.getItem("dashAuth") !== "true") {
    window.location.href = "admin.html";
}

/* ===== API ===== */
const API = "";
let lastOrderId = 0;

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch {
        return null;
    }
}

/* ===== DONNÉES ===== */
let dailyData = [];
let productsSold = {};

function fillMissingDates(data, days = 30) {
    const map = {};
    data.forEach(d => { map[d.day || d.date] = d; });
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const entry = map[dayStr];
        result.push({
            date: label,
            revenue: entry ? parseFloat(entry.revenue || 0) : 0,
            orders: entry ? (entry.orders || 0) : 0,
            traffic: 0
        });
    }
    return result;
}

let loadingData = false;
async function loadData() {
    if (loadingData) return;
    loadingData = true;
    try {
    const [stats, revenueDaily, trafficDaily, periods, sources, topProducts, latestOrders] = await Promise.all([
        fetchJSON(API + "/api/stats"),
        fetchJSON(API + "/api/revenue/daily"),
        fetchJSON(API + "/api/traffic/daily"),
        fetchJSON(API + "/api/stats/periods"),
        fetchJSON(API + "/api/traffic/sources"),
        fetchJSON(API + "/api/products/top"),
        fetchJSON(API + "/api/orders/latest")
    ]);

    // Stats cards
    if (stats) {
        document.getElementById("stat-revenue").textContent = parseFloat(stats.revenue).toFixed(2) + " €";
        document.getElementById("stat-orders").textContent = stats.orders;
        document.getElementById("stat-products").textContent = stats.products;
        document.getElementById("stat-visitors").textContent = stats.visitors;
    }

    // Revenue daily
    dailyData = fillMissingDates(revenueDaily || []);

    // Traffic
    if (trafficDaily) {
        const visitsMap = {};
        (trafficDaily.visits || []).forEach(v => { visitsMap[v.date] = (visitsMap[v.date] || 0) + v.visits; });
        dailyData.forEach(d => {
            const dayKey = d.date;
            const found = Object.keys(visitsMap).find(k => {
                const dateObj = new Date(k);
                return dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) === dayKey;
            });
            if (found) d.traffic = visitsMap[found];
        });
    }

    // Sales table
    const salesTbody = document.getElementById("table-sales");
    if (periods) {
        const rows = [
            { label: "Cette semaine", data: periods.week },
            { label: "Ce mois", data: periods.month },
            { label: "Les 3 mois", data: periods.quarter }
        ];
        const total = periods.total;
        salesTbody.innerHTML = rows.map((r, i) => {
            const rev = parseFloat(r.data.total);
            const ord = r.data.count;
            const avg = ord ? rev / ord : 0;
            const prev = i > 0 ? rows[i - 1].data : { total: 0 };
            const prevRev = parseFloat(prev.total);
            const evol = prevRev ? ((rev - prevRev) / prevRev * 100).toFixed(1) : "0";
            const evolClass = +evol >= 0 ? "up" : "down";
            return `<tr><td>${r.label}</td><td>${rev.toFixed(2)} €</td><td>${ord}</td><td>${avg.toFixed(2)} €</td><td class="${evolClass}">${+evol >= 0 ? "+" : ""}${evol}%</td></tr>`;
        }).join("");
    }

    // Traffic sources
    const trafficTbody = document.getElementById("table-traffic");
    if (sources) {
        trafficTbody.innerHTML = sources.map(s =>
            `<tr><td>${s.name}</td><td>${s.visitors}</td><td>${s.pps}</td><td>${s.conv}%</td><td>${(s.visitors * 0.35).toFixed(2)} €</td></tr>`
        ).join("");
    }

    // Products table
    const productsTbody = document.getElementById("table-products");
    const topMap = {};
    if (topProducts) {
        topProducts.forEach(p => { topMap[p.product_id] = p; });
    }
    productsTbody.innerHTML = products.map(p => {
        const sold = topMap[p.id];
        const qty = sold ? sold.total_qty : 0;
        const rev = sold ? sold.total_revenue : 0;
        return `<tr>
            <td><div class="dash-product-cell"><img src="${p.image}" alt="">${p.name}</div></td>
            <td><span class="dash-cat-tag">${p.category}</span></td>
            <td>${p.price.toFixed(2)} €</td>
            <td>${"★".repeat(p.rating)}${"☆".repeat(5 - p.rating)}</td>
            <td>${qty}</td>
            <td>${parseFloat(rev).toFixed(2)} €</td>
        </tr>`;
    }).join("");

    // Orders table
    const ordersTbody = document.getElementById("table-orders");
    if (latestOrders && latestOrders.length > 0) {
        const maxId = Math.max(...latestOrders.map(o => o.id));
        const newOrdersArrived = lastOrderId > 0 && maxId > lastOrderId;
        if (newOrdersArrived) {
            playNotifSound();
        }
        const prevMax = lastOrderId;
        lastOrderId = maxId;
        ordersTbody.innerHTML = latestOrders.map(o =>
            `<tr${newOrdersArrived && o.id > prevMax ? ' class="dash-row-new"' : ''}>
                <td><strong>#${o.id}</strong></td>
                <td>${o.prenom} ${o.nom}</td>
                <td>${o.product_name}</td>
                <td>${parseFloat(o.total).toFixed(2)} €</td>
                <td>${new Date(o.date + 'Z').toLocaleDateString("fr-FR")}</td>
                <td><span class="dash-status status-delivered">Confirmée</span></td>
            </tr>`
        ).join("");
        if (newOrdersArrived) {
            setTimeout(() => document.querySelectorAll('.dash-row-new').forEach(r => r.classList.remove('dash-row-new')), 4000);
        }
    }

    // Init charts
    try { initCharts(); } catch (e) { console.warn("Chart error:", e); }
    } finally { loadingData = false; }
}

function calculateStats() {
    // Remplacé par loadData()
}

/* ===== CHARTES ===== */
const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: { font: { family: "'Segoe UI', sans-serif" } }
        }
    }
};

function createLineChart(id, labels, data, label, color) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                backgroundColor: color + "20",
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: color,
                borderWidth: 2
            }]
        },
        options: {
            ...chartDefaults,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: false, grid: { color: "#f0f0f0" } }
            }
        }
    });
}

function createBarChart(id, labels, data, label, color) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label,
                data,
                backgroundColor: color,
                borderRadius: 4
            }]
        },
        options: {
            ...chartDefaults,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: "#f0f0f0" } }
            }
        }
    });
}

function createDoughnutChart(id, labels, data, colors) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            ...chartDefaults,
            cutout: "70%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 15, usePointStyle: true }
                }
            }
        }
    });
}

/* ===== INITIALISER LES GRAPHIQUES ===== */
function initCharts() {
    const labels = dailyData.map(d => d.date);
    const revenues = dailyData.map(d => d.revenue);
    const traffics = dailyData.map(d => d.traffic);
    const orders = dailyData.map(d => d.orders);

    createLineChart("chart-sales-overview", labels, revenues, "Revenus (€)", "#c5a880");
    createLineChart("chart-traffic-overview", labels, traffics, "Visiteurs", "#3498db");
    createLineChart("chart-sales-detailed", labels, revenues, "Revenus (€)", "#c5a880");
    createLineChart("chart-traffic-detailed", labels, traffics, "Visiteurs", "#3498db");

    const catMap = {};
    products.forEach(p => {
        catMap[p.category] = (catMap[p.category] || 0) + 1;
    });
    const catLabels = Object.keys(catMap).map(c => c.charAt(0).toUpperCase() + c.slice(1));
    const catData = Object.values(catMap);
    const catColors = ["#c5a880", "#3498db", "#e74c3c", "#f39c12", "#9b59b6"];
    createDoughnutChart("chart-categories", catLabels, catData, catColors);

    products.sort((a, b) => b.buyers.length - a.buyers.length);
    const top5 = products.slice(0, 5);
    createBarChart("chart-top-products", top5.map(p => p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name), top5.map(p => p.buyers.length), "Acheteurs", "#f39c12");
}

/* ===== TABLEAUX ===== */
// Remplacé par loadData()

/* ===== NAVIGATION LATÉRALE ===== */
document.querySelectorAll(".dash-nav-item").forEach(item => {
    item.addEventListener("click", function(e) {
        e.preventDefault();
        document.querySelectorAll(".dash-nav-item").forEach(a => a.classList.remove("active"));
        this.classList.add("active");
        const section = this.dataset.section;
        document.querySelectorAll(".dash-section").forEach(s => s.classList.remove("active"));
        document.getElementById("section-" + section).classList.add("active");
    });
});

/* ===== DÉCONNEXION ===== */
function logout() {
    localStorage.removeItem("dashAuth");
    window.location.href = "admin.html";
}

/* ===== TOGGLE SIDEBAR ===== */
function toggleSidebar() {
    document.getElementById("dash-sidebar").classList.toggle("collapsed");
}

/* ===== DATE ===== */
document.getElementById("dash-date").textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
});

/* ===== EXPORT JSON ===== */
async function exportOrders() {
    try {
        const data = await fetchJSON(API + "/api/orders/export");
        if (!data) { alert("Aucune commande à exporter"); return; }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "commandes-maison-ghali-" + new Date().toISOString().slice(0, 10) + ".json";
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Erreur d'export : " + e.message);
    }
}

/* ===== NOTIFICATION SONORE ===== */
function playNotifSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        setTimeout(() => ctx.close(), 500);
    } catch (e) { /* audio pas disponible */ }
}

/* ===== AUTO-REFRESH ===== */
setInterval(loadData, 15000);

/* ===== DASHBOARD TITLE ===== */
document.title = "Maison Ghali - Tableau de Bord";

/* ===== INIT ===== */
loadData();
