import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// Product images can be either a full URL the admin pasted in, or a relative
// path returned by the upload endpoint (e.g. "/uploads/abc123.jpg"). This
// resolves the latter against the API's origin.
export function resolveImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_ORIGIN}${path}`;
}

/**
 * Creates an axios instance whose Authorization header is read from its own
 * localStorage key. Each portal (customer / admin / delivery) gets its own
 * key so logging into one never overwrites or invalidates another portal's
 * session — including across separate browser tabs on the same origin.
 */
export function makeClient(tokenKey) {
  const instance = axios.create({ baseURL: API_URL });
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem(tokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  return instance;
}

// Default export: the customer-facing client (storefront, checkout, orders).
const client = makeClient("kd_token");
export default client;
