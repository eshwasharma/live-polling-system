
const TOKEN_KEY = "pulsepoll_token";

// Production backend URL comes from Vercel environment variables.
// Local development continues using the Vite proxy.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Convert relative API paths into the deployed backend URL.
export function getApiUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function apiFetch(url, options = {}) {
  const token = getToken();

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(getApiUrl(url), {
    ...options,
    headers,
    cache: "no-store",
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("pulsepoll:unauthorized"));
  }

  return response;
}
