import React, { useEffect, useState } from "react";
import { api, rupees } from "../api.js";

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/orders").then(setOrders).catch((e) => { setError(e.message); setOrders([]); });
  }, []);

  return (
    <section>
      <div className="page-head">
        <h2>Order history</h2>
        <span className="dim">served by order-service</span>
      </div>
      {error && <p className="error">{error}</p>}
      {!orders && <p className="dim">Loading orders…</p>}
      {orders?.length === 0 && !error && <p className="dim">No orders yet.</p>}
      {orders?.map((o) => (
        <div key={o.id} className="order">
          <div className="row">
            <b>Order #{o.id}</b>
            <span className="pill ok">{o.status}</span>
            <span className="dim">{new Date(o.placedAt).toLocaleString()}</span>
            <span className="grow" />
            <span className="price">{rupees(o.total)}</span>
          </div>
          <div className="dim small">
            {o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}
          </div>
        </div>
      ))}
    </section>
  );
}
