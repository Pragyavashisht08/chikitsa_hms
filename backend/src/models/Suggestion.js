import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["SYMPTOM", "MEDICINE"],
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // ensure consistent casing
      index: true,
    },
    count: {
      type: Number,
      default: 1,
      min: 1, // helps avoid negatives
    },
  },
  { timestamps: true }
);

// prevent duplicates of same type/text pair
suggestionSchema.index({ type: 1, text: 1 }, { unique: true });

export default mongoose.model("Suggestion", suggestionSchema);
