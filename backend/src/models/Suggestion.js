import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["SYMPTOM","MEDICINE"], index: true, required: true },
  text: { type: String, required: true, index: true },
  count: { type: Number, default: 1 }
}, { timestamps: true });

suggestionSchema.index({ type: 1, text: 1 }, { unique: true });

export default mongoose.model("Suggestion", suggestionSchema);
