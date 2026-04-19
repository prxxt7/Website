import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { FILTERS, STARTER_PRODUCTS, formatINR, getSessionId, makeWhatsAppLink } from "./shared.js";

const refs = {
  authBtn: document.getElementById("authBtn"),
  userChip: document.getElementById("userChip"),
  statusBanner: document.getElementById("statusBanner"),
  searchInput: document.getElementById("searchInput"),
  filterGroup: document.getElementById("filterGroup"),
  productGrid: document.getElementById("productGrid"),
  modalWrap: document.getElementById("modalWrap"),
  closeModal: document.getElementById("closeModal"),
  closeOk: document.getElementById("closeOk"),
  modalFormBlock: document.getElementById("modalFormBlock"),
  okBlock: document.getElementById("okBlock"),
  modalCategory: document.getElementById("modalCategory"),
  modalName: document.getElementById("modalName"),
  modalPrice: document.getElementById("modalPrice"),
  orderForm: document.getElementById("orderForm"),
  sendOrderWa: document.getElementById("sendOrderWa"),
  contactForm: document.getElementById("contactForm"),
  orderEmail: document.getElementById("oEmail"),
  toast: document.getElementById("toast")
};

const state = {
  filter: "all",
  search: "",
  selectedProduct: null,
  products: [...STARTER_PRODUCTS],
  loggedPageView: false,
  apiReachable: true,
  customer: null,
  idToken: "",
  authReady: false
};

const whatsappNumber = window.SPYGLASS_WHATSAPP_NUMBER || "919999999999";
const apiBase = String(window.SPYGLASS_API_BASE || "http://127.0.0.1:8080").replace(/\/+$/, "");
const firebaseConfig = window.SPYGLASS_FIREBASE_CONFIG || null;
const hasFirebaseConfig = Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain && firebaseConfig?.projectId);
const fallbackProductImage = "./assets/mirror-fallback.svg";

let auth = null;
let googleProvider = null;
let resolveAuthReady = null;
const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

function markAuthReady() {
  if (!state.authReady) {
    state.authReady = true;
    if (typeof resolveAuthReady === "function") {
      resolveAuthReady();
    }
  }
}

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeImageUrl(input) {
  const value = String(input || "").trim();
  if (!value) {
    return fallbackProductImage;
  }

  if (value.startsWith("http://")) {
    return `https://${value.slice(7)}`;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (
    value.startsWith("https://") ||
    value.startsWith("./") ||
    value.startsWith("/") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return fallbackProductImage;
}

function showBanner(message) {
  refs.statusBanner.hidden = false;
  refs.statusBanner.textContent = message;
}

function hideBanner() {
  refs.statusBanner.hidden = true;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove("show"), 2500);
}

function syncAuthUi() {
  if (state.customer) {
    refs.userChip.textContent = state.customer.email || state.customer.phone || "Signed In";
    refs.authBtn.textContent = "Logout";
    refs.authBtn.disabled = false;
    refs.orderEmail.value = state.customer.email || "";
    return;
  }

  refs.userChip.textContent = hasFirebaseConfig ? "Guest" : "Auth Not Configured";
  refs.authBtn.textContent = hasFirebaseConfig ? "Login with Google" : "Login Unavailable";
  refs.authBtn.disabled = !hasFirebaseConfig;
  refs.orderEmail.value = "";
}

async function getCustomerToken(forceRefresh = false) {
  if (!auth?.currentUser) {
    state.idToken = "";
    return "";
  }

  try {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    state.idToken = token;
    return token;
  } catch (_error) {
    return state.idToken || "";
  }
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (options.withAuth || options.requireAuth) {
    const token = await getCustomerToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.requireAuth && !token) {
      throw new Error("Please login with Google before placing an order.");
    }
  }

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (_error) {
    throw new Error("Cannot reach API. Start backend with npm start and open website via http://127.0.0.1:5500");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function openModal(productId) {
  if (!state.customer) {
    showToast("Please login with Google first.");
    return;
  }

  const selected = state.products.find((item) => String(item.id) === String(productId));
  if (!selected) {
    return;
  }

  state.selectedProduct = selected;
  refs.modalCategory.textContent = String(selected.category || "Mirror").toUpperCase();
  refs.modalName.textContent = selected.name;
  refs.modalPrice.textContent = formatINR(selected.price);
  refs.orderForm.reset();
  document.getElementById("oQty").value = "1";
  refs.orderEmail.value = state.customer.email || "";
  refs.modalFormBlock.style.display = "block";
  refs.okBlock.style.display = "none";
  refs.modalWrap.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  refs.modalWrap.classList.remove("open");
  document.body.style.overflow = "";
}

function reveal() {
  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      el.classList.add("show");
    }
  });
}

function mapFilterKey(type) {
  if (!type) {
    return "other";
  }
  const normalized = String(type).toLowerCase();
  if (FILTERS.some((item) => item.key === normalized)) {
    return normalized;
  }
  if (normalized.includes("designer")) return "designer";
  if (normalized.includes("led")) return "led";
  if (normalized.includes("dress")) return "dressing";
  if (normalized.includes("decor") || normalized.includes("wall")) return "decor";
  if (normalized.includes("light")) return "lighting";
  return normalized;
}

function normalizeProducts(rows) {
  return rows.map((item, idx) => ({
    id: item.id || `local-${idx}`,
    name: item.name || "Mirror Product",
    category: item.category || "Mirror",
    type: mapFilterKey(item.type || item.category || "decor"),
    price: Number(item.price || 0),
    badge: item.badge || "",
    description: item.description || "",
    image: normalizeImageUrl(item.image),
    isActive: item.isActive !== false
  }));
}

function filteredProducts() {
  const q = state.search.trim().toLowerCase();
  return state.products.filter((product) => {
    const byFilter = state.filter === "all" || product.type === state.filter;
    const bySearch = !q || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(q);
    return byFilter && bySearch && product.isActive;
  });
}

function renderFilters() {
  refs.filterGroup.innerHTML = FILTERS.map((item) => {
    const activeClass = item.key === state.filter ? "active" : "";
    return `<button class="chip ${activeClass}" data-filter="${item.key}" type="button">${item.label}</button>`;
  }).join("");
}

function renderProducts() {
  const list = filteredProducts();
  if (!list.length) {
    refs.productGrid.innerHTML = `<div class="empty">No matching products found.</div>`;
    return;
  }

  refs.productGrid.innerHTML = list
    .map((p) => {
      const safeName = escapeHtml(p.name);
      const safeCategory = escapeHtml(p.category);
      const safeDesc = escapeHtml(p.description);
      const safeBadge = escapeHtml(p.badge);
      const safeImage = escapeHtml(normalizeImageUrl(p.image));

      return `
    <article class="card reveal">
      <figure class="thumb">
        <img
          src="${safeImage}"
          alt="${safeName}"
          loading="eager"
          decoding="async"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='${fallbackProductImage}';"
        >
        ${safeBadge ? `<span class="badge">${safeBadge}</span>` : ""}
      </figure>
      <div class="card-body">
        <p class="cat">${safeCategory}</p>
        <h3 class="name">${safeName}</h3>
        <p class="desc">${safeDesc}</p>
        <div class="card-foot">
          <div class="price">${formatINR(p.price)}<small>Inclusive of taxes</small></div>
          <button class="order-btn" type="button" data-order-id="${p.id}">Order Now</button>
        </div>
      </div>
    </article>
  `;
    })
    .join("");
  reveal();
}

async function fetchGeoInfo() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2200);
    const response = await fetch("https://ipapi.co/json/", { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return { country: "", countryCode: "", city: "", ip: "" };
    }
    const data = await response.json();
    return {
      country: data.country_name || "",
      countryCode: data.country_code || "",
      city: data.city || "",
      ip: data.ip || ""
    };
  } catch (_error) {
    return { country: "", countryCode: "", city: "", ip: "" };
  }
}

async function logVisit(eventType) {
  const geo = await fetchGeoInfo();
  try {
    await apiRequest("/api/visits", {
      method: "POST",
      withAuth: true,
      body: {
        eventType,
        sessionId: getSessionId(),
        path: `${location.pathname}${location.search}`,
        referrer: document.referrer || "",
        language: navigator.language || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent || "",
        country: geo.country,
        countryCode: geo.countryCode,
        city: geo.city,
        ip: geo.ip
      }
    });
  } catch (_error) {
    // Non-blocking analytics.
  }
}

async function loadProducts() {
  try {
    const data = await apiRequest("/api/products");
    if (!data.products?.length) {
      state.apiReachable = true;
      state.products = normalizeProducts(STARTER_PRODUCTS);
      hideBanner();
      renderProducts();
      return;
    }
    state.apiReachable = true;
    state.products = normalizeProducts(data.products);
    hideBanner();
    renderProducts();
  } catch (_error) {
    state.apiReachable = false;
    state.products = normalizeProducts(STARTER_PRODUCTS);
    hideBanner();
    renderProducts();
  }
}

function authErrorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("popup-closed-by-user")) return "Login popup closed before completion.";
  if (code.includes("popup-blocked")) return "Popup blocked. Please allow popups and try again.";
  if (code.includes("unauthorized-domain")) return "This website domain is not authorized in Firebase Auth settings.";
  return "Google login failed. Please try again.";
}

async function loginWithGoogle() {
  if (!auth || !googleProvider) {
    showToast("Google login is not configured.");
    return;
  }

  try {
    await signInWithPopup(auth, googleProvider);
    showToast("Login successful.");
  } catch (error) {
    showToast(authErrorMessage(error));
  }
}

async function logoutCustomer() {
  if (!auth) {
    return;
  }
  try {
    await signOut(auth);
    showToast("Logged out.");
  } catch (_error) {
    showToast("Logout failed. Please try again.");
  }
}

async function submitOrder(event) {
  event.preventDefault();
  const product = state.selectedProduct;
  if (!product) {
    showToast("No product selected.");
    return;
  }

  if (!state.customer) {
    showToast("Please login with Google before ordering.");
    return;
  }

  const customerEmail = String(state.customer.email || "")
    .trim()
    .toLowerCase();

  if (!customerEmail) {
    showToast("Google account email is required for order.");
    return;
  }

  const name = document.getElementById("oName").value.trim();
  const phone = document.getElementById("oPhone").value.trim();
  const qty = Math.max(1, Number(document.getElementById("oQty").value || 1));
  const paymentMethod = document.getElementById("oPay").value;
  const city = document.getElementById("oCity").value.trim();
  const pincode = document.getElementById("oPincode").value.trim();
  const address = document.getElementById("oAddress").value.trim();

  if (!name || !phone || !city || !pincode || !address) {
    showToast("Please complete all order details.");
    return;
  }

  let orderNo = "PENDING";
  try {
    const payload = await apiRequest("/api/orders", {
      method: "POST",
      requireAuth: true,
      body: {
        productId: product.id,
        qty,
        paymentMethod,
        customerName: name,
        customerPhone: phone,
        city,
        pincode,
        address
      }
    });
    state.apiReachable = true;
    orderNo = payload.orderNo || `ORD-${Date.now()}`;
  } catch (error) {
    const message = String(error?.message || "");
    const isConnectivityIssue =
      message.includes("Cannot reach API") ||
      message.includes("Request failed") ||
      message.includes("fetch");

    if (!isConnectivityIssue) {
      showToast(message || "Order save failed.");
      return;
    }

    state.apiReachable = false;
    orderNo = `OFFLINE-${Date.now()}`;
  }

  const orderValue = product.price * qty;
  const message = [
    "Hello SPY GLASS HOUSE,",
    "I want to place an order.",
    "",
    `Order No: ${orderNo}`,
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Unit Price: ${formatINR(product.price)}`,
    `Quantity: ${qty}`,
    `Order Value: ${formatINR(orderValue)}`,
    `Payment Method: ${paymentMethod}`,
    "",
    `Customer Name: ${name}`,
    `Customer Phone: ${phone}`,
    `Customer Email: ${customerEmail}`,
    `City: ${city}`,
    `Pincode: ${pincode}`,
    `Address: ${address}`
  ].join("\n");

  refs.sendOrderWa.href = makeWhatsAppLink(whatsappNumber, message);
  refs.modalFormBlock.style.display = "none";
  refs.okBlock.style.display = "block";
}

async function submitEnquiry(event) {
  event.preventDefault();
  const name = document.getElementById("cName").value.trim();
  const phone = document.getElementById("cPhone").value.trim();
  const email = document.getElementById("cEmail").value.trim();
  const city = document.getElementById("cCity").value.trim();
  const need = document.getElementById("cNeed").value.trim();
  const messageText = document.getElementById("cMsg").value.trim();

  if (!name || !phone) {
    showToast("Name and phone are required.");
    return;
  }

  try {
    await apiRequest("/api/enquiries", {
      method: "POST",
      withAuth: true,
      body: {
        name,
        phone,
        email,
        city,
        need,
        message: messageText
      }
    });
  } catch (_error) {
    // Continue to WhatsApp even if API write fails.
  }

  const waText = [
    "Hello SPY GLASS HOUSE,",
    "I need product guidance and quote.",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email || "Not specified"}`,
    `City: ${city || "Not specified"}`,
    `Need: ${need || "Not specified"}`,
    `Message: ${messageText || "No message"}`
  ].join("\n");

  window.open(makeWhatsAppLink(whatsappNumber, waText), "_blank", "noopener,noreferrer");
  refs.contactForm.reset();
  showToast("Enquiry prepared in WhatsApp.");
}

function bindEvents() {
  refs.authBtn.addEventListener("click", () => {
    if (state.customer) {
      void logoutCustomer();
      return;
    }
    void loginWithGoogle();
  });

  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value || "";
    renderProducts();
  });

  refs.filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }
    state.filter = button.getAttribute("data-filter") || "all";
    renderFilters();
    renderProducts();
  });

  refs.productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-id]");
    if (!button) {
      return;
    }
    if (!state.customer) {
      showToast("Please login with Google to place order.");
      void loginWithGoogle();
      return;
    }
    openModal(button.getAttribute("data-order-id"));
  });

  refs.closeModal.addEventListener("click", closeModal);
  refs.closeOk.addEventListener("click", closeModal);
  refs.modalWrap.addEventListener("click", (event) => {
    if (event.target === refs.modalWrap) {
      closeModal();
    }
  });
  refs.orderForm.addEventListener("submit", submitOrder);
  refs.contactForm.addEventListener("submit", submitEnquiry);
  window.addEventListener("scroll", reveal, { passive: true });
  window.addEventListener("resize", reveal);
}

function setupCustomerAuth() {
  if (!hasFirebaseConfig) {
    syncAuthUi();
    markAuthReady();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    onAuthStateChanged(auth, async (user) => {
      const hadCustomer = Boolean(state.customer);

      if (user) {
        const token = await getCustomerToken();
        state.idToken = token || "";
        state.customer = {
          uid: String(user.uid || "").trim(),
          name: String(user.displayName || "").trim(),
          email: String(user.email || "")
            .trim()
            .toLowerCase(),
          phone: String(user.phoneNumber || "").trim()
        };
      } else {
        state.customer = null;
        state.idToken = "";
      }

      syncAuthUi();

      if (!state.authReady) {
        markAuthReady();
      } else if (!hadCustomer && state.customer) {
        void logVisit("login");
      } else if (hadCustomer && !state.customer) {
        void logVisit("logout");
      }
    });
  } catch (_error) {
    auth = null;
    googleProvider = null;
    syncAuthUi();
    markAuthReady();
  }
}

async function init() {
  setupCustomerAuth();
  renderFilters();
  renderProducts();
  reveal();
  bindEvents();
  await Promise.race([authReady, new Promise((resolve) => setTimeout(resolve, 1500))]);
  await loadProducts();
  if (!state.loggedPageView) {
    state.loggedPageView = true;
    void logVisit("page_view");
  }
  reveal();
}

init();
