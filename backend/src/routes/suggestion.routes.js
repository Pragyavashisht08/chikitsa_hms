import express from "express";
import Suggestion from "../models/Suggestion.js";

const router = express.Router();

router.get("/", async (req,res)=>{
  const { type, startsWith = "" } = req.query;
  if (!["SYMPTOM","MEDICINE"].includes(type)) {
    return res.status(400).json({ message:"type must be SYMPTOM or MEDICINE" });
  }
  const rx = new RegExp("^" + String(startsWith).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "i");
  const rows = await Suggestion.find({ type, text: rx }).sort({ count:-1, text:1 }).limit(10);
  res.json(rows.map(r => r.text));
});

export default router;
