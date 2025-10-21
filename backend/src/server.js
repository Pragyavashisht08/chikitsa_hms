// backend/src/server.js
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import suggestionRoutes from "./routes/suggestion.routes.js";

// ----- ESM __dirname / __filename -----
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ----- Env -----
dotenv.config();
const PORT      = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
const ORIGIN    = process.env.CORS_ORIGIN || "http://localhost:5173";

// ----- App -----
const app = express();
app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads (make sure backend/uploads exists)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Health
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date() }));

// ----- Mongo -----
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}
mongoose
  .connect(MONGO_URI, { dbName: "hospitalDB" })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err?.message || err);
    process.exit(1);
  });

// ----- Routes -----
app.get("/", (_req, res) => res.send("CHIKITSA API running"));
app.use("/api/auth",        authRoutes);
app.use("/api/patients",    patientRoutes);
app.use("/api/suggestions", suggestionRoutes);

// ----- Start -----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`CORS origin: ${ORIGIN}`);
});
