import React, { useEffect, useState } from "react";
import { api, rupees } from "../api.js";

export default function CartPage({ onCartChange, onOrdered }) {
  const [cart, setCart] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try { setCart(await api("/api/cart")); }
    catch (e) { setError(e.message); setCart({ items: [], total: 0 }); }
  }
  useEffect(() => { load(); }, []);

  async function remove(productId) {
    try {
      setCart(await api(`/api/cart/items/${productId}`, { method: "DELETE" }));
      onCartChange();
    } catch (e) { setError(e.message); }
  }

  async function checkout() {
    setBusy(true); setError("");
    try {
      await api("/api/orders/checkout", { method: "POST" });
      onOrdered();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section>
      <div className="page-head">
        <h2>Your cart</h2>
        <span className="dim">cart-service prices every line live from product-service</span>
      </div>
      {error && <p className="error">{error}</p>}
      {!cart && <p className="dim">Loading cart…</p>}
      {cart?.items.length === 0 && <p className="dim">Cart is empty. Grab something from the Shop tab.</p>}
      {cart?.items.map((i) => (
        <div key={i.productId} className="line">
          <span className="emoji sm">{i.emoji}</span>
          <span className="grow">{i.name} <span className="dim">× {i.qty}</span></span>
          <span className="price">{rupees(i.subtotal)}</span>
          <button className="ghost danger" onClick={() => remove(i.productId)}>Remove</button>
        </div>
      ))}
      {cart?.items.length > 0 && (
        <div className="checkout">
          <span className="total">Total {rupees(cart.total)}</span>
          <button className="primary" disabled={busy} onClick={checkout}>
            {busy ? "Orchestrating checkout…" : "Place order"}
          </button>
          <p className="dim small">
            Checkout is the fun part: order-service reads this cart, reserves stock in
            product-service, clears the cart, and pushes an event to notification-service -
            four services in one click. Kill any of them and watch what breaks.
          </p>
        </div>
      )}
    </section>
  );
}
