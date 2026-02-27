import axios from "axios";

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:4000/api",
});

// defaults for REST APIs
api.defaults.headers.common["Accept"] = "application/json";
