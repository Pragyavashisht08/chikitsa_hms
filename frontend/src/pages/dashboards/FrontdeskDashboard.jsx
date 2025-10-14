import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const fmtDateTime = (d) => new Date(d).toLocaleString();
const todayStr = () => new Date().toISOString().slice(0,10);

function makeId(name, phone){
  const N = (name||"").replace(/\s+/g,"").toUpperCase();
  const P = (phone||"").replace(/\D+/g,"");
  return N && P ? `${N}_${P}` : "";
}

export default function FrontdeskDashboard(){
  // SEARCH / FILTER
  const [list,setList] = useState([]);
  const [q,setQ] = useState("");
  const [date,setDate] = useState(todayStr());
  const [onlyToday,setOnlyToday] = useState(true);

  // FORM (new or existing patient)
  const [form,setForm] = useState({ name:"", phone:"" });
  const uniqueId = useMemo(()=> makeId(form.name, form.phone), [form.name, form.phone]);
  const phoneValid = /^\d{10}$/.test((form.phone||"").replace(/\D+/g,""));
  const canCreatePatient = !!uniqueId && phoneValid && form.name.trim().length>0;

  // ACTIVE selection to add VISIT
  const [active,setActive] = useState(null);
  const [visit,setVisit] = useState({
    symptoms:"",
    bpS:"",
    bpD:"",
    payAmount:"",
    payMode:"CASH",
    payStatus:"PENDING",
    notes:""
  });

  // Load list
  const fromISO = useMemo(()=> (onlyToday && date) ? new Date(`${date}T00:00:00.000Z`).toISOString() : "", [onlyToday,date]);
  const toISO   = useMemo(()=> (onlyToday && date) ? new Date(`${date}T23:59:59.999Z`).toISOString() : "", [onlyToday,date]);

  const load = async ()=>{
    const params = { q };
    if(onlyToday && date){ params.from = fromISO; params.to = toISO; }
    const { data } = await api.get("/patients", { params });
    setList(data);
    // keep selection fresh
    if(active){
      const fresh = data.find(p => (p.id||p._id) === (active.id||active._id));
      if(fresh) setActive(fresh);
    }
  };

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ load(); },[onlyToday,date]);

  // Create patient
  const createPatient = async (e)=>{
    e.preventDefault();
    if(!canCreatePatient) return;
    const { data } = await api.post("/patients", {
      uniqueId,
      name: (form.name||"").toUpperCase(),
      phone: (form.phone||"").replace(/\D+/g,"")
    });
    setForm({ name:"", phone:"" });
    setActive(data);
    await load();
  };

  // Add visit for selected patient
  const addVisit = async (e)=>{
    e.preventDefault();
    if(!active) return;
    const payload = {
      date: new Date().toISOString(),
      symptoms: visit.symptoms,
      bp: {
        systolic: visit.bpS ? Number(visit.bpS) : undefined,
        diastolic: visit.bpD ? Number(visit.bpD) : undefined
      },
      payment: {
        amount: visit.payAmount ? Number(visit.payAmount) : undefined,
        mode: visit.payMode,
        status: visit.payStatus
      },
      notes: visit.notes
    };
    const path = `/patients/${(active.id||active._id)}/visits`;
    const { data } = await api.post(path, payload);
    setActive(data);                           // updated patient returned
    setVisit({ symptoms:"", bpS:"", bpD:"", payAmount:"", payMode:"CASH", payStatus:"PENDING", notes:"" });
    await load();
    alert("VISIT ADDED & SENT TO DOCTOR QUEUE (MOCK).");
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-dark">FRONTDESK</h1>
        <div className="text-sm text-slate-500">TOTAL: {list.length}</div>
      </div>

      {/* CREATE / SELECT PATIENT */}
      <div className="card grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-slate-500">PATIENT NAME</label>
          <input className="input mt-1 uppercase" value={form.name}
                 onChange={e=>setForm({...form, name:e.target.value})} placeholder="ENTER FULL NAME" />
        </div>
        <div>
          <label className="text-xs text-slate-500">PHONE (10 DIGITS)</label>
          <input className="input mt-1" inputMode="numeric" maxLength={10} value={form.phone}
                 onChange={e=>setForm({...form, phone: e.target.value.replace(/\D+/g,"").slice(0,10)})}
                 placeholder="ENTER MOBILE" />
          {!phoneValid && form.phone && <div className="text-xs text-red-600 mt-1">PHONE MUST BE EXACTLY 10 DIGITS</div>}
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full disabled:opacity-60" disabled={!canCreatePatient} onClick={createPatient}>
            ADD / SELECT PATIENT
          </button>
        </div>
        <div className="md:col-span-4">
          <label className="text-xs text-slate-500">AUTO UNIQUE ID</label>
          <input className="input mt-1 font-mono" value={uniqueId} readOnly />
        </div>
      </div>

      {/* FILTERS */}
      <div className="card">
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">SEARCH (NAME / PHONE / UNIQUE ID)</label>
            <input className="input mt-1" placeholder="TYPE & CLICK SEARCH" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500">DATE</label>
            <input type="date" className="input mt-1" value={date} onChange={e=>setDate(e.target.value)} disabled={!onlyToday}/>
          </div>
          <div className="flex items-center gap-2">
            <input id="onlyToday" type="checkbox" className="h-4 w-4" checked={onlyToday} onChange={(e)=>setOnlyToday(e.target.checked)} />
            <label htmlFor="onlyToday" className="text-sm text-slate-700">SHOW ONLY TODAY</label>
          </div>
          <div>
            <button onClick={load} className="btn bg-white border border-slate-200 hover:bg-slate-50 w-full">SEARCH</button>
          </div>
        </div>
      </div>

      {/* LIST + SELECT */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-slate-700">
              <tr>
                <th className="p-2 text-left">UNIQUE ID</th>
                <th className="p-2 text-left">NAME</th>
                <th className="p-2 text-left">PHONE</th>
                <th className="p-2 text-left">REGISTERED</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/40">
              {list.map(p=>(
                <tr key={p.id||p._id} className={`border-b border-slate-100 cursor-pointer ${active && (active.id||active._id)===(p.id||p._id) ? "bg-brand-light/60" : ""}`}
                    onClick={()=>setActive(p)}>
                  <td className="p-2 font-mono">{(p.uniqueId||"").toUpperCase()}</td>
                  <td className="p-2 font-medium">{(p.name||"").toUpperCase()}</td>
                  <td className="p-2">{p.phone}</td>
                  <td className="p-2">{fmtDateTime(p.registeredAt)}</td>
                </tr>
              ))}
              {!list.length && <tr><td className="p-3 text-slate-500 italic" colSpan={4}>NO RECORDS</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRIAGE FORM + PREVIOUS VISITS */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold mb-3">RECEPTION TRIAGE (BEFORE DOCTOR)</h2>
          {!active ? <p className="text-slate-500 text-sm">SELECT A PATIENT ABOVE TO START A VISIT.</p> : (
            <form onSubmit={addVisit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500">SYMPTOMS</label>
                <input className="input mt-1" value={visit.symptoms} onChange={e=>setVisit({...visit, symptoms:e.target.value})} placeholder="E.G., FEVER, COUGH" />
              </div>

              <div>
                <label className="text-xs text-slate-500">BP SYSTOLIC</label>
                <input className="input mt-1" inputMode="numeric" value={visit.bpS} onChange={e=>setVisit({...visit, bpS: e.target.value.replace(/\D+/g,"")})} placeholder="e.g., 120" />
              </div>
              <div>
                <label className="text-xs text-slate-500">BP DIASTOLIC</label>
                <input className="input mt-1" inputMode="numeric" value={visit.bpD} onChange={e=>setVisit({...visit, bpD: e.target.value.replace(/\D+/g,"")})} placeholder="e.g., 80" />
              </div>

              <div>
                <label className="text-xs text-slate-500">PAYMENT AMOUNT</label>
                <input className="input mt-1" inputMode="numeric" value={visit.payAmount} onChange={e=>setVisit({...visit, payAmount: e.target.value.replace(/[^\d.]/g,"")})} placeholder="e.g., 300" />
              </div>
              <div>
                <label className="text-xs text-slate-500">PAYMENT MODE</label>
                <select className="input mt-1" value={visit.payMode} onChange={e=>setVisit({...visit, payMode:e.target.value})}>
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500">PAYMENT STATUS</label>
                <select className="input mt-1" value={visit.payStatus} onChange={e=>setVisit({...visit, payStatus:e.target.value})}>
                  <option value="PENDING">PENDING</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-slate-500">OTHER NOTES</label>
                <textarea className="input mt-1" rows={3} value={visit.notes} onChange={e=>setVisit({...visit, notes:e.target.value})} placeholder="ANY IMPORTANT INFO FOR DOCTOR" />
              </div>

              <div className="col-span-2">
                <button className="btn btn-primary w-full">SAVE VISIT & SEND TO DOCTOR</button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold mb-3">PREVIOUS VISITS</h2>
          {!active || !active.visits?.length ? (
            <p className="text-slate-500 text-sm">NO PREVIOUS VISITS.</p>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-auto">
              {[...active.visits].sort((a,b)=> new Date(b.date)-new Date(a.date)).map(v=>(
                <li key={v.id || v.date} className="rounded border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">{fmtDateTime(v.date)}</div>
                  {v.symptoms && <div><span className="font-semibold">SYMPTOMS:</span> {v.symptoms}</div>}
                  {(v?.bp?.systolic || v?.bp?.diastolic) && <div><span className="font-semibold">BP:</span> {v?.bp?.systolic || "-"} / {v?.bp?.diastolic || "-"}</div>}
                  {(v?.payment?.amount!=null || v?.payment?.status) && <div><span className="font-semibold">PAYMENT:</span> ₹{v?.payment?.amount ?? 0} · {v?.payment?.mode || "CASH"} · {v?.payment?.status || "PENDING"}</div>}
                  {v.notes && <div><span className="font-semibold">NOTES:</span> {v.notes}</div>}
                  {v.diagnosis && <div><span className="font-semibold">DIAGNOSIS:</span> {v.diagnosis}</div>}
                  {!!(v.tests||[]).length && <div><span className="font-semibold">TESTS:</span> {(v.tests||[]).join(", ")}</div>}
                  {v.advice && <div><span className="font-semibold">ADVICE:</span> {v.advice}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
