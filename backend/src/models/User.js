import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // hashed via bcrypt
    role: { type: String, enum: ["ADMIN", "DOCTOR", "FRONTDESK"], required: true }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
