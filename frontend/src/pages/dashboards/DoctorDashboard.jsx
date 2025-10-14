// frontend/src/pages/doctor/DoctorDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { TEMPLATES, searchTemplates } from "../../lib/templates";

// accepted file types for reports
const ACCEPTED_REPORT_TYPES = "application/pdf,image/*";

// date helpers
const todayISO = () => new Date().toISOString().slice(0, 10);
const rangeForDay = (dStr) => ({
  from: new Date(`${dStr}T00:00:00.000Z`).toISOString(),
  to:   new Date(`${dStr}T23:59:59.999Z`).toISOString(),
});

// debounce hook
function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// convert dataURL (base64) -> Blob URL (safer to preview/open)
function dataUrlToBlobURL(dataURL) {
  if (!dataURL || typeof dataURL !== "string" || !dataURL.startsWith("data:")) return null;
  const [head, b64] = dataURL.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(head);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bin = atob(b64);
  const len = bin.length;
  const u8  = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  const blob = new Blob([u8], { type: mime });
  return URL.createObjectURL(blob);
}

export default function DoctorDashboard() {
  // filters
  const [date, setDate] = useState(todayISO());
  const { from, to } = useMemo(() => rangeForDay(date), [date]);
  const [q, setQ] = useState("");
  const qDeb = useDebounced(q, 250);

  // data
  const [patients, setPatients] = useState([]);
  const [active, setActive] = useState(null);

  // visit form
  const [visit, setVisit] = useState({
    symptoms: "", diagnosis: "", tests: "", medicines: "", advice: "",
  });

  // suggestions
  const [symOpts, setSymOpts] = useState([]);
  const [medOpts, setMedOpts] = useState([]);
  const symQ = useDebounced(visit.symptoms.split(",").pop().trim(), 200);
  const medQ = useDebounced(visit.medicines.split(",").pop().trim(), 200);

  // uploading state
  const [uploading, setUploading] = useState(false);

  // template search
  const [tq, setTq] = useState("");
  const filteredTemplates = useMemo(() => searchTemplates(tq), [tq]);

  const load = async () => {
    // If searching, query across ALL dates (omit from/to). Else, limit to selected day.
    const params = qDeb ? { q: qDeb } : { q: "", from, to };
    const { data } = await api.get("/patients", { params });
    setPatients(data);
    if (active) {
      const fresh = data.find((p) => (p.id || p._id) === (active.id || active._id));
      if (fresh) setActive(fresh);
    }
  };

  useEffect(() => { load(); }, [qDeb, from, to]);

  useEffect(() => {
    if (!symQ) { setSymOpts([]); return; }
    api.get("/suggestions", { params: { type: "SYMPTOM", startsWith: symQ } })
      .then((r) => setSymOpts(r.data || []))
      .catch(() => setSymOpts([]));
  }, [symQ]);

  useEffect(() => {
    if (!medQ) { setMedOpts([]); return; }
    api.get("/suggestions", { params: { type: "MEDICINE", startsWith: medQ } })
      .then((r) => setMedOpts(r.data || []))
      .catch(() => setMedOpts([]));
  }, [medQ]);

  // insert selected suggestion in CAPS without losing focus
  const acceptLast = (field, text) => {
    const list = (visit[field] || "").split(",");
    list[list.length - 1] = " " + String(text).toUpperCase();
    const cleaned = list.join(",").replace(/^,\s*/, "").replace(/\s+,/g, ", ");
    setVisit((v) => ({ ...v, [field]: cleaned.trimStart() }));
  };

  const selectPatient = (p) => setActive(p);

  const saveVisit = async (e) => {
    e.preventDefault();
    if (!active) return alert("SELECT A PATIENT FIRST.");
    const payload = {
      symptoms: visit.symptoms,
      diagnosis: visit.diagnosis,
      tests: visit.tests ? visit.tests.split(",").map((s) => s.trim()).filter(Boolean) : [],
      medicines: visit.medicines ? visit.medicines.split(",").map((s) => s.trim()).filter(Boolean) : [],
      advice: visit.advice,
    };
    await api.post(`/patients/${(active.id || active._id)}/visits`, payload);
    setVisit({ symptoms: "", diagnosis: "", tests: "", medicines: "", advice: "" });
    await load();
    alert("VISIT SAVED.");
  };

  // upload a report (PDF/image). In mock mode we send base64; real API can send multipart -> url.
  const onUploadReport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        // name: <UNIQUE_ID>_REPORT
        const autoName = `${(active.uniqueId || "REPORT")}_REPORT`;
        const payload = { name: autoName, dataURL: reader.result }; // base64 for mock
        await api.post(`/patients/${(active._id || active.id)}/reports`, payload);
        await load();
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } finally {
      e.target.value = ""; // allow re-select same file
    }
  };

  const getReportSrc = (r) => {
    if (r.url && r.url.startsWith("http")) return r.url;
    if (r.dataURL) return dataUrlToBlobURL(r.dataURL);
    return null;
  };

  const openReport = (r) => {
    const src = getReportSrc(r);
    if (!src) return alert("UNABLE TO OPEN THIS FILE.");
    window.open(src, "_blank", "noopener,noreferrer");
  };

  const isPdfReport = (r) => {
    if (r.dataURL && typeof r.dataURL === "string") {
      const m = /^data:(.*?);base64/.exec(r.dataURL);
      return (m ? m[1] : "").toLowerCase() === "application/pdf";
    }
    return false;
  };

  const printReport = (r) => {
    const src = getReportSrc(r);
    if (!src) return alert("UNABLE TO PRINT THIS FILE.");
    const w = window.open("", "_blank");
    if (!w) return;

    const isPdf = isPdfReport(r);
    const html = isPdf
      ? `
        <html><head><title>${r.name || "REPORT"}</title></head>
        <body style="margin:0">
          <iframe src="${src}" style="border:0;width:100vw;height:100vh" onload="this.contentWindow && this.contentWindow.focus && this.contentWindow.focus(); setTimeout(()=>print(),200)"></iframe>
        </body></html>`
      : `
        <html><head><title>${r.name || "REPORT"}</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center">
          <img src="${src}" style="max-width:100%;max-height:100vh" onload="setTimeout(()=>print(),200)"/>
        </body></html>`;
    w.document.write(html); w.document.close();
  };

  // OPEN / PRINT template with auto-filled patient + visit details
  const buildCtx = () => ({
    patient: active || {},
    visit: {
      symptoms: visit.symptoms,
      diagnosis: visit.diagnosis,
      tests: visit.tests,
      medicines: visit.medicines,
      advice: visit.advice,
    },
    now: new Date(),
  });

  const openTemplate = (tpl) => {
    if (!active) return alert("SELECT A PATIENT FIRST.");
    const html = tpl.build(active, buildCtx());
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  const printTemplate = (tpl) => {
    if (!active) return alert("SELECT A PATIENT FIRST.");
    const html = tpl
      .build(active, buildCtx())
      .replace("</body>", `<script>setTimeout(()=>window.print(), 200);</script></body>`);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  // PRINT the current visit form as a simple prescription
  const printable = () => {
    if (!active) return alert("SELECT A PATIENT FIRST.");
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
    <html><head><title>PRESCRIPTION</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:24px}
      h1{margin:0 0 12px}
      .s{margin:6px 0}
    </style>
    </head><body>
      <h1>PRESCRIPTION</h1>
      <div class="s"><b>PATIENT:</b> ${(active.name||"").toUpperCase()} (${active.uniqueId||""})</div>
      <div class="s"><b>DATE:</b> ${new Date().toLocaleString()}</div>
      <hr/>
      <div class="s"><b>SYMPTOMS:</b> ${visit.symptoms||""}</div>
      <div class="s"><b>DIAGNOSIS:</b> ${visit.diagnosis||""}</div>
      <div class="s"><b>TESTS:</b> ${visit.tests||""}</div>
      <div class="s"><b>MEDICINES:</b> ${visit.medicines||""}</div>
      <div class="s"><b>ADVICE:</b> ${visit.advice||""}</div>
      <script>setTimeout(()=>window.print(), 200);</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
      {/* LEFT: list (today + search) */}
      <section className="card">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold text-brand-dark">DOCTOR</h1>
          <input type="date" className="input ml-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <input
          className="input mb-3"
          placeholder="SEARCH (NAME / PHONE / UNIQUE ID)"
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
        />
        <ul className="divide-y divide-slate-100 max-h-[65vh] overflow-auto">
          {patients.map((p) => (
            <li
              key={p._id || p.id}
              onClick={() => selectPatient(p)}
              className={`p-3 cursor-pointer rounded ${active && (active._id || active.id) === (p._id || p.id) ? "bg-brand-light/70" : ""}`}
            >
              <div className="font-semibold">
                {(p.name || "").toUpperCase()}{" "}
                <span className="text-xs text-slate-500">({p.uniqueId})</span>
              </div>
              <div className="text-xs text-slate-500">{p.phone}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* RIGHT: details + visit form + reports + templates */}
      <section className="space-y-4">
        <div className="card">
          <h2 className="font-semibold mb-2">PATIENT DETAILS</h2>
          {!active ? (
            <div className="text-slate-500 text-sm">Select a patient to view & add visit.</div>
          ) : (
            <div className="text-sm">
              <div className="font-medium">{(active.name || "").toUpperCase()}</div>
              <div className="text-slate-500">ID: {active.uniqueId} · Phone: {active.phone}</div>
            </div>
          )}
        </div>

        <form onSubmit={saveVisit} className="card space-y-2 overflow-visible">
          <div className="font-medium">ADD VISIT</div>

          {/* SYMPTOMS + suggestions */}
          <div className="relative">
            <input
              className="input"
              placeholder="SYMPTOMS (COMMA SEPARATED)"
              value={visit.symptoms}
              onChange={(e) => setVisit((v) => ({ ...v, symptoms: e.target.value.toUpperCase() }))}
            />
            {symOpts.length > 0 && symQ && (
              <div className="absolute z-50 bg-white border border-slate-200 rounded w-full mt-1 shadow-lg">
                {symOpts.map((s) => (
                  <div
                    key={s}
                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    onMouseDown={(e) => { e.preventDefault(); acceptLast("symptoms", s); setSymOpts([]); }}
                  >
                    {String(s).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            className="input"
            placeholder="DIAGNOSIS"
            value={visit.diagnosis}
            onChange={(e) => setVisit((v) => ({ ...v, diagnosis: e.target.value.toUpperCase() }))}
          />

          <input
            className="input"
            placeholder="TESTS (COMMA SEPARATED)"
            value={visit.tests}
            onChange={(e) => setVisit((v) => ({ ...v, tests: e.target.value.toUpperCase() }))}
          />

          {/* MEDICINES + suggestions */}
          <div className="relative">
            <input
              className="input"
              placeholder="MEDICINES (COMMA SEPARATED)"
              value={visit.medicines}
              onChange={(e) => setVisit((v) => ({ ...v, medicines: e.target.value.toUpperCase() }))}
            />
            {medOpts.length > 0 && medQ && (
              <div className="absolute z-50 bg-white border border-slate-200 rounded w-full mt-1 shadow-lg">
                {medOpts.map((m) => (
                  <div
                    key={m}
                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    onMouseDown={(e) => { e.preventDefault(); acceptLast("medicines", m); setMedOpts([]); }}
                  >
                    {String(m).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>

          <textarea
            className="input"
            rows={3}
            placeholder="ADVICE"
            value={visit.advice}
            onChange={(e) => setVisit((v) => ({ ...v, advice: e.target.value.toUpperCase() }))}
          />

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">SAVE VISIT</button>
            <button className="btn bg-white border border-slate-200" type="button" onClick={printable}>PRINT</button>
          </div>
        </form>

        {/* REPORTS (OPEN / PRINT / DELETE) */}
        <div className="card space-y-3 overflow-visible">
          <div className="flex items-center justify-between">
            <div className="font-medium">REPORTS</div>
            <label className="btn btn-primary cursor-pointer">
              {uploading ? "UPLOADING..." : "UPLOAD"}
              <input type="file" accept={ACCEPTED_REPORT_TYPES} className="hidden" onChange={onUploadReport} disabled={!active || uploading} />
            </label>
          </div>

          {!active ? (
            <div className="text-sm text-slate-500">Select a patient to manage reports.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-light/60 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">NAME</th>
                    <th className="p-2 text-left">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/40">
                  {(active.reports || []).length === 0 ? (
                    <tr><td className="p-3 text-slate-500" colSpan={2}>No reports yet.</td></tr>
                  ) : (
                    (active.reports || []).map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 flex flex-wrap gap-2">
                          <button type="button" className="btn bg-white border border-slate-200" onClick={() => openReport(r)}>OPEN</button>
                          <button type="button" className="btn bg-white border border-slate-200" onClick={() => printReport(r)}>PRINT</button>
                          <button
                            type="button"
                            className="btn bg-white border border-slate-200"
                            onClick={() => api.delete(`/patients/${(active._id || active.id)}/reports/${r.id}`).then(load)}
                          >
                            DELETE
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TEMPLATES (SEARCH + OPEN/PRINT) */}
        <div className="card space-y-3 overflow-visible">
          <div className="flex items-center gap-3">
            <div className="font-medium">CERTIFICATES & REPORT TEMPLATES</div>
            <input
              className="input ml-auto"
              placeholder="SEARCH TEMPLATES (e.g., DISCHARGE, LEAVE, FITNESS)"
              value={tq}
              onChange={(e) => setTq(e.target.value)}
            />
          </div>

          {!active ? (
            <div className="text-sm text-slate-500">Select a patient to generate a document.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-light/60 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">TITLE</th>
                    <th className="p-2 text-left">CATEGORY</th>
                    <th className="p-2 text-left">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/40">
                  {filteredTemplates.length === 0 ? (
                    <tr><td className="p-3 text-slate-500" colSpan={3}>No templates found.</td></tr>
                  ) : (
                    filteredTemplates.map((tpl) => (
                      <tr key={tpl.id} className="border-b border-slate-100">
                        <td className="p-2 font-medium">{tpl.title}</td>
                        <td className="p-2">{tpl.category}</td>
                        <td className="p-2 flex flex-wrap gap-2">
                          <button className="btn bg-white border border-slate-200" type="button" onClick={() => openTemplate(tpl)}>OPEN</button>
                          <button className="btn bg-white border border-slate-200" type="button" onClick={() => printTemplate(tpl)}>PRINT</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
