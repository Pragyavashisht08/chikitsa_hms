import { useEffect, useState } from "react";
import { api } from "../../lib/api";
export default function DoctorDashboard(){ const [list,setList]=useState([]); const [active,setActive]=useState(null); const [visit,setVisit]=useState({ symptoms:"", diagnosis:"", tests:"", advice:"" });
  const load = async ()=>{ const { data } = await api.get("/patients"); setList(data); if(active){ const fresh=data.find(p=>(p.id||p._id)===(active.id||active._id)); if(fresh) setActive(fresh);} };
  const saveVisit = async (e)=>{ e.preventDefault(); if(!active) return; /* in mock mode visits are not stored; real backend will store */ alert("Visit saved (mock). On real backend this will persist."); setVisit({ symptoms:"", diagnosis:"", tests:"", advice:"" }); };
  useEffect(()=>{ load(); },[]);
  return (<div className="grid md:grid-cols-2 gap-6 p-6">
    <div><h1 className="text-2xl font-bold mb-4">Doctor</h1><ul className="divide-y border rounded">{list.map(p=> (<li key={p.id||p._id} className={`p-3 cursor-pointer ${active&&(active.id||active._id)===(p.id||p._id)?'bg-gray-100':''}`} onClick={()=>setActive(p)}><div className="font-medium">{p.name} <span className="text-xs text-gray-500">({p.uniqueId})</span></div><div className="text-xs text-gray-500">{p.phone}</div></li>))}</ul></div>
    <div><h2 className="text-xl font-semibold mb-3">Patient Details</h2>{!active? <p className="text-gray-500">Select a patient to view & add visit.</p> : (<div className="space-y-4"><div className="p-4 rounded border"><div className="font-semibold">{active.name}</div><div className="text-sm text-gray-600">ID: {active.uniqueId} · Phone: {active.phone}</div></div>
      <form onSubmit={saveVisit} className="p-4 border rounded space-y-2"><div className="font-medium">Add Visit (mock)</div>
        <input className="w-full border p-2 rounded" placeholder="Symptoms" value={visit.symptoms} onChange={e=>setVisit({...visit, symptoms:e.target.value})}/>
        <input className="w-full border p-2 rounded" placeholder="Diagnosis" value={visit.diagnosis} onChange={e=>setVisit({...visit, diagnosis:e.target.value})}/>
        <input className="w-full border p-2 rounded" placeholder="Tests (comma separated)" value={visit.tests} onChange={e=>setVisit({...visit, tests:e.target.value})}/>
        <textarea className="w-full border p-2 rounded" placeholder="Advice" value={visit.advice} onChange={e=>setVisit({...visit, advice:e.target.value})}/>
        <button className="bg-brand-orange text-white px-4 py-2 rounded">Save Visit</button>
      </form></div>)}
    </div>
  </div>); }
