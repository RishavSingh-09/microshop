/**
 * NOTIFICATION SERVICE
 * --------------------
 * Stores per-user in-app notifications. order-service pushes events
 * here; the frontend polls the feed through the gateway.
 *
 * Env vars:
 *   PORT (default 3005)
 */
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3005;
const feed = new Map(); // userId -> [{ id, type, message, at, read }]
let nextId = 1;

app.get("/health", (_req, res) =>
  res.json({ service: "notification-service", status: "ok", users: feed.size })
);

app.get("/notifications/:userId", (req, res) => {
  res.json(feed.get(String(req.params.userId)) || []);
});

app.post("/notifications/:userId", (req, res) => {
  const { type = "INFO", message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });
  const userId = String(req.params.userId);
  const item = { id: nextId++, type, message, at: new Date().toISOString(), read: false };
  feed.set(userId, [item, ...(feed.get(userId) || [])]);
  res.status(201).json(item);
});

app.post("/notifications/:userId/read", (req, res) => {
  const list = feed.get(String(req.params.userId)) || [];
  list.forEach((n) => (n.read = true));
  res.json({ marked: list.length });
});

app.listen(PORT, () => console.log(`[notification-service] listening on ${PORT}`));
