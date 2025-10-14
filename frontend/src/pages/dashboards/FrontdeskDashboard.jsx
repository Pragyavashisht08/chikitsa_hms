import { useEffect, useState } from "react";
import { api } from "../../lib/api";
export default function FrontdeskDashboard(){ const [list,setList]=useState([]); const [q,setQ]=useState(""); const [form,setForm]=useState({ uniqueId:"", name:"", phone:"" });
  const load = async ()=>{ const { data } = await api.get("/patients", { params:{ q } }); setList(data); };
  const add = async (e)=>{ e.preventDefault(); await api.post("/patients", form); setForm({ uniqueId:"", name:"", phone:"" }); await load(); };
  useEffect(()=>{ load(); },[]);
  return (<div className="p-6 space-y-6"><h1 className="text-2xl font-bold">Frontdesk</h1>
    <form onSubmit={add} className="flex gap-2 items-end flex-wrap">
      <div><label className="block text-sm">Unique ID</label><input className="border p-2 rounded" value={form.uniqueId} onChange={e=>setForm({...form,uniqueId:e.target.value})} required/></div>
      <div><label className="block text-sm">Name</label><input className="border p-2 rounded" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
      <div><label className="block text-sm">Phone</label><input className="border p-2 rounded" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
      <button className="bg-brand-orange text-white px-4 py-2 rounded">Add Patient</button>
    </form>
    <div className="flex gap-2"><input className="border p-2 rounded" placeholder="Search (name/phone/id)" value={q} onChange={e=>setQ(e.target.value)}/><button onClick={load} className="bg-black text-white px-4 rounded">Search</button></div>
    <table className="w-full border text-sm"><thead className="bg-gray-100"><tr><th className="p-2 border">Unique ID</th><th className="p-2 border">Name</th><th className="p-2 border">Phone</th><th className="p-2 border">Registered</th></tr></thead><tbody>{list.map(p=> (<tr key={p.id||p._id}><td className="p-2 border">{p.uniqueId}</td><td className="p-2 border">{p.name}</td><td className="p-2 border">{p.phone}</td><td className="p-2 border">{new Date(p.registeredAt).toLocaleString()}</td></tr>))}</tbody></table>
  </div>); }
