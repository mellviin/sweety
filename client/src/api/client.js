import axios from "axios";

const TOKEN_KEY = "sweety_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
});

export function getStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((request) => {
  const token = getStoredToken();

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  } else if (!request.headers.Authorization) {
    delete request.headers.Authorization;
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";
    if (error.response?.status === 401) {
      const isCredentialRequest = /\/auth\/(login|register)\/?$/.test(requestUrl);
      clearStoredToken();
      window.dispatchEvent(new CustomEvent("sweety:unauthorized", {
        detail: { sessionExpired: !isCredentialRequest },
      }));
    }

    return Promise.reject(error);
  },
);
