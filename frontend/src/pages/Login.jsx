import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Login(){ const nav = useNavigate(); const { login } = useAuth();
  const [form, setForm] = useState({ email:"", password:"" }); const [err, setErr] = useState("");
  const submit = async (e)=>{ e.preventDefault(); try{ await login(form.email, form.password); nav("/"); }catch(e){ setErr(e?.response?.data?.message || "Login failed"); } };
  return (<div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-xl shadow">
    <h1 className="text-2xl font-bold mb-4">Login</h1>
    {err && <p className="text-red-600 mb-3">{err}</p>}
    <form onSubmit={submit} className="space-y-3">
      <input className="w-full border p-2 rounded" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
      <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
      <button className="w-full bg-black text-white py-2 rounded">Login</button>
    </form>
    <p className="text-sm mt-3">No account? <Link to="/signup" className="text-brand-orange">Sign up</Link></p>
  </div>); }
