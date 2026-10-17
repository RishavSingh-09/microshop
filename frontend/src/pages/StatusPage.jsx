import React, { useEffect, useState } from "react";
import { api, GATEWAY } from "../api.js";

/**
 * The page built for YOUR docker/k8s experiments:
 * polls the gateway's /api/status, which fans out a health check
 * to every microservice. Stop a container / delete a pod and
 * watch its tile flip to DOWN within a few seconds.
 */
export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [gatewayDown, setGatewayDown] = useState(false);

  async function poll() {
    try {
      setStatus(await api("/api/status"));
      setGatewayDown(false);
    } catch {
      setGatewayDown(true);
    }
  }
  useEffect(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const services = status ? Object.entries(status.services) : [];

  return (
    <section>
      <div className="page-head">
        <h2>Cluster status</h2>
        <span className="dim">polled every 3s via gateway /api/status · gateway at {GATEWAY}</span>
      </div>

      <div className="grid status-grid">
        <div className={gatewayDown ? "card svc down" : "card svc up"}>
          <div className="row"><h3>gateway</h3><span className={gatewayDown ? "pill bad" : "pill ok"}>{gatewayDown ? "DOWN" : "UP"}</span></div>
          <p className="dim small">Single entry point. If this is down, everything is down.</p>
        </div>
        {services.map(([name, s]) => (
          <div key={name} className={s.up ? "card svc up" : "card svc down"}>
            <div className="row">
              <h3>{name}</h3>
              <span className={s.up ? "pill ok" : "pill bad"}>{s.up ? "UP" : "DOWN"}</span>
            </div>
            <p className="dim small">
              {s.up ? `healthy · ${s.ms}ms` : "unreachable - is the container/pod running?"}
            </p>
          </div>
        ))}
      </div>

      <div className="hint">
        <h3>Things to try once you've containerized this</h3>
        <ul>
          <li>Stop <b>product-service</b> → catalog fails, cart fails, checkout fails (dependency chain).</li>
          <li>Stop <b>auth-service</b> → every protected route returns 401/502, even though other services are healthy.</li>
          <li>Stop <b>notification-service</b> → checkout still succeeds (it's fire-and-forget). Compare with the above!</li>
          <li>Restart <b>auth-service</b> → your login stops working: in-memory state is gone. Now you know why volumes and external stores exist.</li>
          <li>In Kubernetes: scale product-service to 3 replicas and watch requests spread.</li>
        </ul>
      </div>
    </section>
  );
}
