// backend/src/server.js
import fs from "fs";                    // ✅ added
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import suggestionRoutes from "./routes/suggestion.routes.js";
import reportRoutes from "./routes/report.routes.js"; // ✅ reports upload/view/delete

// ----- ESM __dirname / __filename -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Load .env -----
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// ----- Initialize Express App -----
const app = express();

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------- STATIC: keep old /uploads URLs working ---------- */
// Map /uploads/* to where reports are actually saved:
// backend/src/data/reports
const REPORT_DIR = path.join(__dirname, "data", "reports");
fs.mkdirSync(REPORT_DIR, { recursive: true });
app.use("/uploads", express.static(REPORT_DIR)); // ✅ key line

// ----- Health Check -----
app.get("/health", (_req, res) =>
  res.json({ ok: true, message: "Server running", ts: new Date() })
);

// ----- Database Connection -----
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    dbName: "hospitalDB",
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err?.message || err);
    process.exit(1);
  });

// ----- Routes -----
app.get("/", (_req, res) => res.send("CHIKITSA API is running ✅"));
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/suggestions", suggestionRoutes);
app.use(reportRoutes); // mounts /api/patients/:pid/visits/:vid/reports[...]

// ----- Global Error Handler -----
app.use((err, _req, res, _next) => {
  console.error("❌ Error:", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 CORS Origin: ${ORIGIN}`);
  console.log(`📁 Serving /uploads from: ${REPORT_DIR}`); // helpful log
});
