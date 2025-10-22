// src/lib/api.js
import axios from "axios";

/**
 * Compute clean API base URL:
 * - Reads from VITE_API_BASE (e.g. http://localhost:5000 or http://localhost:5000/api)
 * - Ensures exactly one /api at the end
 */
const RAW = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/+$/, "");
const BASE = RAW.endsWith("/api") ? RAW : `${RAW}/api`;

/**
 * Create Axios instance
 * NOTE: Do NOT set a global Content-Type header; it breaks FormData uploads.
 */
const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

/** Attach Bearer token if present */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // If the request body is FormData, let the browser set the multipart boundary.
  if (config.data instanceof FormData) {
    // axios sometimes inherits a default header; remove it explicitly
    if (config.headers && "Content-Type" in config.headers) {
      delete config.headers["Content-Type"];
    }
  }

  return config;
});

/* ---------------- Patient APIs ---------------- */
export const getPatients = (params = {}) => api.get("/patients", { params });
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const createPatient = (data) => api.post("/patients", data);

/* ---------------- Visit APIs ---------------- */
export const addVisit = (patientId, data) =>
  api.post(`/patients/${patientId}/visits`, data);

/* ---------------- Report APIs ---------------- */
export const uploadReport = (patientId, visitId, formData) =>
  api.post(`/patients/${patientId}/visits/${visitId}/reports`, formData); // no manual headers

export const deleteReport = (patientId, visitId, reportId) =>
  api.delete(`/patients/${patientId}/visits/${visitId}/reports/${reportId}`);

/* ---------------- Suggestions APIs ---------------- */
export const getSuggestions = (type, startsWith = "") =>
  api.get("/suggestions", { params: { type, startsWith } });

export const addSuggestionsBulk = (items = []) =>
  api.post("/suggestions/bulk", { items });

/* ---------------- Auth APIs ---------------- */
export const signup = (data) => api.post("/auth/signup", data);
export const login = (data) => api.post("/auth/login", data);

/* Default export */
export default api;
