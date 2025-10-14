import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login(){
  const nav = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email:"", password:"" });
  const [err, setErr] = useState("");

  const submit = async (e)=>{
    e.preventDefault();
    try {
      await login((form.email || "").toLowerCase(), form.password);
      nav("/");
    } catch(e){
      setErr(e?.response?.data?.message || "Login failed");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="card max-w-xl mx-auto">
        <h1 className="text-2xl font-extrabold text-brand-dark mb-4">Login</h1>
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <form onSubmit={submit} className="space-y-3">
          {/* EMAIL: keep lowercase */}
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

          <button className="btn btn-primary w-full">Login</button>
        </form>

        <p className="text-sm mt-3">
          No account? <Link to="/signup" className="text-brand-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
