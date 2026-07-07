/* ===== PRODUITS (défini dans products-data.js) ===== */

/* ===== ÉTAT GLOBAL ===== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCurrency = "MAD";
let rates = { EUR: 1, USD: 1.08, GBP: 0.86, MAD: 10.83 };

/* ===== RENDER PRODUITS ===== */
function renderProducts(filter = "all") {
    const grid = document.getElementById("products-grid");
    const filtered = filter === "all" ? products : products.filter(p => p.category === filter);
    grid.innerHTML = filtered.map(p => `
        <div class="product-card fade-in-up" data-category="${p.category}">
            <div class="product-badge ${p.category === 'luxe' ? 'badge-luxe' : ''}">${p.category === 'luxe' ? 'Luxe' : ''}</div>
            <div class="product-img-wrap" onclick="location.href='product.html?id=${p.id}'">
                <img src="${p.image}" alt="${p.name} - Maison Ghali" loading="lazy">
                <div class="quick-view">Aper&ccedil;u rapide</div>
            </div>
            <div class="info">
                <span class="category">${p.category}</span>
                <h3 onclick="location.href='product.html?id=${p.id}'">${p.name}</h3>
                <div class="product-rating">${renderStars(p.rating)}</div>
                <div class="price" data-base="${p.price}">${formatPrice(p.price)}</div>
                <div class="product-buyers"><i class="fa-solid fa-user-check"></i> ${p.buyers.slice(0, 3).join(", ")}${p.buyers.length > 3 ? " +" + (p.buyers.length - 3) : ""}</div>
                <div class="product-actions">
                    <button class="btn-add-cart" onclick="addToCart(${p.id})">Ajouter au Panier</button>
                    <button class="btn-buy-now" onclick="openCheckout(${p.id})">Commander</button>
                </div>
            </div>
        </div>
    `).join("");
    revealCards();
}

/* ===== RÉVÉLATION AU SCROLL ===== */
let srObserver = null;
function revealCards() {
    document.querySelectorAll('.fade-in-up:not(.visible)').forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('visible');
    });
    if (srObserver) srObserver.disconnect();
    srObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-up:not(.visible)').forEach(el => srObserver.observe(el));
}

/* ===== FORMAT PRIX ===== */
function formatPrice(amount) {
    const rate = rates[currentCurrency] || 1;
    const converted = amount * rate;
    if (currentCurrency === "EUR") return converted.toFixed(2) + " €";
    if (currentCurrency === "USD") return "$" + converted.toFixed(2);
    if (currentCurrency === "GBP") return "£" + converted.toFixed(2);
    if (currentCurrency === "MAD") return converted.toFixed(2) + " Dh";
    return converted.toFixed(2) + " €";
}

/* ===== ÉTOILES ===== */
function renderStars(rating) {
    return Array.from({ length: 5 }, (_, i) =>
        `<i class="fa-solid fa-star${i < rating ? '' : ' star-empty'}"></i>`
    ).join("");
}

/* ===== FILTRES ===== */
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", function() {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        renderProducts(this.dataset.filter);
    });
});

/* ===== PANIER ===== */
function addToCart(id, variant) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const variantKey = variant || "default";
    const existing = cart.find(item => item.id === id && (item.variant || "default") === variantKey);
    if (existing) {
        existing.qty += 1;
    } else {
        const img = product.colors && product.colors[variant] ? product.colors[variant] : product.image;
        cart.push({ ...product, qty: 1, variant: variant || null, image: img });
    }
    updateCart();
    if (typeof fbq === 'function') {
        fbq('track', 'AddToCart', { content_name: product.name, content_ids: [product.id], content_type: 'product', value: product.price, currency: 'MAD' });
    }
    showToast(`${product.name}${variant ? " (" + variant + ")" : ""} ajouté au panier`);
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    updateCart();
}

function changeQty(idx, delta) {
    const item = cart[idx];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(idx);
        return;
    }
    updateCart();
}

function updateCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById("cart-count").textContent = count;

    const container = document.getElementById("cart-items");
    const footer = document.getElementById("cart-footer");

    if (cart.length === 0) {
        container.innerHTML = `<p class="cart-empty">Votre panier est vide.</p>`;
        footer.style.display = "none";
        return;
    }

    footer.style.display = "block";
    container.innerHTML = cart.map((item, idx) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="item-info">
                <h4>${item.name}${item.variant ? ' <span class="item-variant">' + item.variant + '</span>' : ''}</h4>
                <div class="item-price">${formatPrice(item.price)}</div>
                <div class="item-qty">
                    <button onclick="changeQty(${idx}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button onclick="changeQty(${idx}, 1)">+</button>
                </div>
            </div>
            <div class="item-remove" onclick="removeFromCart(${idx})">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>
    `).join("");

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    document.getElementById("cart-total").textContent = formatPrice(total);
}

function toggleCart() {
    document.getElementById("cart-sidebar").classList.toggle("open");
    document.getElementById("cart-overlay").classList.toggle("open");
}

const API = "";

async function submitOrderToBackend(orderData) {
    const res = await fetch(API + "/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error("Serveur a répondu " + res.status + ": " + text);
    }
    return res.json();
}

let checkoutMode = "single";

function checkout() {
    if (cart.length === 0) return;
    checkoutMode = "cart";
    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', { value: total, currency: 'MAD', num_items: cart.reduce((s, i) => s + i.qty, 0) });
    }
    document.getElementById("checkout-product-summary").innerHTML = cart.map(item => `
        <div class="checkout-cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div>
                <h4>${item.name}${item.variant ? ' (' + item.variant + ')' : ''} x${item.qty}</h4>
                <div class="checkout-price">${formatPrice(item.price * item.qty)}</div>
            </div>
        </div>
    `).join("");
    document.getElementById("checkout-total-price").textContent = formatPrice(total);
    document.getElementById("checkout-form").reset();
    document.getElementById("checkout-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}

/* ===== DÉTECTION DE LA DEVISE ===== */
async function detectCurrency() {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const country = data.country_code;
        if (country === "US") currentCurrency = "USD";
        else if (country === "GB") currentCurrency = "GBP";
        else if (country === "MA") currentCurrency = "MAD";
        else currentCurrency = "EUR";
    } catch {
        currentCurrency = "MAD";
    }
    document.getElementById("current-currency").textContent = `Devise : ${currentCurrency}`;
    renderProducts(document.querySelector(".filter-btn.active")?.dataset?.filter || "all");
    updateCart();
}

/* ===== CHATBOT IA ===== */
const responses = {
    livraison: "Nos délais de livraison sont de 3 à 5 jours ouvrés en France et 5 à 10 jours pour l'international.",
    paiement: "Nous acceptons les cartes bancaires (Visa, Mastercard), PayPal et Apple Pay.",
    retour: "Vous avez 30 jours pour retourner un produit. Consultez notre politique de retour complète en cliquant sur le lien 'Retours' dans le menu.",
    horaire: "Notre service client est disponible du lundi au vendredi de 9h à 18h.",
    prix: "Les prix affichés incluent la TVA. La devise est automatiquement détectée selon votre localisation.",
    produit: "Nous proposons des montres, bracelets et accessoires de luxe. Consultez notre boutique !",
    commande: "Vous pouvez suivre votre commande via le lien reçu par email après achat.",
    contact: "Vous pouvez nous joindre par email à contact@maison-ghali.ma ou par téléphone au +212 6 45 42 04 57.",
    defaut: "Je suis désolé, je n'ai pas compris votre question. Vous pouvez me demander : livraison, paiement, retour, horaires, prix, produits, commande ou contact."
};

function sendMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    const body = document.getElementById("chat-body");
    body.innerHTML += `<div class="message user">${escapeHtml(text)}</div>`;

    const lower = text.toLowerCase();
    let reply = responses.defaut;
    for (const key of Object.keys(responses)) {
        if (key !== "defaut" && lower.includes(key)) {
            reply = responses[key];
            break;
        }
    }

    setTimeout(() => {
        body.innerHTML += `<div class="message bot">${reply}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 500 + Math.random() * 500);

    input.value = "";
    body.scrollTop = body.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function toggleChat() {
    const body = document.getElementById("chat-body");
    const footer = document.getElementById("chat-footer");
    const isOpen = body.style.display === "flex";
    body.style.display = isOpen ? "none" : "flex";
    footer.style.display = isOpen ? "none" : "flex";
}

/* ===== MODALE POLITIQUE DE RETOUR ===== */
function openRefundModal() {
    document.getElementById("refund-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}
function closeRefundModal(event) {
    if (event && event.target !== document.getElementById("refund-modal")) return;
    document.getElementById("refund-modal").classList.remove("open");
    document.body.style.overflow = "";
}

/* ===== MODALE À PROPOS ===== */
function openAboutModal() {
    document.getElementById("about-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}
function closeAboutModal(event) {
    if (event && event.target !== document.getElementById("about-modal")) return;
    document.getElementById("about-modal").classList.remove("open");
    document.body.style.overflow = "";
}

/* ===== PAGE DÉTAIL PRODUIT ===== */
let pdetailQty = 1;
let pdetailColor = null;
let pdetailId = null;

function openProductDetail(id) {
    if (typeof fbq === 'function') {
        const p = products.find(x => x.id === id);
        if (p) fbq('track', 'ViewContent', { content_name: p.name, content_ids: [p.id], content_type: 'product', value: p.price, currency: 'MAD' });
    }
    const p = products.find(x => x.id === id);
    if (!p) return;
    pdetailId = id;
    pdetailQty = 1;
    pdetailColor = p.colors ? Object.keys(p.colors)[0] : null;
    const galleryImages = p.gallery || [p.image];
    const thumbsHtml = galleryImages.length > 1 ? '<div class="pdetail-thumbs">' +
        galleryImages.map(function(img, i) {
            return '<img src="' + img + '" class="pdetail-thumb' + (i === 0 ? ' active' : '') + '" onclick="switchProductImage(' + p.id + ', ' + i + ');openLightbox(' + JSON.stringify(galleryImages) + ', ' + i + ')" alt="">';
        }).join("") +
    '</div>' : '';

    document.getElementById("product-detail-content").innerHTML =
        '<div class="pdetail-image">' +
            '<img id="pdetail-main-img" src="' + galleryImages[0] + '" alt="' + p.name + '" onclick="openLightbox(' + JSON.stringify(galleryImages) + ', 0)" style="cursor:pointer">' +
            thumbsHtml +
        '</div>' +
        '<div class="pdetail-info">' +
            '<span class="pdetail-category">' + p.category + '</span>' +
            '<h2 class="pdetail-title">' + p.name + '</h2>' +
            '<div class="product-rating">' + renderStars(p.rating) + '</div>' +
            '<div class="pdetail-price">' + formatPrice(p.price) + '</div>' +
            '<p class="pdetail-tax">TVA et livraison incluses</p>' +
            '<p class="pdetail-desc">' + p.desc + '</p>' +
            '<div class="pdetail-options">' +
                (p.colors ? '<div class="pdetail-option">' +
                    '<label>Couleur</label>' +
                    '<div class="color-swatches">' +
                        Object.keys(p.colors).map(function(c) {
                            return '<button class="color-swatch' + (c === pdetailColor ? ' active' : '') + '" data-color="' + c + '" onclick="selectColor(\'' + c + '\')">' + c + '</button>';
                        }).join("") +
                    '</div>' +
                '</div>' : '') +
                '<div class="pdetail-option">' +
                    '<label>Quantit&eacute;</label>' +
                    '<div class="pdetail-qty">' +
                        '<button onclick="pdetailQty=Math.max(1,pdetailQty-1);document.getElementById(\'pdetail-qty-num\').textContent=pdetailQty">-</button>' +
                        '<span id="pdetail-qty-num">1</span>' +
                        '<button onclick="pdetailQty++;document.getElementById(\'pdetail-qty-num\').textContent=pdetailQty">+</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<button class="btn-add-cart pdetail-add-btn" onclick="for(let i=0;i<pdetailQty;i++)addToCart(' + p.id + ', pdetailColor);closeProductDetail();">' +
                '<i class="fa-solid fa-cart-shopping"></i> Ajouter au panier' +
            '</button>' +
            '<button class="btn-whatsapp-order" onclick="orderViaWhatsApp(' + p.id + ', pdetailQty, pdetailColor);">' +
                '<i class="fa-brands fa-whatsapp"></i> Commander via WhatsApp' +
            '</button>' +
            '<div class="pdetail-stock">' +
                '<span class="stock-high"><i class="fa-solid fa-circle"></i> En stock</span>' +
                '<span class="stock-sold"><i class="fa-solid fa-fire"></i> 18 vendus ce mois</span>' +
            '</div>' +
            '<div class="pdetail-trust">' +
                '<span><i class="fa-solid fa-truck"></i> Livraison 24h</span>' +
                '<span><i class="fa-solid fa-rotate-left"></i> Retour 30 jours</span>' +
                '<span><i class="fa-solid fa-shield"></i> Paiement sécurisé</span>' +
            '</div>' +
            '<div class="pdetail-buyers">' +
                '<strong><i class="fa-solid fa-user-check"></i> Achet&eacute; par :</strong> ' +
                p.buyers.map(function(b) { return '<span>' + b + '</span>'; }).join(", ") +
            '</div>' +
            '<div class="pdetail-features">' +
                '<h3>Caract&eacute;ristiques</h3>' +
                '<ul>' +
                    '<li><strong>Cat&eacute;gorie :</strong> ' + p.category + '</li>' +
                    '<li><strong>Note :</strong> ' + p.rating + '/5</li>' +
                    '<li><strong>Prix :</strong> ' + formatPrice(p.price) + '</li>' +
                    '<li><strong>Livraison :</strong> 3 &agrave; 5 jours ouvr&eacute;s</li>' +
                    '<li><strong>Garantie :</strong> 2 ans</li>' +
                '</ul>' +
            '</div>' +
            '<div class="pdetail-contact">' +
                '<p><i class="fa-solid fa-envelope"></i> contact@maison-ghali.ma</p>' +
                '<p><i class="fa-solid fa-phone"></i> +212 6 45 42 04 57</p>' +
                '<p><i class="fa-solid fa-truck"></i> Livraison partout dans le monde</p>' +
            '</div>' +
        '</div>';
    document.getElementById("product-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}

function selectColor(color) {
    pdetailColor = color;
    const p = products.find(x => x.id === pdetailId);
    if (p && p.colors && p.colors[color]) {
        document.querySelector("#product-detail-content .pdetail-image img").src = p.colors[color];
    }
    document.querySelectorAll(".color-swatch").forEach(function(el) {
        el.classList.toggle("active", el.dataset.color === color);
    });
}

function switchProductImage(id, index) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const gallery = p.gallery || [p.image];
    if (!gallery[index]) return;
    document.getElementById("pdetail-main-img").src = gallery[index];
    document.querySelectorAll(".pdetail-thumb").forEach(function(el, i) {
        el.classList.toggle("active", i === index);
    });
}

function closeProductDetail(event) {
    if (event && event.target !== document.getElementById("product-modal")) return;
    document.getElementById("product-modal").classList.remove("open");
    document.body.style.overflow = "";
}

/* ===== CHECKOUT (COMMANDE) ===== */
let checkoutProductId = null;
let checkoutQty = 1;
let checkoutColor = null;

function openCheckout(id, qty, color) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    checkoutMode = "single";
    checkoutProductId = id;
    checkoutQty = qty || 1;
    checkoutColor = color || null;
    const img = color && product.colors && product.colors[color] ? product.colors[color] : product.image;
    const total = product.price * checkoutQty;
    if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', { value: total, currency: 'MAD', content_name: product.name, content_ids: [product.id], content_type: 'product' });
    }
    document.getElementById("checkout-product-summary").innerHTML = `
        <img src="${img}" alt="${product.name}">
        <div>
            <h4>${product.name}${checkoutQty > 1 ? ' x' + checkoutQty : ''}${checkoutColor ? ' (' + checkoutColor + ')' : ''}</h4>
            <div class="checkout-price">${formatPrice(total)}</div>
        </div>
    `;
    document.getElementById("checkout-total-price").textContent = formatPrice(total);
    document.getElementById("checkout-form").reset();
    document.getElementById("checkout-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeCheckout(event) {
    if (event && event.target !== document.getElementById("checkout-modal")) return;
    document.getElementById("checkout-modal").classList.remove("open");
    document.body.style.overflow = "";
    checkoutProductId = null;
}

async function submitOrder(event) {
    event.preventDefault();

    const prenom = document.getElementById("field-prenom").value.trim();
    const nom = document.getElementById("field-nom").value.trim();
    const telephone = document.getElementById("field-telephone").value.trim();
    const adresse = document.getElementById("field-adresse").value.trim();
    const ville = document.getElementById("field-ville").value.trim();

    if (!prenom || !nom || !telephone || !adresse || !ville) return;

    const confirmBtn = document.querySelector(".btn-confirm-order");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Envoi en cours...";

    try {
        if (checkoutMode === "cart") {
            const items = cart.map(item => ({
                prenom, nom, telephone, adresse, ville,
                product_id: item.id,
                product_name: item.name + (item.variant ? " (" + item.variant + ")" : ""),
                product_price: item.price,
                quantite: item.qty
            }));
            await Promise.all(items.map(item => submitOrderToBackend(item)));
            if (typeof fbq === 'function') {
                fbq('track', 'Purchase', { value: cart.reduce((s, i) => s + i.price * i.qty, 0), currency: 'MAD' });
            }
            cart = [];
            updateCart();
            toggleCart();
            closeCheckout();
            showToast(`Commande confirmée ! Merci ${prenom}.`);
        } else {
            const product = products.find(p => p.id === checkoutProductId);
            if (!product) return;
            const nameSuffix = checkoutColor ? " (" + checkoutColor + ")" : "";
            await submitOrderToBackend({
                prenom, nom, telephone, adresse, ville,
                product_id: product.id,
                product_name: product.name + nameSuffix,
                product_price: product.price,
                quantite: checkoutQty
            });
            if (typeof fbq === 'function') {
                fbq('track', 'Purchase', { value: product.price * checkoutQty, currency: 'MAD' });
            }
            closeCheckout();
            showToast(`Commande confirmée ! Merci ${prenom}.`);
        }
    } catch (e) {
        console.error("Échec commande:", e);
        showToast("Erreur : impossible de soumettre la commande. Veuillez nous contacter via WhatsApp.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirmer la Commande";
    }
}

/* ===== COMMANDE VIA WHATSAPP ===== */
function orderViaWhatsApp(id, qty, color) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const q = qty || 1;
    const c = color || "";
    const name = p.name + (c ? " (" + c + ")" : "");
    const total = (p.price * q * 10.83).toFixed(2);
    const msg = "Bonjour Maison Ghali ! Je souhaite commander :%0A" +
        "- Produit : " + name + "%0A" +
        "- Quantité : " + q + "%0A" +
        "- Prix : " + total + " DHS%0A" +
        "Merci de me contacter pour la livraison.";
    window.open("https://wa.me/212645420457?text=" + msg, "_blank");
}

/* ===== LIGHTBOX ===== */
let lightboxImages = [];
let lightboxIndex = 0;

function openLightbox(images, index) {
    if (!images || images.length === 0) return;
    lightboxImages = images;
    lightboxIndex = index ?? 0;
    document.getElementById("lightbox-img").src = lightboxImages[lightboxIndex];
    document.getElementById("lightbox").classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeLightbox(event) {
    if (event && event.target !== document.getElementById("lightbox")) return;
    document.getElementById("lightbox").classList.remove("open");
    document.body.style.overflow = "";
}

function lightboxNav(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    document.getElementById("lightbox-img").src = lightboxImages[lightboxIndex];
}

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft" && document.getElementById("lightbox").classList.contains("open")) lightboxNav(-1);
    if (e.key === "ArrowRight" && document.getElementById("lightbox").classList.contains("open")) lightboxNav(1);
});

/* ===== TOAST NOTIFICATION ===== */
function showToast(msg) {
    let toast = document.querySelector(".toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove("show"), 2500);
}

/* ===== INIT ===== */
renderProducts("all");
detectCurrency();
