/**
 * ORDER SERVICE
 * -------------
 * The checkout orchestrator. Placing an order:
 *   1. Reads the user's cart from cart-service
 *   2. Reserves stock in product-service (all-or-nothing)
 *   3. Saves the order (in-memory)
 *   4. Clears the cart in cart-service
 *   5. Sends an event to notification-service
 * A failure at step 1 or 2 aborts the order - great for observing
 * cascading failures when you kill a pod.
 *
 * Env vars:
 *   PORT                      (default 3004)
 *   CART_SERVICE_URL          (default http://localhost:3003)
 *   PRODUCT_SERVICE_URL       (default http://localhost:3002)
 *   NOTIFICATION_SERVICE_URL  (default http://localhost:3005)
 */
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3004;
const CART_URL = process.env.CART_SERVICE_URL || "http://localhost:3003";
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:3002";
const NOTIFY_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3005";

const orders = new Map(); // userId -> [order]
let nextOrderId = 1000;

app.get("/health", (_req, res) =>
  res.json({
    service: "order-service", status: "ok",
    dependsOn: [CART_URL, PRODUCT_URL, NOTIFY_URL],
  })
);

app.get("/orders/:userId", (req, res) => {
  res.json(orders.get(String(req.params.userId)) || []);
});

app.post("/orders/:userId/checkout", async (req, res) => {
  const userId = String(req.params.userId);
  const userName = req.body?.userName || "customer";

  // 1. Fetch the cart
  let cart;
  try {
    const r = await fetch(`${CART_URL}/cart/${userId}`);
    if (!r.ok) throw new Error();
    cart = await r.json();
  } catch {
    return res.status(502).json({ error: "order-service could not reach cart-service" });
  }
  if (!cart.items.length) return res.status(400).json({ error: "Your cart is empty" });

  // 2. Reserve stock
  try {
    const r = await fetch(`${PRODUCT_URL}/products/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.items.map(({ productId, qty }) => ({ productId, qty })) }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: body.error || "Stock reservation failed" });
    }
  } catch {
    return res.status(502).json({ error: "order-service could not reach product-service" });
  }

  // 3. Save the order
  const order = {
    id: nextOrderId++,
    items: cart.items,
    total: cart.total,
    status: "CONFIRMED",
    placedAt: new Date().toISOString(),
  };
  orders.set(userId, [order, ...(orders.get(userId) || [])]);

  // 4. Clear the cart (best-effort)
  fetch(`${CART_URL}/cart/${userId}`, { method: "DELETE" }).catch(() => {});

  // 5. Notify (best-effort, fire-and-forget)
  fetch(`${NOTIFY_URL}/notifications/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "ORDER_CONFIRMED",
      message: `Hi ${userName}, order #${order.id} confirmed - ${order.items.length} item(s), total ₹${(order.total / 100).toFixed(2)}`,
    }),
  }).catch(() => {});

  res.status(201).json(order);
});

app.listen(PORT, () =>
  console.log(`[order-service] listening on ${PORT} (cart @ ${CART_URL}, products @ ${PRODUCT_URL}, notify @ ${NOTIFY_URL})`)
);
