import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Signup(){ const nav = useNavigate(); const { signup } = useAuth();
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"FRONTDESK" }); const [err, setErr] = useState("");
  const submit = async (e)=>{ e.preventDefault(); try{ await signup(form); nav("/"); }catch(e){ setErr(e?.response?.data?.message || "Signup failed"); } };
  return (<div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl shadow">
    <h1 className="text-2xl font-bold mb-4">Create account</h1>
    {err && <p className="text-red-600 mb-3">{err}</p>}
    <form onSubmit={submit} className="space-y-3">
      <input className="w-full border p-2 rounded" placeholder="Full name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
      <input className="w-full border p-2 rounded" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
      <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
      <select className="w-full border p-2 rounded" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
        <option value="FRONTDESK">Frontdesk</option><option value="DOCTOR">Doctor</option><option value="ADMIN">Admin</option>
      </select>
      <button className="w-full bg-brand-orange text-white py-2 rounded">Sign up</button>
    </form>
    <p className="text-sm mt-3">Already have an account? <Link to="/login" className="text-brand-orange">Login</Link></p>
  </div>); }
