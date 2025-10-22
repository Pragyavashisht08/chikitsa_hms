// backend/src/models/Patient.js
import mongoose from "mongoose";

// Report sub-schema for uploaded documents
const reportSchema = new mongoose.Schema(
  {
    url: String,         // API download URL (e.g., /api/patients/:pid/visits/:vid/reports/:rid/download)
    name: String,        // Display name shown in UI
    storedName: String,  // Actual filename stored on disk
    mime: String,        // MIME type
    size: Number,        // File size in bytes
    uploadedAt: Date     // Timestamp
  },
  { _id: true } // Keep each report's own ID for routes
);

// Visit sub-schema
const visitSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },

    // FRONTDESK
    symptoms: String,
    bp: { systolic: Number, diastolic: Number },
    payment: {
      amount: Number,
      mode: {
        type: String,
        enum: ["CASH", "UPI", "CARD", "OTHER"],
        default: "CASH",
      },
      status: {
        type: String,
        enum: ["PENDING", "PAID"],
        default: "PENDING",
      },
    },
    notes: String,

    // DOCTOR
    diagnosis: String,
    tests: [String],
    medicines: [String],
    advice: String,

    // REPORTS & DOCUMENTS (uploads)
    reports: [reportSchema],
  },
  { _id: true } // Keep visit _id for report upload routes
);

// Helper for generating patient uniqueId
function makeId(name, phone) {
  const N = (name || "").replace(/\s+/g, "").toUpperCase();
  const P = (phone || "").replace(/\D+/g, "");
  return N && P ? `${N}_${P}` : undefined;
}

// Patient schema
const patientSchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
    visits: [visitSchema],
  },
  { timestamps: true }
);

// Pre-save hook to standardize ID
patientSchema.pre("save", function (next) {
  this.name = (this.name || "").toUpperCase();
  this.phone = (this.phone || "").replace(/\D+/g, "");
  this.uniqueId =
    (this.uniqueId && String(this.uniqueId).toUpperCase()) ||
    makeId(this.name, this.phone);
  next();
});

export default mongoose.model("Patient", patientSchema);
