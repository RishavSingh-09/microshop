import React, { useEffect, useState } from "react";
import { api, getUser, clearSession } from "./api.js";
import AuthPage from "./pages/AuthPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import StatusPage from "./pages/StatusPage.jsx";

const TABS = [
  { id: "products", label: "Shop" },
  { id: "cart", label: "Cart" },
  { id: "orders", label: "Orders" },
  { id: "status", label: "Cluster Status" },
];

export default function App() {
  const [user, setUser] = useState(getUser());
  const [tab, setTab] = useState("products");
  const [cartCount, setCartCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const unread = notifs.filter((n) => !n.read).length;

  async function refreshBadges() {
    if (!getUser()) return;
    try {
      const cart = await api("/api/cart");
      setCartCount(cart.items.reduce((s, i) => s + i.qty, 0));
    } catch { /* cart-service might be down - badge just stays stale */ }
    try {
      setNotifs(await api("/api/notifications"));
    } catch { /* notification-service might be down */ }
  }

  useEffect(() => {
    refreshBadges();
    const t = setInterval(refreshBadges, 5000);
    return () => clearInterval(t);
  }, [user]);

  function logout() {
    clearSession();
    setUser(null);
    setNotifs([]);
    setCartCount(0);
  }

  async function openNotifs() {
    setShowNotifs((v) => !v);
    if (unread) {
      try {
        await api("/api/notifications/read", { method: "POST" });
        setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
      } catch { /* ignore */ }
    }
  }

  if (!user) return <AuthPage onLogin={setUser} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▣</span> MicroShop
          <span className="brand-sub">7 services, 1 app</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "cart" && cartCount > 0 && <span className="badge">{cartCount}</span>}
            </button>
          ))}
        </nav>
        <div className="user-area">
          <button className="bell" onClick={openNotifs} title="Notifications">
            🔔{unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <span className="who">{user.name}</span>
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      {showNotifs && (
        <div className="notif-panel">
          <h3>Notifications <span className="dim">(notification-service)</span></h3>
          {notifs.length === 0 && <p className="dim">Nothing yet. Place an order and order-service will push an event here.</p>}
          {notifs.map((n) => (
            <div key={n.id} className="notif">
              <span className="notif-type">{n.type}</span>
              <p>{n.message}</p>
              <span className="dim">{new Date(n.at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      <main className="content">
        {tab === "products" && <ProductsPage onCartChange={refreshBadges} />}
        {tab === "cart" && <CartPage onCartChange={refreshBadges} onOrdered={() => { refreshBadges(); setTab("orders"); }} />}
        {tab === "orders" && <OrdersPage />}
        {tab === "status" && <StatusPage />}
      </main>

      <footer className="foot">
        browser → <b>frontend</b> → <b>gateway</b> → auth · products · cart · orders · notifications
      </footer>
    </div>
  );
}
