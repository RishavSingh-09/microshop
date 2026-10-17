/**
 * CART SERVICE
 * ------------
 * Stores each user's cart. It NEVER trusts client-side prices:
 * on every add/read it calls product-service to validate the item
 * and fetch the live price. If product-service is down, carts break.
 *
 * Env vars:
 *   PORT                 (default 3003)
 *   PRODUCT_SERVICE_URL  (default http://localhost:3002)
 */
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3003;
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:3002";

// userId -> [{ productId, qty }]
const carts = new Map();

const getCart = (userId) => carts.get(String(userId)) || [];

async function enrich(items) {
  // Look up every product live from product-service
  const detailed = await Promise.all(
    items.map(async (it) => {
      const r = await fetch(`${PRODUCT_URL}/products/${it.productId}`);
      if (!r.ok) return null;
      const p = await r.json();
      return { productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: it.qty, subtotal: p.price * it.qty };
    })
  );
  const valid = detailed.filter(Boolean);
  return { items: valid, total: valid.reduce((s, x) => s + x.subtotal, 0) };
}

app.get("/health", (_req, res) =>
  res.json({ service: "cart-service", status: "ok", carts: carts.size, dependsOn: [PRODUCT_URL] })
);

app.get("/cart/:userId", async (req, res) => {
  try {
    res.json(await enrich(getCart(req.params.userId)));
  } catch {
    res.status(502).json({ error: "cart-service could not reach product-service" });
  }
});

app.post("/cart/:userId/items", async (req, res) => {
  const { productId, qty = 1 } = req.body || {};
  try {
    const r = await fetch(`${PRODUCT_URL}/products/${productId}`);
    if (!r.ok) return res.status(404).json({ error: "Product does not exist" });
    const product = await r.json();
    if (product.stock < qty) return res.status(409).json({ error: `Only ${product.stock} left in stock` });

    const cart = getCart(req.params.userId);
    const existing = cart.find((x) => x.productId === productId);
    if (existing) existing.qty += qty;
    else cart.push({ productId, qty });
    carts.set(String(req.params.userId), cart);

    res.status(201).json(await enrich(cart));
  } catch {
    res.status(502).json({ error: "cart-service could not reach product-service" });
  }
});

app.delete("/cart/:userId/items/:productId", async (req, res) => {
  const cart = getCart(req.params.userId).filter(
    (x) => x.productId !== Number(req.params.productId)
  );
  carts.set(String(req.params.userId), cart);
  try {
    res.json(await enrich(cart));
  } catch {
    res.status(502).json({ error: "cart-service could not reach product-service" });
  }
});

// Called by order-service after a successful checkout
app.delete("/cart/:userId", (req, res) => {
  carts.delete(String(req.params.userId));
  res.json({ cleared: true });
});

app.listen(PORT, () => console.log(`[cart-service] listening on ${PORT} (products @ ${PRODUCT_URL})`));
