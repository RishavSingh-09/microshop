/**
 * API GATEWAY
 * -----------
 * The ONLY service the frontend talks to. It:
 *   - proxies /api/auth/*   -> auth-service
 *   - proxies /api/products -> product-service
 *   - proxies /api/cart     -> cart-service        (auth required)
 *   - proxies /api/orders   -> order-service       (auth required)
 *   - proxies /api/notifications -> notification-service (auth required)
 *   - verifies Bearer tokens by calling auth-service /verify
 *   - exposes GET /api/status which health-checks ALL services
 *
 * Env vars:
 *   PORT                      (default 8080)
 *   AUTH_SERVICE_URL          (default http://localhost:3001)
 *   PRODUCT_SERVICE_URL       (default http://localhost:3002)
 *   CART_SERVICE_URL          (default http://localhost:3003)
 *   ORDER_SERVICE_URL         (default http://localhost:3004)
 *   NOTIFICATION_SERVICE_URL  (default http://localhost:3005)
 */
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  products: process.env.PRODUCT_SERVICE_URL || "http://localhost:3002",
  cart: process.env.CART_SERVICE_URL || "http://localhost:3003",
  orders: process.env.ORDER_SERVICE_URL || "http://localhost:3004",
  notifications: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3005",
};

// Generic proxy helper
async function forward(res, url, opts = {}) {
  try {
    const r = await fetch(url, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ error: `Gateway could not reach upstream service at ${url}` });
  }
}

// Auth middleware: validates Bearer token with auth-service, attaches req.user
async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing Authorization header" });
  try {
    const r = await fetch(`${SERVICES.auth}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!r.ok) return res.status(401).json({ error: "Invalid or expired session" });
    const data = await r.json();
    req.user = data.user;
    next();
  } catch {
    res.status(502).json({ error: "Gateway could not reach auth-service" });
  }
}

// ---- Public routes ----
app.get("/health", (_req, res) => res.json({ service: "gateway", status: "ok" }));

// Cluster-wide status: health-checks every downstream service
app.get("/api/status", async (_req, res) => {
  const entries = await Promise.all(
    Object.entries(SERVICES).map(async ([name, base]) => {
      const started = Date.now();
      try {
        const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500) });
        const body = await r.json();
        return [name, { up: r.ok, ms: Date.now() - started, ...body }];
      } catch {
        return [name, { up: false, ms: Date.now() - started }];
      }
    })
  );
  res.json({ gateway: { up: true }, services: Object.fromEntries(entries) });
});

app.post("/api/auth/register", (req, res) => forward(res, `${SERVICES.auth}/register`, { method: "POST", body: req.body }));
app.post("/api/auth/login", (req, res) => forward(res, `${SERVICES.auth}/login`, { method: "POST", body: req.body }));
app.get("/api/products", (_req, res) => forward(res, `${SERVICES.products}/products`));
app.get("/api/products/:id", (req, res) => forward(res, `${SERVICES.products}/products/${req.params.id}`));

// ---- Protected routes (userId always comes from the verified token) ----
app.get("/api/cart", requireAuth, (req, res) =>
  forward(res, `${SERVICES.cart}/cart/${req.user.id}`));
app.post("/api/cart/items", requireAuth, (req, res) =>
  forward(res, `${SERVICES.cart}/cart/${req.user.id}/items`, { method: "POST", body: req.body }));
app.delete("/api/cart/items/:productId", requireAuth, (req, res) =>
  forward(res, `${SERVICES.cart}/cart/${req.user.id}/items/${req.params.productId}`, { method: "DELETE" }));

app.get("/api/orders", requireAuth, (req, res) =>
  forward(res, `${SERVICES.orders}/orders/${req.user.id}`));
app.post("/api/orders/checkout", requireAuth, (req, res) =>
  forward(res, `${SERVICES.orders}/orders/${req.user.id}/checkout`, { method: "POST", body: { userName: req.user.name } }));

app.get("/api/notifications", requireAuth, (req, res) =>
  forward(res, `${SERVICES.notifications}/notifications/${req.user.id}`));
app.post("/api/notifications/read", requireAuth, (req, res) =>
  forward(res, `${SERVICES.notifications}/notifications/${req.user.id}/read`, { method: "POST" }));

app.listen(PORT, () => {
  console.log(`[gateway] listening on ${PORT}`);
  console.log("[gateway] upstreams:", SERVICES);
});
