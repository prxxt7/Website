import { fmtDate, formatINR } from "./shared.js";

const refs = {
  configWarning: document.getElementById("configWarning"),
  adminUserChip: document.getElementById("adminUserChip"),
  allowedEmailLabel: document.getElementById("allowedEmailLabel"),
  loginCard: document.getElementById("loginCard"),
  unauthorizedCard: document.getElementById("unauthorizedCard"),
  adminApp: document.getElementById("adminApp"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminEmail: document.getElementById("adminEmail"),
  adminPassword: document.getElementById("adminPassword"),
  loginBtn: document.getElementById("loginBtn"),
  switchAccountBtn: document.getElementById("switchAccountBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  statProducts: document.getElementById("statProducts"),
  statOrders: document.getElementById("statOrders"),
  statVisits: document.getElementById("statVisits"),
  statUniqueSessions: document.getElementById("statUniqueSessions"),
  statLoggedUsers: document.getElementById("statLoggedUsers"),
  seedBtn: document.getElementById("seedBtn"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  productForm: document.getElementById("productForm"),
  productRows: document.getElementById("productRows"),
  orderRows: document.getElementById("orderRows"),
  visitRows: document.getElementById("visitRows"),
  enquiryRows: document.getElementById("enquiryRows"),
  toast: document.getElementById("toast")
};

const state = {
  adminEmail: "",
  products: [],
  orders: [],
  visits: [],
  enquiries: []
};

const TOKEN_KEY = "spyglass_admin_token";
const apiBase = String(window.SPYGLASS_API_BASE || "http://127.0.0.1:8080").replace(/\/+$/, "");
const adminEmails = (window.SPYGLASS_ADMIN_EMAILS || []).map((item) => String(item).toLowerCase());

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const token = options.token || "";
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (_error) {
    throw new Error(
      "Cannot reach API. Start backend with npm start and open admin using http://127.0.0.1:5500/owner-portal-sgh-7842.html"
    );
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove("show"), 2500);
}

function setView(mode) {
  refs.loginCard.hidden = mode !== "login";
  refs.unauthorizedCard.hidden = mode !== "unauthorized";
  refs.adminApp.hidden = mode !== "app";
  refs.logoutBtn.hidden = mode !== "app";
}

function setUserChip(email) {
  refs.adminUserChip.textContent = email || "Not Signed In";
}

function clearProductForm() {
  refs.productForm.reset();
  document.getElementById("productId").value = "";
  document.getElementById("productIsActive").value = "true";
}

function formatStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function renderStats() {
  refs.statProducts.textContent = String(state.products.length);
  refs.statOrders.textContent = String(state.orders.length);
  refs.statVisits.textContent = String(state.visits.length);
  refs.statUniqueSessions.textContent = String(new Set(state.visits.map((v) => v.sessionId).filter(Boolean)).size);
  refs.statLoggedUsers.textContent = String(new Set(state.visits.map((v) => v.userEmail).filter(Boolean)).size);
}

function renderProducts() {
  if (!state.products.length) {
    refs.productRows.innerHTML = `<tr><td colspan="5">No products found.</td></tr>`;
    return;
  }
  refs.productRows.innerHTML = state.products
    .map(
      (p) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.type}</td>
      <td>${formatINR(p.price)}</td>
      <td>${p.isActive ? "Active" : "Hidden"}</td>
      <td>
        <button type="button" class="mini-btn" data-edit="${p.id}">Edit</button>
        <button type="button" class="mini-btn" data-delete="${p.id}">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function renderOrders() {
  if (!state.orders.length) {
    refs.orderRows.innerHTML = `<tr><td colspan="5">No orders found.</td></tr>`;
    return;
  }
  refs.orderRows.innerHTML = state.orders
    .map(
      (order) => `
    <tr>
      <td>
        <strong>${order.orderNo || order.id}</strong><br>
        ${order.productName || "-"}
      </td>
      <td>
        ${order.customerName || "-"}<br>
        ${order.customerEmail || "-"}<br>
        ${order.customerPhone || "-"}
      </td>
      <td>${formatINR(order.total)}</td>
      <td>
        <select data-order-id="${order.id}">
          <option value="new" ${order.orderStatus === "new" ? "selected" : ""}>New</option>
          <option value="confirmed" ${order.orderStatus === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="packed" ${order.orderStatus === "packed" ? "selected" : ""}>Packed</option>
          <option value="shipped" ${order.orderStatus === "shipped" ? "selected" : ""}>Shipped</option>
          <option value="delivered" ${order.orderStatus === "delivered" ? "selected" : ""}>Delivered</option>
          <option value="cancelled" ${order.orderStatus === "cancelled" ? "selected" : ""}>Cancelled</option>
        </select>
      </td>
      <td>${fmtDate(order.createdAt)}</td>
    </tr>
  `
    )
    .join("");
}

function renderVisits() {
  if (!state.visits.length) {
    refs.visitRows.innerHTML = `<tr><td colspan="6">No visits logged yet.</td></tr>`;
    return;
  }
  refs.visitRows.innerHTML = state.visits
    .map(
      (visit) => `
    <tr>
      <td>${fmtDate(visit.visitedAt)}</td>
      <td>${visit.userEmail || "-"}</td>
      <td>${visit.sessionId || "-"}</td>
      <td>${visit.city || "-"}, ${visit.country || "-"}</td>
      <td>${formatStatusLabel(visit.eventType)}</td>
      <td>${visit.path || "-"}</td>
    </tr>
  `
    )
    .join("");
}

function renderEnquiries() {
  if (!state.enquiries.length) {
    refs.enquiryRows.innerHTML = `<tr><td colspan="5">No enquiries yet.</td></tr>`;
    return;
  }
  refs.enquiryRows.innerHTML = state.enquiries
    .map(
      (entry) => `
    <tr>
      <td>${fmtDate(entry.createdAt)}</td>
      <td>${entry.name || "-"}</td>
      <td>${entry.phone || "-"}</td>
      <td>${entry.need || "-"}</td>
      <td>${entry.city || "-"}</td>
    </tr>
  `
    )
    .join("");
}

async function loadDashboardData() {
  const token = getToken();
  const data = await apiRequest("/api/admin/dashboard", { token });
  state.products = data.products || [];
  state.orders = data.orders || [];
  state.visits = data.visits || [];
  state.enquiries = data.enquiries || [];
  renderStats();
  renderProducts();
  renderOrders();
  renderVisits();
  renderEnquiries();
}

function fillProductForm(productId) {
  const product = state.products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return;
  }
  document.getElementById("productId").value = product.id;
  document.getElementById("productName").value = product.name || "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productType").value = product.type || "";
  document.getElementById("productPrice").value = String(product.price || "");
  document.getElementById("productBadge").value = product.badge || "";
  document.getElementById("productImage").value = product.image || "";
  document.getElementById("productDescription").value = product.description || "";
  document.getElementById("productIsActive").value = product.isActive === false ? "false" : "true";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveProduct(event) {
  event.preventDefault();
  const id = document.getElementById("productId").value.trim();
  const payload = {
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("productCategory").value.trim(),
    type: document.getElementById("productType").value.trim().toLowerCase(),
    price: Number(document.getElementById("productPrice").value || 0),
    badge: document.getElementById("productBadge").value.trim(),
    image: document.getElementById("productImage").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    isActive: document.getElementById("productIsActive").value === "true"
  };

  if (!payload.name || !payload.category || !payload.type || !payload.price || !payload.description) {
    showToast("Please fill all required product fields.");
    return;
  }

  try {
    const token = getToken();
    if (id) {
      await apiRequest(`/api/admin/products/${id}`, {
        method: "PUT",
        token,
        body: payload
      });
      showToast("Product updated.");
    } else {
      await apiRequest("/api/admin/products", {
        method: "POST",
        token,
        body: payload
      });
      showToast("Product created.");
    }
    clearProductForm();
    await loadDashboardData();
  } catch (error) {
    showToast(error.message || "Failed to save product.");
  }
}

async function deleteProduct(productId) {
  const confirmed = window.confirm("Delete this product?");
  if (!confirmed) {
    return;
  }
  try {
    await apiRequest(`/api/admin/products/${productId}`, {
      method: "DELETE",
      token: getToken()
    });
    showToast("Product deleted.");
    await loadDashboardData();
  } catch (error) {
    showToast(error.message || "Delete failed.");
  }
}

async function handleOrderStatusChange(event) {
  const select = event.target.closest("select[data-order-id]");
  if (!select) {
    return;
  }
  const orderId = select.getAttribute("data-order-id");
  const status = String(select.value || "").toLowerCase();
  if (!orderId || !status) {
    return;
  }
  try {
    await apiRequest(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      token: getToken(),
      body: { status }
    });
    showToast("Order status updated.");
  } catch (error) {
    showToast(error.message || "Status update failed.");
  }
}

async function seedStarterProducts() {
  const confirmed = window.confirm("Seed starter products into MySQL database?");
  if (!confirmed) {
    return;
  }
  try {
    await apiRequest("/api/admin/seed", {
      method: "POST",
      token: getToken()
    });
    showToast("Starter products seeded.");
    await loadDashboardData();
  } catch (error) {
    showToast(error.message || "Seed failed.");
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  const email = refs.adminEmail.value.trim().toLowerCase();
  const password = refs.adminPassword.value;
  if (!email || !password) {
    showToast("Email and password are required.");
    return;
  }

  refs.loginBtn.disabled = true;
  try {
    const data = await apiRequest("/api/admin/login", {
      method: "POST",
      body: { email, password }
    });
    setToken(data.token);
    state.adminEmail = data.email || email;
    setUserChip(state.adminEmail);
    refs.adminPassword.value = "";
    setView("app");
    await loadDashboardData();
    showToast("Admin login successful.");
  } catch (error) {
    clearToken();
    setUserChip("");
    setView("unauthorized");
    showToast(error.message || "Login failed.");
  } finally {
    refs.loginBtn.disabled = false;
  }
}

async function restoreSession() {
  const token = getToken();
  if (!token) {
    setView("login");
    return;
  }

  try {
    await loadDashboardData();
    const email = adminEmails[0] || "Admin";
    state.adminEmail = email;
    setUserChip(email);
    setView("app");
  } catch (_error) {
    clearToken();
    setUserChip("");
    setView("login");
  }
}

function bindEvents() {
  refs.adminLoginForm.addEventListener("submit", (event) => {
    void loginAdmin(event);
  });
  refs.switchAccountBtn.addEventListener("click", () => {
    setView("login");
  });
  refs.logoutBtn.addEventListener("click", () => {
    clearToken();
    state.adminEmail = "";
    setUserChip("");
    setView("login");
    showToast("Logged out.");
  });
  refs.productForm.addEventListener("submit", (event) => {
    void saveProduct(event);
  });
  refs.clearFormBtn.addEventListener("click", clearProductForm);
  refs.seedBtn.addEventListener("click", () => {
    void seedStarterProducts();
  });
  refs.productRows.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      fillProductForm(editBtn.getAttribute("data-edit"));
      return;
    }
    const deleteBtn = event.target.closest("[data-delete]");
    if (deleteBtn) {
      void deleteProduct(deleteBtn.getAttribute("data-delete"));
    }
  });
  refs.orderRows.addEventListener("change", (event) => {
    void handleOrderStatusChange(event);
  });
}

function init() {
  refs.allowedEmailLabel.textContent = adminEmails.join(", ") || "No admin email configured";
  bindEvents();
  void restoreSession();
}

init();
