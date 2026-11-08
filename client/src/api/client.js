import axios from "axios";

const TOKEN_KEY = "sweety_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
});

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((request) => {
  const token = getStoredToken();

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  } else {
    delete request.headers.Authorization;
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";
    const isCredentialRequest = /\/auth\/(login|register)\/?$/.test(requestUrl);

    if (error.response?.status === 401 && !isCredentialRequest) {
      clearStoredToken();
      window.dispatchEvent(new Event("sweety:unauthorized"));
    }

    return Promise.reject(error);
  },
);
