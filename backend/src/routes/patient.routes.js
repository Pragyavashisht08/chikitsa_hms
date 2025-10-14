import express from "express";
import path from "path";
import multer from "multer";
import Patient from "../models/Patient.js";
import Suggestion from "../models/Suggestion.js";

const router = express.Router();

// ------ upload setup ------
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, path.join(process.cwd(), "backend", "uploads")),
    filename:   (_, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g,"_"))
  })
});

/** CREATE PATIENT */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const phone = String(body.phone || "").replace(/\D+/g, "");
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: "Phone must be exactly 10 digits" });
    }
    const patient = await Patient.create({ name: body.name, phone });
    res.status(201).json(patient);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

/** LIST + SEARCH (q/from/to) */
router.get("/", async (req, res) => {
  try {
    const { q, from, to } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [{ name: rx }, { phone: rx }, { uniqueId: rx }];
    }
    if (from || to) {
      filter.registeredAt = {};
      if (from) filter.registeredAt.$gte = new Date(from);
      if (to)   filter.registeredAt.$lte = new Date(to);
    }
    const patients = await Patient.find(filter).sort({ registeredAt: -1 }).limit(500);
    res.json(patients);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/** ADD A VISIT (frontdesk+doctor fields allowed) */
router.post("/:id/visits", async (req, res) => {
  try {
    const { id } = req.params;
    const v = req.body || {};
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: "Patient not found" });

    const visit = {
      date: v.date || new Date(),
      symptoms: v.symptoms || "",
      bp: {
        systolic: v?.bp?.systolic != null ? Number(v.bp.systolic) : undefined,
        diastolic: v?.bp?.diastolic != null ? Number(v.bp.diastolic) : undefined
      },
      payment: {
        amount: v?.payment?.amount != null ? Number(v.payment.amount) : undefined,
        mode: v?.payment?.mode || "CASH",
        status: v?.payment?.status || "PENDING"
      },
      notes: v.notes || "",

      // doctor fields
      diagnosis: v.diagnosis || "",
      tests: Array.isArray(v.tests) ? v.tests.filter(Boolean).map(String)
            : (v.tests ? String(v.tests).split(",").map(s=>s.trim()).filter(Boolean) : []),
      medicines: Array.isArray(v.medicines) ? v.medicines.filter(Boolean).map(String)
               : (v.medicines ? String(v.medicines).split(",").map(s=>s.trim()).filter(Boolean) : []),
      advice: v.advice || ""
    };

    p.visits.push(visit);
    await p.save();

    // upsert suggestions
    const upserts = [];
    if (visit.symptoms) {
      visit.symptoms.split(",").map(s=>s.trim()).filter(Boolean)
        .forEach(t => upserts.push({ type:"SYMPTOM", text: t.toUpperCase() }));
    }
    (visit.medicines || []).forEach(m =>
      upserts.push({ type:"MEDICINE", text: String(m).toUpperCase() })
    );
    await Promise.all(
      upserts.map(s =>
        Suggestion.updateOne({ type:s.type, text:s.text }, { $inc:{ count:1 } }, { upsert:true })
      )
    );

    res.status(201).json(p);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

/** LIST VISITS (latest first) */
router.get("/:id/visits", async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Patient.findById(id).lean();
    if (!p) return res.status(404).json({ message: "Patient not found" });
    const visits = [...(p.visits || [])].sort((a,b)=> new Date(b.date) - new Date(a.date));
    res.json({ patientId:id, uniqueId:p.uniqueId, name:p.name, visits });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/** REPORT UPLOAD + LIST */
router.post("/:id/visits/:vid/reports", upload.single("file"), async (req,res)=>{
  try {
    const { id, vid } = req.params;
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message:"Patient not found" });

    const v = p.visits.id(vid) || p.visits.find(x => String(x._id) === vid);
    if (!v) return res.status(404).json({ message:"Visit not found" });

    v.reports = v.reports || [];
    v.reports.push({ url:`/uploads/${req.file.filename}`, name:req.file.originalname });
    await p.save();
    res.status(201).json(v.reports);
  } catch (e) {
    res.status(400).json({ message:e.message });
  }
});

router.get("/:id/visits/:vid/reports", async (req,res)=>{
  const { id, vid } = req.params;
  const p = await Patient.findById(id).lean();
  if (!p) return res.status(404).json({ message:"Patient not found" });
  const v = (p.visits||[]).find(x => String(x._id) === vid);
  if (!v) return res.status(404).json({ message:"Visit not found" });
  res.json(v.reports || []);
});

export default router;
