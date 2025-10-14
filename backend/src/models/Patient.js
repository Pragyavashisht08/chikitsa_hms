import mongoose from "mongoose";

const visitSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    symptoms: String,
    diagnosis: String,
    tests: [String],
    advice: String
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    uniqueId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: String,
    registeredAt: { type: Date, default: Date.now },
    visits: [visitSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
