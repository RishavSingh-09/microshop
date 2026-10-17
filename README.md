# MicroShop — a microservices playground for Docker Compose & Kubernetes practice

A small e-commerce app deliberately split into **7 independently deployable services**.
There are no Dockerfiles and no manifests in this repo — **writing those is your exercise.**
Every service reads its dependencies from environment variables, so it is ready to be
containerized and wired together however you like.

## Architecture

```
                        browser
                           |
                    [ frontend :3000 ]   React (Vite)
                           |
                    [ gateway  :8080 ]   single API entry point, verifies tokens
                     /    |     |    \        \
        [auth :3001] [product] [cart] [order] [notification]
                       :3002    :3003  :3004     :3005
                                  |      |  \______
                                  |      |         \
                              product  cart+product+notification
```

Runtime dependency chain (this is what makes it a real cluster, not 7 toys):

| Service              | Port | Talks to                                        | If it dies…                                  |
|----------------------|------|--------------------------------------------------|----------------------------------------------|
| frontend             | 3000 | gateway                                          | no UI                                         |
| gateway              | 8080 | all five services                                | everything is unreachable                     |
| auth-service         | 3001 | —                                                | login fails AND every protected route fails (gateway verifies each token here) |
| product-service      | 3002 | —                                                | catalog, cart, and checkout all fail          |
| cart-service         | 3003 | product-service                                  | cart and checkout fail                        |
| order-service        | 3004 | cart-service, product-service, notification-service | checkout and order history fail            |
| notification-service | 3005 | —                                                | bell feed fails; checkout still works (fire-and-forget) — a nice contrast to study |

The frontend has a **Cluster Status** tab that polls `GET /api/status` on the gateway
every 3 seconds; the gateway health-checks each service. Kill a container or delete a
pod and watch its tile flip to DOWN in the UI.

## Environment variables (your Compose/K8s wiring surface)

Every URL defaults to `localhost` so the app also runs bare on one machine. In
containers, override them with your network aliases / Service DNS names.

| Service              | Variable                   | Default                  |
|----------------------|----------------------------|--------------------------|
| all                  | `PORT`                     | see table above          |
| auth-service         | `TOKEN_SECRET`             | `dev-secret`             |
| cart-service         | `PRODUCT_SERVICE_URL`      | `http://localhost:3002`  |
| order-service        | `CART_SERVICE_URL`         | `http://localhost:3003`  |
| order-service        | `PRODUCT_SERVICE_URL`      | `http://localhost:3002`  |
| order-service        | `NOTIFICATION_SERVICE_URL` | `http://localhost:3005`  |
| gateway              | `AUTH_SERVICE_URL`         | `http://localhost:3001`  |
| gateway              | `PRODUCT_SERVICE_URL`      | `http://localhost:3002`  |
| gateway              | `CART_SERVICE_URL`         | `http://localhost:3003`  |
| gateway              | `ORDER_SERVICE_URL`        | `http://localhost:3004`  |
| gateway              | `NOTIFICATION_SERVICE_URL` | `http://localhost:3005`  |
| frontend             | `VITE_GATEWAY_URL`         | `http://localhost:8080`  |

⚠️ `VITE_GATEWAY_URL` is baked in at **build time** (Vite) and it is the gateway
address **as seen from the browser**, not the internal container DNS name. This
distinction ("cluster-internal URL vs browser-facing URL") is one of the most common
beginner traps in Compose and K8s — you'll hit it here on purpose.

## Health checks (useful for `healthcheck:` / liveness probes)

Every backend service exposes `GET /health` and returns JSON with `status: "ok"`.
The gateway additionally exposes `GET /api/status` (aggregated cluster view).

## Running bare-metal first (recommended before containerizing)

Each service is a plain Node app (Node 18+, which has built-in `fetch`):

```bash
# in 6 separate terminals:
cd services/auth-service          && npm install && npm start
cd services/product-service      && npm install && npm start
cd services/cart-service          && npm install && npm start
cd services/order-service         && npm install && npm start
cd services/notification-service  && npm install && npm start
cd gateway                        && npm install && npm start

# terminal 7:
cd frontend && npm install && npm run dev     # http://localhost:3000
```

For a production-style frontend container you'd run `npm run build` and serve
`dist/` with a static server (nginx, `vite preview`, `serve`, …) — your choice,
that's part of the exercise.

## Suggested learning path

1. Run everything bare-metal, click around, watch each terminal's logs during checkout.
2. Write a Dockerfile per service; build and run them on one Docker network,
   overriding the `*_URL` env vars with container names.
3. Convert that to a single `docker-compose.yml` with `depends_on` + healthchecks.
4. Break things on purpose: `docker stop microshop-product-1` and watch the
   Cluster Status tab. Compare stopping notification-service vs product-service.
5. Move to Kubernetes: one Deployment + Service per component, env vars pointing
   at Service DNS names, an Ingress (or NodePort) for gateway and frontend.
6. Add liveness/readiness probes against `/health`, then scale
   product-service to 3 replicas and hammer refresh.
7. Notice that auth users and orders vanish when pods restart — in-memory state
   is intentional, so you feel *why* StatefulSets/volumes/databases exist.

## API quick reference (all through the gateway)

```
POST /api/auth/register        { name, email, password }
POST /api/auth/login           { email, password }        -> { token }
GET  /api/products
GET  /api/status
--- Authorization: Bearer <token> ---
GET    /api/cart
POST   /api/cart/items         { productId, qty }
DELETE /api/cart/items/:productId
POST   /api/orders/checkout
GET    /api/orders
GET    /api/notifications
POST   /api/notifications/read
```
