import express from "express";
import Suggestion from "../models/Suggestion.js";

const router = express.Router();

/**
 * GET /api/suggestions?type=SYMPTOM&startsWith=CO
 * Returns up to 10 matching suggestions
 */
router.get("/", async (req, res) => {
  try {
    const { type, startsWith = "" } = req.query;
    if (!["SYMPTOM", "MEDICINE"].includes(type)) {
      return res.status(400).json({ message: "type must be SYMPTOM or MEDICINE" });
    }

    const rx = new RegExp(
      "^" + String(startsWith).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    const rows = await Suggestion.find({ type, text: rx })
      .sort({ count: -1, text: 1 })
      .limit(10);

    res.json(rows.map((r) => r.text));
  } catch (err) {
    console.error("GET /api/suggestions error:", err);
    res.status(500).json({ message: "Failed to fetch suggestions" });
  }
});

/**
 * POST /api/suggestions
 * Body: { type: "SYMPTOM", text: "Cough" }
 * Creates or increments the count for that suggestion
 */
router.post("/", async (req, res) => {
  try {
    let { type, text } = req.body;
    if (!["SYMPTOM", "MEDICINE"].includes(type) || !text) {
      return res.status(400).json({ message: "type and text are required" });
    }

    text = String(text).trim().toUpperCase();
    if (!text) return res.status(400).json({ message: "Empty text" });

    const doc = await Suggestion.findOneAndUpdate(
      { type, text },
      { $inc: { count: 1 }, $setOnInsert: { type, text } },
      { upsert: true, new: true }
    );

    res.json(doc);
  } catch (err) {
    console.error("POST /api/suggestions error:", err);
    res.status(500).json({ message: "Failed to save suggestion" });
  }
});

/**
 * POST /api/suggestions/bulk
 * Body: { type: "SYMPTOM", items: ["Fever", "Cold", "Cough"] }
 * Efficiently upserts multiple at once
 */
router.post("/bulk", async (req, res) => {
  try {
    const { type, items } = req.body;
    if (!["SYMPTOM", "MEDICINE"].includes(type) || !Array.isArray(items)) {
      return res.status(400).json({ message: "type and items[] are required" });
    }

    const cleaned = items
      .map((t) => String(t || "").trim().toUpperCase())
      .filter(Boolean);

    if (!cleaned.length) return res.json({ upserted: 0 });

    const ops = cleaned.map((text) => ({
      updateOne: {
        filter: { type, text },
        update: { $inc: { count: 1 }, $setOnInsert: { type, text } },
        upsert: true,
      },
    }));

    const result = await Suggestion.bulkWrite(ops, { ordered: false });
    res.json({ upserted: result.upsertedCount || 0, modified: result.modifiedCount || 0 });
  } catch (err) {
    console.error("POST /api/suggestions/bulk error:", err);
    res.status(500).json({ message: "Bulk save failed" });
  }
});

export default router;
