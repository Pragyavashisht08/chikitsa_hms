// backend/src/routes/report.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import Patient from "../models/Patient.js";

const router = express.Router();

/* ------------------ Setup ------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Always resolves correctly to backend/src/data/reports
const REPORT_DIR = path.join(__dirname, "../data/reports");
fs.mkdirSync(REPORT_DIR, { recursive: true });

console.log("📁 Reports directory:", REPORT_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REPORT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  },
});
const upload = multer({ storage });

/* ------------------ Helpers ------------------ */
async function getVisit(pid, vid) {
  const patient = await Patient.findById(pid);
  if (!patient)
    throw Object.assign(new Error("Patient not found"), { status: 404 });

  const visit = (patient.visits || []).find(
    (v) => String(v._id) === String(vid) || String(v.id) === String(vid)
  );
  if (!visit)
    throw Object.assign(new Error("Visit not found"), { status: 404 });

  return { patient, visit };
}

/* ------------------ Upload Report ------------------ */
router.post(
  "/api/patients/:pid/visits/:vid/reports",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const { pid, vid } = req.params;
      const { patient, visit } = await getVisit(pid, vid);

      if (!req.file)
        throw Object.assign(new Error("No file provided"), { status: 400 });

      const rid = uuid();
      const displayName =
        req.body.name || req.file.originalname || req.file.filename;

      const report = {
        _id: rid,
        name: displayName,
        storedName: req.file.filename,
        mime: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
        url: `/api/patients/${pid}/visits/${vid}/reports/${rid}/download`,
      };

      visit.reports = visit.reports || [];
      visit.reports.push(report);
      await patient.save();

      res.json(patient);
    } catch (e) {
      next(e);
    }
  }
);

/* ------------------ Download Report ------------------ */
router.get(
  "/api/patients/:pid/visits/:vid/reports/:rid/download",
  async (req, res, next) => {
    try {
      const { pid, vid, rid } = req.params;
      const { visit } = await getVisit(pid, vid);
      const r = (visit.reports || []).find(
        (x) => String(x._id) === String(rid) || String(x.id) === String(rid)
      );
      if (!r)
        throw Object.assign(new Error("Report not found"), { status: 404 });

      const fp = path.join(REPORT_DIR, r.storedName);
      if (!fs.existsSync(fp))
        throw Object.assign(new Error("File missing on disk"), { status: 404 });

      res.setHeader("Content-Type", r.mime || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(r.name || r.storedName)}"`
      );
      fs.createReadStream(fp).pipe(res);
    } catch (e) {
      next(e);
    }
  }
);

/* ------------------ Delete Report ------------------ */
router.delete(
  "/api/patients/:pid/visits/:vid/reports/:rid",
  async (req, res, next) => {
    try {
      const { pid, vid, rid } = req.params;
      const { patient, visit } = await getVisit(pid, vid);

      visit.reports = visit.reports || [];
      const idx = visit.reports.findIndex(
        (x) => String(x._id) === String(rid) || String(x.id) === String(rid)
      );
      if (idx === -1)
        throw Object.assign(new Error("Report not found"), { status: 404 });

      const [r] = visit.reports.splice(idx, 1);
      await patient.save();

      try {
        fs.unlinkSync(path.join(REPORT_DIR, r.storedName));
      } catch {
        // ignore if file already deleted
      }

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
