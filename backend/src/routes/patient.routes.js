import express from "express";
import Patient from "../models/Patient.js";
const router = express.Router();

// Create patient
router.post("/", async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// List patients (basic search by q=name/phone/id)
router.get("/", async (req, res) => {
  const { q } = req.query;
  const filter = q
    ? {
        $or: [
          { name: new RegExp(q, "i") },
          { phone: new RegExp(q, "i") },
          { uniqueId: new RegExp(q, "i") }
        ]
      }
    : {};
  const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(patients);
});

// Add a visit to a patient
router.post("/:id/visits", async (req, res) => {
  const { id } = req.params;
  const p = await Patient.findById(id);
  if (!p) return res.status(404).json({ message: "Patient not found" });
  p.visits.push(req.body || {});
  await p.save();
  res.status(201).json(p);
});

export default router;
