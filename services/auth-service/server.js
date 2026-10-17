/**
 * AUTH SERVICE
 * ------------
 * Handles user registration, login, and token verification.
 * Every other service trusts this one: the gateway calls POST /verify
 * on each protected request. If auth-service is down, nothing works.
 *
 * Env vars:
 *   PORT         (default 3001)
 *   TOKEN_SECRET (default "dev-secret" - override in your deployment)
 */
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = process.env.TOKEN_SECRET || "dev-secret";

// In-memory user store (resets on restart - fine for learning)
const users = new Map(); // email -> { id, name, email, passwordHash }
let nextUserId = 1;

const hash = (s) => crypto.createHash("sha256").update(s + SECRET).digest("hex");

// Simple signed token: base64(payload).signature
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- Routes ----

app.get("/health", (_req, res) =>
  res.json({ service: "auth-service", status: "ok", users: users.size })
);

app.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email and password are required" });
  if (users.has(email))
    return res.status(409).json({ error: "An account with this email already exists" });

  const user = { id: nextUserId++, name, email, passwordHash: hash(password) };
  users.set(email, user);

  const token = signToken({
    userId: user.id, name, email, exp: Date.now() + 1000 * 60 * 60 * 8,
  });
  res.status(201).json({ token, user: { id: user.id, name, email } });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = users.get(email);
  if (!user || user.passwordHash !== hash(password || ""))
    return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken({
    userId: user.id, name: user.name, email, exp: Date.now() + 1000 * 60 * 60 * 8,
  });
  res.json({ token, user: { id: user.id, name: user.name, email } });
});

// Called by the gateway on every protected request
app.post("/verify", (req, res) => {
  const payload = verifyToken(req.body?.token);
  if (!payload) return res.status(401).json({ valid: false });
  res.json({ valid: true, user: { id: payload.userId, name: payload.name, email: payload.email } });
});

app.listen(PORT, () => console.log(`[auth-service] listening on ${PORT}`));
