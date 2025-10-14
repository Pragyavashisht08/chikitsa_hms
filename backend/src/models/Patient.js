import mongoose from "mongoose";

const visitSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },

    // FRONTDESK
    symptoms: String,
    bp: { systolic: Number, diastolic: Number },
    payment: {
      amount: Number,
      mode: { type: String, enum: ["CASH","UPI","CARD","OTHER"], default: "CASH" },
      status:{ type: String, enum: ["PENDING","PAID"], default: "PENDING" }
    },
    notes: String,

    // DOCTOR
    diagnosis: String,
    tests: [String],
    medicines: [String],
    advice: String,

    // OPTIONAL: uploaded report links
    reports: [{ url: String, name: String }]
  },
  { _id: true } // keep visit _id for report upload route
);

function makeId(name, phone){
  const N = (name||"").replace(/\s+/g,"").toUpperCase();
  const P = (phone||"").replace(/\D+/g,"");
  return N && P ? `${N}_${P}` : undefined;
}

const patientSchema = new mongoose.Schema(
  {
    uniqueId: { type:String, unique:true, index:true },
    name:     { type:String, required:true },
    phone:    { type:String, required:true },
    registeredAt: { type:Date, default:Date.now },
    visits:   [visitSchema]
  },
  { timestamps:true }
);

patientSchema.pre("save", function(next){
  this.name  = (this.name||"").toUpperCase();
  this.phone = (this.phone||"").replace(/\D+/g,"");
  this.uniqueId = (this.uniqueId && String(this.uniqueId).toUpperCase()) || makeId(this.name, this.phone);
  next();
});

export default mongoose.model("Patient", patientSchema);
