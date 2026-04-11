import cors from "cors";
import express from "express";
import { createAdminToken, optionalCustomer, requireAdmin, requireCustomer } from "./auth.js";
import { config } from "./config.js";
import { pool, query } from "./db.js";
import { STARTER_PRODUCTS } from "./starter-products.js";
import {
  asBoolean,
  asSafeNumber,
  asSafeString,
  deviceTypeFromUserAgent,
  makeOrderNumber,
  normalizeOrderStatus,
  normalizePaymentMethod,
  slugify
} from "./utils.js";

const app = express();

const allowedOrigins = new Set(config.corsOrigins);
function isLocalDevOrigin(origin) {
  if (origin.startsWith("vscode-webview://") || origin.startsWith("vscode://")) {
    return true;
  }

  try {
    const url = new URL(origin);
    const host = (url.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        origin === "null" ||
        allowedOrigins.size === 0 ||
        allowedOrigins.has(origin) ||
        isLocalDevOrigin(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    type: row.type_key,
    badge: row.badge || "",
    description: row.description || "",
    image: row.image_url || "",
    price: Number(row.price_inr || 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    productName: row.product_name || "-",
    customerName: row.customer_name || "-",
    customerEmail: row.customer_email || "-",
    customerPhone: row.customer_phone || "-",
    total: Number(row.total_amount || 0),
    paymentMethod: row.payment_method || "",
    paymentStatus: row.payment_status || "",
    orderStatus: row.order_status || "new",
    createdAt: row.created_at
  };
}

function mapVisit(row) {
  return {
    id: row.id,
    sessionId: row.session_id || "",
    userEmail: row.user_email || "",
    eventType: row.event_type || "",
    path: row.page_path || "",
    referrer: row.referrer || "",
    country: row.country || "",
    city: row.city || "",
    ip: row.ip_address || "",
    visitedAt: row.created_at
  };
}

function mapEnquiry(row) {
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    city: row.city || "",
    need: row.need || "",
    message: row.message || "",
    createdAt: row.created_at
  };
}

function normalizeProductPayload(body) {
  return {
    name: asSafeString(body.name, 180),
    category: asSafeString(body.category, 120),
    type: asSafeString(body.type, 80).toLowerCase(),
    price: asSafeNumber(body.price, 0),
    badge: asSafeString(body.badge, 80),
    description: asSafeString(body.description, 5000),
    image: asSafeString(body.image, 2000),
    isActive: asBoolean(body.isActive, true)
  };
}

async function makeUniqueSlug(base) {
  const seed = base || `product-${Date.now()}`;
  let candidate = seed;
  let suffix = 1;
  while (true) {
    const rows = await query("SELECT id FROM products WHERE slug = ? LIMIT 1", [candidate]);
    if (!rows.length) {
      return candidate;
    }
    candidate = `${seed}-${suffix}`;
    suffix += 1;
  }
}

async function upsertCustomerUser(customer) {
  const uid = asSafeString(customer?.uid, 128) || null;
  const phone = asSafeString(customer?.phone, 30) || null;
  const givenEmail = asSafeString(customer?.email, 190).toLowerCase();
  const email = givenEmail || (uid ? `otp-${uid}@spyglass.local` : "");
  if (!email) {
    return null;
  }

  const name = asSafeString(customer?.name, 120) || email.split("@")[0];

  await query(
    `
    INSERT INTO users (google_uid, name, email, phone, role, is_active)
    VALUES (?, ?, ?, ?, 'customer', 1)
    ON DUPLICATE KEY UPDATE
      google_uid = COALESCE(VALUES(google_uid), google_uid),
      name = VALUES(name),
      phone = COALESCE(VALUES(phone), phone),
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    [uid, name, email, phone]
  );

  const rows = await query(
    `
    SELECT id, google_uid, name, email, phone, role
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

app.get(
  "/api/health",
  wrap(async (_req, res) => {
    await query("SELECT 1 AS ok");
    res.json({ ok: true, project: "SPY GLASS HOUSE", db: config.dbName });
  })
);

app.post(
  "/api/admin/login",
  wrap(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const expectedEmail = config.adminLoginEmail || config.adminEmails[0] || "";
    const emailAllowed = config.adminEmails.includes(email);
    const passwordOk = Boolean(config.adminLoginPassword) && password === config.adminLoginPassword;

    if (!emailAllowed || email !== expectedEmail || !passwordOk) {
      res.status(401).json({ error: "Invalid admin email or password." });
      return;
    }

    const token = createAdminToken(email);
    res.json({ token, email });
  })
);

app.get(
  "/api/products",
  wrap(async (req, res) => {
    const search = asSafeString(req.query.search || "", 80).toLowerCase();
    const filter = asSafeString(req.query.filter || "all", 40).toLowerCase();
    const includeInactive = asBoolean(req.query.includeInactive, false);

    const where = [];
    const params = [];

    if (!includeInactive) {
      where.push("is_active = 1");
    }

    if (filter && filter !== "all") {
      where.push("LOWER(type_key) = ?");
      params.push(filter);
    }

    if (search) {
      where.push("(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await query(
      `
      SELECT id, slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_at, updated_at
      FROM products
      ${whereSql}
      ORDER BY name ASC
      LIMIT 500
      `,
      params
    );

    res.json({ products: rows.map(mapProduct) });
  })
);

app.post(
  "/api/visits",
  optionalCustomer,
  wrap(async (req, res) => {
    const body = req.body || {};
    const ipAddress = asSafeString(
      String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket.remoteAddress || "",
      64
    );
    const userAgent = asSafeString(body.userAgent || req.headers["user-agent"] || "", 512);
    const eventType = asSafeString(body.eventType || "page_view", 60) || "page_view";
    const customer = req.customer || null;
    const userRecord = customer ? await upsertCustomerUser(customer) : null;

    await query(
      `
      INSERT INTO visits (
        session_id, user_id, event_type, page_path, referrer, user_agent,
        ip_address, country, city, device_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        asSafeString(body.sessionId, 120),
        userRecord?.id || null,
        eventType,
        asSafeString(body.path, 255),
        asSafeString(body.referrer, 500),
        userAgent,
        ipAddress,
        asSafeString(body.country, 100),
        asSafeString(body.city, 100),
        asSafeString(body.deviceType, 40) || deviceTypeFromUserAgent(userAgent)
      ]
    );

    res.status(201).json({ ok: true });
  })
);

app.post(
  "/api/enquiries",
  optionalCustomer,
  wrap(async (req, res) => {
    const body = req.body || {};
    const name = asSafeString(body.name, 120);
    const phone = asSafeString(body.phone, 30);

    if (!name || !phone) {
      res.status(400).json({ error: "Name and phone are required." });
      return;
    }

    const customer = req.customer || null;
    const userRecord = customer ? await upsertCustomerUser(customer) : null;

    await query(
      `
      INSERT INTO enquiries (user_id, name, email, phone, city, need, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userRecord?.id || null,
        name,
        asSafeString(body.email, 190) || null,
        phone,
        asSafeString(body.city, 100),
        asSafeString(body.need, 120),
        asSafeString(body.message, 5000)
      ]
    );

    res.status(201).json({ ok: true });
  })
);

app.post(
  "/api/orders",
  requireCustomer,
  wrap(async (req, res) => {
    const body = req.body || {};
    const customer = req.customer || null;
    const userRecord = await upsertCustomerUser(customer);
    if (!userRecord) {
      res.status(400).json({ error: "Customer profile could not be resolved." });
      return;
    }
    const productId = asSafeNumber(body.productId, 0);
    const qty = Math.max(1, Math.min(50, Math.floor(asSafeNumber(body.qty, 1))));
    const paymentMethod = normalizePaymentMethod(body.paymentMethod);
    const customerName = asSafeString(body.customerName, 120) || asSafeString(userRecord?.name, 120);
    const customerPhone = asSafeString(body.customerPhone, 30);
    const customerEmail = asSafeString(userRecord?.email, 190).toLowerCase();
    const city = asSafeString(body.city, 100);
    const pincode = asSafeString(body.pincode, 20);
    const address = asSafeString(body.address, 1000);

    if (
      !productId ||
      !paymentMethod ||
      !customerName ||
      !customerPhone ||
      !customerEmail ||
      !city ||
      !pincode ||
      !address
    ) {
      res.status(400).json({ error: "Please provide complete order details." });
      return;
    }

    const productRows = await query(
      `
      SELECT id, name, category, price_inr, is_active
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (!productRows.length || !productRows[0].is_active) {
      res.status(404).json({ error: "Selected product is not available." });
      return;
    }

    const product = productRows[0];
    const unitPrice = Number(product.price_inr || 0);
    const subtotal = Number((unitPrice * qty).toFixed(2));
    const shippingFee = 0;
    const totalAmount = Number((subtotal + shippingFee).toFixed(2));
    const orderNo = makeOrderNumber();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [orderResult] = await connection.execute(
        `
        INSERT INTO orders (
          order_no, user_id, customer_name, customer_email, customer_phone,
          city, pincode, address_line, payment_method, payment_status,
          order_status, subtotal, shipping_fee, total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'new', ?, ?, ?)
        `,
        [
          orderNo,
          userRecord?.id || null,
          customerName,
          customerEmail,
          customerPhone,
          city,
          pincode,
          address,
          paymentMethod,
          subtotal,
          shippingFee,
          totalAmount
        ]
      );

      const orderId = orderResult.insertId;

      await connection.execute(
        `
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [orderId, product.id, product.name, unitPrice, qty, totalAmount]
      );

      await connection.commit();

      res.status(201).json({
        ok: true,
        orderId,
        orderNo,
        productName: product.name,
        category: product.category,
        unitPrice,
        qty,
        total: totalAmount
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.get(
  "/api/admin/dashboard",
  requireAdmin,
  wrap(async (_req, res) => {
    const [products, orders, visits, enquiries] = await Promise.all([
      query(
        `
        SELECT id, slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_at, updated_at
        FROM products
        ORDER BY name ASC
        LIMIT 500
        `
      ),
      query(
        `
        SELECT
          o.id, o.order_no, o.customer_name, o.customer_email, o.customer_phone,
          o.total_amount, o.payment_method, o.payment_status, o.order_status, o.created_at,
          (
            SELECT oi.product_name
            FROM order_items oi
            WHERE oi.order_id = o.id
            ORDER BY oi.id ASC
            LIMIT 1
          ) AS product_name
        FROM orders o
        ORDER BY o.created_at DESC
        LIMIT 400
        `
      ),
      query(
        `
        SELECT
          v.id, v.session_id, v.event_type, v.page_path, v.referrer, v.ip_address, v.country, v.city, v.created_at,
          u.email AS user_email
        FROM visits v
        LEFT JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC
        LIMIT 500
        `
      ),
      query(
        `
        SELECT id, name, email, phone, city, need, message, created_at
        FROM enquiries
        ORDER BY created_at DESC
        LIMIT 300
        `
      )
    ]);

    res.json({
      products: products.map(mapProduct),
      orders: orders.map(mapOrder),
      visits: visits.map(mapVisit),
      enquiries: enquiries.map(mapEnquiry)
    });
  })
);

app.post(
  "/api/admin/products",
  requireAdmin,
  wrap(async (req, res) => {
    const payload = normalizeProductPayload(req.body || {});
    if (!payload.name || !payload.category || !payload.type || !payload.price || !payload.description || !payload.image) {
      res.status(400).json({ error: "Please fill all required product fields." });
      return;
    }

    const slug = await makeUniqueSlug(slugify(payload.name));
    const result = await query(
      `
      INSERT INTO products (
        slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        slug,
        payload.name,
        payload.category,
        payload.type,
        payload.badge,
        payload.description,
        payload.image,
        payload.price,
        payload.isActive ? 1 : 0,
        null
      ]
    );

    const rows = await query(
      `
      SELECT id, slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_at, updated_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json({ ok: true, product: mapProduct(rows[0]) });
  })
);

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const id = asSafeNumber(req.params.id, 0);
    const payload = normalizeProductPayload(req.body || {});

    if (
      !id ||
      !payload.name ||
      !payload.category ||
      !payload.type ||
      !payload.price ||
      !payload.description ||
      !payload.image
    ) {
      res.status(400).json({ error: "Invalid product update payload." });
      return;
    }

    const rows = await query("SELECT id, slug FROM products WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    const existing = rows[0];
    const nextSlugSeed = slugify(payload.name);
    let nextSlug = existing.slug;
    if (nextSlugSeed && nextSlugSeed !== existing.slug) {
      nextSlug = await makeUniqueSlug(nextSlugSeed);
    }

    await query(
      `
      UPDATE products
      SET slug = ?, name = ?, category = ?, type_key = ?, badge = ?, description = ?, image_url = ?, price_inr = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        nextSlug,
        payload.name,
        payload.category,
        payload.type,
        payload.badge,
        payload.description,
        payload.image,
        payload.price,
        payload.isActive ? 1 : 0,
        id
      ]
    );

    const updatedRows = await query(
      `
      SELECT id, slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_at, updated_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    res.json({ ok: true, product: mapProduct(updatedRows[0]) });
  })
);

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const id = asSafeNumber(req.params.id, 0);
    if (!id) {
      res.status(400).json({ error: "Invalid product id." });
      return;
    }

    await query("DELETE FROM products WHERE id = ? LIMIT 1", [id]);
    res.json({ ok: true });
  })
);

app.patch(
  "/api/admin/orders/:id/status",
  requireAdmin,
  wrap(async (req, res) => {
    const id = asSafeNumber(req.params.id, 0);
    const status = normalizeOrderStatus(req.body?.status || "");
    if (!id || !status) {
      res.status(400).json({ error: "Invalid order status update." });
      return;
    }

    await query(
      `
      UPDATE orders
      SET order_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, id]
    );

    res.json({ ok: true });
  })
);

app.post(
  "/api/admin/seed",
  requireAdmin,
  wrap(async (_req, res) => {
    let count = 0;
    for (const item of STARTER_PRODUCTS) {
      const slug = slugify(item.name);
      await query(
        `
        INSERT INTO products (slug, name, category, type_key, badge, description, image_url, price_inr, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          category = VALUES(category),
          type_key = VALUES(type_key),
          badge = VALUES(badge),
          description = VALUES(description),
          image_url = VALUES(image_url),
          price_inr = VALUES(price_inr),
          is_active = VALUES(is_active),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          slug,
          item.name,
          item.category,
          item.type,
          item.badge || "",
          item.description,
          item.image,
          asSafeNumber(item.price, 0),
          item.isActive ? 1 : 0,
          null
        ]
      );
      count += 1;
    }

    res.json({ ok: true, seeded: count });
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((error, _req, res, _next) => {
  const statusCode = Number(error.statusCode || error.status || 500);
  const message = statusCode >= 500 ? "Internal server error." : error.message || "Request failed.";
  if (statusCode >= 500) {
    console.error(error);
  }
  res.status(statusCode).json({ error: message });
});

async function start() {
  await query("SELECT 1 AS up");
  app.listen(config.port, () => {
    console.log(`SPY GLASS HOUSE API running on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
