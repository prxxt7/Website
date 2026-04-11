export const STARTER_PRODUCTS = [
  {
    name: "Aurora Arch Mirror",
    category: "Designer Mirror",
    type: "designer",
    price: 6499,
    badge: "Best Seller",
    description: "Elegant arch mirror with premium polish and balanced frame profile.",
    image: "/assets/product-aurora.svg",
    isActive: true
  },
  {
    name: "Luma LED Vanity Mirror",
    category: "LED Mirror",
    type: "led",
    price: 8999,
    badge: "Premium",
    description: "Touch LED vanity mirror with warm and neutral light modes.",
    image: "/assets/product-luma.svg",
    isActive: true
  },
  {
    name: "Regal Full Length Mirror",
    category: "Dressing Mirror",
    type: "dressing",
    price: 5799,
    badge: "",
    description: "Full-length dressing mirror for bedrooms and studio spaces.",
    image: "/assets/product-regal.svg",
    isActive: true
  },
  {
    name: "Nova Ring Light Mirror",
    category: "LED Mirror",
    type: "led",
    price: 10499,
    badge: "New",
    description: "Round anti-fog LED mirror with soft halo ring illumination.",
    image: "/assets/product-nova.svg",
    isActive: true
  },
  {
    name: "Hexa Decor Mirror Set",
    category: "Wall Mirror",
    type: "decor",
    price: 2899,
    badge: "Sale",
    description: "Geometric mirror set ideal for modern feature walls.",
    image: "/assets/product-hexa.svg",
    isActive: true
  },
  {
    name: "Orion Wall Lighting Pair",
    category: "Decor Lighting",
    type: "lighting",
    price: 3399,
    badge: "",
    description: "Accent wall lighting pair for premium interior ambience.",
    image: "/assets/product-orion.svg",
    isActive: true
  }
];

export const FILTERS = [
  { key: "all", label: "All" },
  { key: "designer", label: "Designer" },
  { key: "led", label: "LED" },
  { key: "dressing", label: "Dressing" },
  { key: "decor", label: "Decor" },
  { key: "lighting", label: "Lighting" }
];

export function formatINR(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSessionId() {
  const key = "spyglass_session_id";
  const current = localStorage.getItem(key);
  if (current) {
    return current;
  }
  const created = `S-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  localStorage.setItem(key, created);
  return created;
}

export function makeWhatsAppLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function fmtDate(ts) {
  if (!ts) {
    return "-";
  }
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-IN");
}
