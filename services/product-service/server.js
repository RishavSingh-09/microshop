/**
 * PRODUCT SERVICE
 * ---------------
 * Owns the product catalog and stock levels.
 * Called by: gateway (browse), cart-service (validate/enrich items),
 * order-service (reserve stock at checkout).
 *
 * Env vars:
 *   PORT (default 3002)
 */
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;

let products = [
  { id: 1, name: "Mechanical Keyboard", price: 4999, stock: 12, emoji: "⌨️",  desc: "Hot-swappable, tactile switches" },
  { id: 2, name: "4K Monitor 27\"",     price: 21999, stock: 7,  emoji: "🖥️", desc: "IPS panel, 144Hz refresh" },
  { id: 3, name: "Wireless Mouse",      price: 1899, stock: 30, emoji: "🖱️", desc: "Ergonomic, 8 buttons" },
  { id: 4, name: "USB-C Dock",          price: 6499, stock: 15, emoji: "🔌", desc: "Dual HDMI + 100W passthrough" },
  { id: 5, name: "Noise-Cancel Headset",price: 8999, stock: 9,  emoji: "🎧", desc: "40h battery, boom mic" },
  { id: 6, name: "Laptop Stand",        price: 2499, stock: 22, emoji: "💻", desc: "Aluminium, adjustable height" },
  { id: 7, name: "Webcam 1080p",        price: 3499, stock: 18, emoji: "📷", desc: "Auto-focus, privacy shutter" },
  { id: 8, name: "Desk Mat XXL",        price: 1299, stock: 40, emoji: "🟩", desc: "90x40cm stitched edges" },
];

app.get("/health", (_req, res) =>
  res.json({ service: "product-service", status: "ok", products: products.length })
);

app.get("/products", (_req, res) => res.json(products));

app.get("/products/:id", (req, res) => {
  const p = products.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: "Product not found" });
  res.json(p);
});

/**
 * Reserve stock for an order (called by order-service).
 * Body: { items: [{ productId, qty }] }
 * All-or-nothing: fails if any item lacks stock.
 */
app.post("/products/reserve", (req, res) => {
  const items = req.body?.items || [];
  for (const it of items) {
    const p = products.find((x) => x.id === it.productId);
    if (!p) return res.status(404).json({ error: `Product ${it.productId} not found` });
    if (p.stock < it.qty)
      return res.status(409).json({ error: `Not enough stock for "${p.name}" (have ${p.stock}, need ${it.qty})` });
  }
  for (const it of items) {
    products.find((x) => x.id === it.productId).stock -= it.qty;
  }
  res.json({ reserved: true });
});

app.listen(PORT, () => console.log(`[product-service] listening on ${PORT}`));
