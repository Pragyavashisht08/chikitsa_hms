// backend/src/routes/patient.routes.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import Patient from "../models/Patient.js";
import Suggestion from "../models/Suggestion.js";

const router = express.Router();

/* ---------- ESM __dirname ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- UPLOAD DIRECTORY (shared with report.routes.js) ---------- */
const uploadDir = path.join(__dirname, "../data/reports");
fs.mkdirSync(uploadDir, { recursive: true });

/* ---------- MULTER: expect a single field named "file" ---------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

/**
 * ✅ CREATE PATIENT
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, uniqueId } = req.body || {};
    if (!name || !phone)
      return res.status(400).json({ message: "Name and phone are required" });

    const cleanPhone = String(phone).replace(/\D+/g, "");
    if (!/^\d{10}$/.test(cleanPhone))
      return res.status(400).json({ message: "Phone must be exactly 10 digits" });

    const patient = await Patient.create({
      name: name.trim(),
      phone: cleanPhone,
      uniqueId: uniqueId || `${name.trim().replace(/\s+/g, "_")}_${cleanPhone}`,
    });

    res.status(201).json(patient);
  } catch (e) {
    console.error("❌ Error creating patient:", e);
    res.status(400).json({ message: e.message });
  }
});

/**
 * ✅ LIST + SEARCH (supports ?q=, ?from=, ?to=)
 */
router.get("/", async (req, res) => {
  try {
    const { q, from, to } = req.query;
    const filter = {};

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ name: regex }, { phone: regex }, { uniqueId: regex }];
    }

    if (from || to) {
      filter.registeredAt = {};
      if (from) filter.registeredAt.$gte = new Date(from);
      if (to) filter.registeredAt.$lte = new Date(to);
    }

    const patients = await Patient.find(filter)
      .sort({ registeredAt: -1 })
      .limit(500)
      .lean();

    res.json(patients);
  } catch (e) {
    console.error("❌ Error fetching patients:", e);
    res.status(500).json({ message: e.message });
  }
});

/**
 * ✅ ADD A VISIT (doctor or frontdesk)
 */
router.post("/:id/visits", async (req, res) => {
  try {
    const { id } = req.params;
    const v = req.body || {};

    const patient = await Patient.findById(id);
    if (!patient)
      return res.status(404).json({ message: "Patient not found" });

    const visit = {
      date: v.date || new Date(),
      symptoms: v.symptoms || "",
      bp: {
        systolic: v?.bp?.systolic ? Number(v.bp.systolic) : undefined,
        diastolic: v?.bp?.diastolic ? Number(v.bp.diastolic) : undefined,
      },
      payment: {
        amount: v?.payment?.amount ? Number(v.payment.amount) : undefined,
        mode: v?.payment?.mode || "CASH",
        status: v?.payment?.status || "PENDING",
      },
      notes: v.notes || "",
      diagnosis: v.diagnosis || "",
      tests: Array.isArray(v.tests)
        ? v.tests.filter(Boolean).map(String)
        : v.tests
        ? String(v.tests)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      medicines: Array.isArray(v.medicines)
        ? v.medicines.filter(Boolean).map(String)
        : v.medicines
        ? String(v.medicines)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      advice: v.advice || "",
      vitals: v.vitals || {},
    };

    patient.visits.push(visit);
    await patient.save();

    // suggestions upsert
    const upserts = [];
    if (visit.symptoms) {
      visit.symptoms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => upserts.push({ type: "SYMPTOM", text: t.toUpperCase() }));
    }
    (visit.medicines || []).forEach((m) =>
      upserts.push({ type: "MEDICINE", text: String(m).toUpperCase() })
    );
    await Promise.all(
      upserts.map((s) =>
        Suggestion.updateOne(
          { type: s.type, text: s.text },
          { $inc: { count: 1 } },
          { upsert: true }
        )
      )
    );

    res.status(201).json(patient);
  } catch (e) {
    console.error("❌ Error adding visit:", e);
    res.status(400).json({ message: e.message });
  }
});

/**
 * ✅ LIST VISITS (latest first)
 */
router.get("/:id/visits", async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id).lean();
    if (!patient)
      return res.status(404).json({ message: "Patient not found" });

    const visits = [...(patient.visits || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    res.json({
      patientId: id,
      uniqueId: patient.uniqueId,
      name: patient.name,
      visits,
    });
  } catch (e) {
    console.error("❌ Error listing visits:", e);
    res.status(500).json({ message: e.message });
  }
});

/**
 * ✅ REPORT UPLOAD (linked to visit) — expects FormData key "file"
 * Saves metadata so the /download route in report.routes.js can stream the file.
 */
router.post("/:id/visits/:vid/reports", upload.single("file"), async (req, res) => {
  try {
    const { id, vid } = req.params;
    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const visit =
      patient.visits.id(vid) ||
      patient.visits.find((x) => String(x._id) === vid);
    if (!visit) return res.status(404).json({ message: "Visit not found" });

    if (!req.file) return res.status(400).json({ message: "No file provided" });

    visit.reports = visit.reports || [];
    visit.reports.push({
      name: req.file.originalname,
      storedName: req.file.filename,
      mime: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });

    const saved = visit.reports[visit.reports.length - 1];
    saved.url = `/api/patients/${id}/visits/${vid}/reports/${saved._id}/download`;

    await patient.save();
    res.status(201).json(visit.reports);
  } catch (e) {
    console.error("❌ Error uploading report:", e);
    res.status(400).json({ message: e.message || "Upload failed" });
  }
});

/**
 * ✅ LIST REPORTS FOR A VISIT
 */
router.get("/:id/visits/:vid/reports", async (req, res) => {
  try {
    const { id, vid } = req.params;
    const patient = await Patient.findById(id).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const visit = (patient.visits || []).find((x) => String(x._id) === vid);
    if (!visit) return res.status(404).json({ message: "Visit not found" });

    res.json(visit.reports || []);
  } catch (e) {
    console.error("❌ Error fetching reports:", e);
    res.status(500).json({ message: e.message });
  }
});

export default router;
