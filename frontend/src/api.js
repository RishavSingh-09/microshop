// Single place where the frontend knows about the outside world.
// Everything goes through the gateway - the browser never talks
// to individual microservices directly.
export const GATEWAY = import.meta.env.VITE_GATEWAY_URL || "http://localhost:8080";

export function getToken() { return localStorage.getItem("microshop_token"); }
export function setSession(token, user) {
  localStorage.setItem("microshop_token", token);
  localStorage.setItem("microshop_user", JSON.stringify(user));
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem("microshop_user")); } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem("microshop_token");
  localStorage.removeItem("microshop_user");
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the API gateway. Is it running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const rupees = (paise) => `₹${(paise / 100).toFixed(2)}`;
