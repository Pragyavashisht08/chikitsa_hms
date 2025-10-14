import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup(){
  const nav = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"FRONTDESK" });
  const [err, setErr] = useState("");

  const submit = async (e)=>{
    e.preventDefault();
    try {
      await signup({
        ...form,
        name:  (form.name  || "").toUpperCase(),
        email: (form.email || "").toLowerCase(),
      });
      nav("/");
    } catch(e){
      setErr(e?.response?.data?.message || "Signup failed");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="card max-w-xl mx-auto">
        <h1 className="text-2xl font-extrabold text-brand-dark mb-4">Create account</h1>
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <form onSubmit={submit} className="space-y-3">
          {/* NAME: type/display in caps, store in caps */}
          <input
            className="input"
            placeholder="FULL NAME"
            value={form.name}
            onChange={e=>setForm({...form, name: e.target.value.toUpperCase()})}
          />

          {/* EMAIL: always lowercase */}
          <input
            className="input email-input"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={e=>setForm({...form, email: e.target.value.toLowerCase()})}
          />

          <input
            className="input"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={e=>setForm({...form, password:e.target.value})}
          />

          <select
            className="input"
            value={form.role}
            onChange={e=>setForm({...form, role:e.target.value})}
          >
            <option value="FRONTDESK">Frontdesk</option>
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Admin</option>
          </select>

          <button className="btn btn-primary w-full">Sign up</button>
        </form>

        <p className="text-sm mt-3">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-primary hover:underline">Login</Link>
        </p>
      </div>
    </main>
  );
}
