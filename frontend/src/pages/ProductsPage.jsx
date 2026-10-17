import React, { useEffect, useState } from "react";
import { api, rupees } from "../api.js";

export default function ProductsPage({ onCartChange }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null);

  async function load() {
    setError("");
    try { setProducts(await api("/api/products")); }
    catch (e) { setError(e.message); setProducts([]); }
  }
  useEffect(() => { load(); }, []);

  async function addToCart(p) {
    try {
      await api("/api/cart/items", { method: "POST", body: { productId: p.id, qty: 1 } });
      setAdded(p.id);
      setTimeout(() => setAdded(null), 1200);
      onCartChange();
    } catch (e) { setError(e.message); }
  }

  return (
    <section>
      <div className="page-head">
        <h2>Catalog</h2>
        <span className="dim">served by product-service · add-to-cart goes through cart-service</span>
      </div>
      {error && <p className="error">{error}</p>}
      {!products && <p className="dim">Loading catalog…</p>}
      <div className="grid">
        {products?.map((p) => (
          <div key={p.id} className="card">
            <div className="emoji">{p.emoji}</div>
            <h3>{p.name}</h3>
            <p className="dim">{p.desc}</p>
            <div className="row">
              <span className="price">{rupees(p.price)}</span>
              <span className={p.stock < 5 ? "stock low" : "stock"}>{p.stock} in stock</span>
            </div>
            <button className="primary" disabled={p.stock === 0} onClick={() => addToCart(p)}>
              {added === p.id ? "Added ✓" : p.stock === 0 ? "Out of stock" : "Add to cart"}
            </button>
          </div>
        ))}
      </div>
      {products && <button className="ghost" onClick={load}>↻ Refresh stock</button>}
    </section>
  );
}
