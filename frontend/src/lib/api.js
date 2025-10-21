import axios from "axios";

/**
 * Compute clean API base URL:
 * - Reads from VITE_API_BASE (e.g. http://localhost:8080 or http://localhost:8080/api)
 * - Ensures exactly one /api at the end
 */
const RAW = (import.meta.env.VITE_API_BASE || "http://localhost:8080").replace(/\/+$/, "");
const BASE = RAW.endsWith("/api") ? RAW : `${RAW}/api`;

/**
 * Create a real Axios instance
 */
const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

// Automatically attach Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * ✅ Patient APIs
 */
export const getPatients = (params = {}) => api.get("/patients", { params });
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const createPatient = (data) => api.post("/patients", data);

/**
 * ✅ Visit APIs
 */
export const addVisit = (patientId, data) =>
  api.post(`/patients/${patientId}/visits`, data);

/**
 * ✅ Lab Report APIs (visit-scoped)
 */
export const uploadReport = (patientId, visitId, formData) =>
  api.post(`/patients/${patientId}/visits/${visitId}/reports`, formData);

export const deleteReport = (patientId, visitId, reportId) =>
  api.delete(`/patients/${patientId}/visits/${visitId}/reports/${reportId}`);

/**
 * ✅ Auth APIs
 */
export const signup = (data) => api.post("/auth/signup", data);
export const login = (data) => api.post("/auth/login", data);

/**
 * Export the configured instance as default for flexibility
 */
export default api;
