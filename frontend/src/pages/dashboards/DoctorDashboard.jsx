import { useEffect, useMemo, useState, useCallback } from "react";
import {
  User,
  Phone,
  Search,
  Plus,
  ClipboardList,
  History,
  X,
  FileText,
  Upload,
  Printer,
  Eye,
  Trash2,
  Stethoscope,
  Pill,
  TestTube,
  FileCheck,
  Heart,
  Thermometer,
  Weight,
  Droplet,
  AlertCircle,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api, { getPatients, addVisit, uploadReport } from "../../lib/api";
import { toast } from "sonner";

/* -------------------- utils -------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ✅ safer URL resolver: supports absolute URLs or API-relative paths only
const resolveUrl = (u) => {
  if (!u) return "";

  // Absolute link? Just return.
  if (/^https?:\/\//i.test(u)) return u;

  // If it starts with /api/, build against root of backend (strip trailing /api)
  const base = api?.defaults?.baseURL?.replace(/\/$/, "") || "";
  if (u.startsWith("/api/")) {
    const root = base.replace(/\/api$/, "");
    return `${root}${u}`;
  }

  // Otherwise, just return as-is (fallback fetching handles it)
  return u;
};

const LS_TEMPLATE_KEY = "doctor_template_meta_v1";

/* -------------------- Tiny in-file modal -------------------- */
function TemplateEditor({ open, tpl, value, onClose, onSave }) {
  if (!open || !tpl) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h4 className="font-semibold text-slate-900">Edit Template Defaults</h4>
          <button className="p-1 rounded hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ["doctorName", "Doctor Name"],
            ["designation", "Designation"],
            ["regNo", "Registration No"],
            ["hospitalName", "Hospital Name"],
            ["hospitalAddress", "Hospital Address"],
            ["hospitalPhone", "Hospital Phone"],
            ["hospitalEmail", "Hospital Email"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
              <input
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={value[key] || ""}
                onChange={(e) => onSave({ ...value, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Custom Note (optional)</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={value.customNote || ""}
              onChange={(e) => onSave({ ...value, customNote: e.target.value })}
            />
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              try {
                localStorage.setItem(LS_TEMPLATE_KEY, JSON.stringify(value));
              } catch {}
              toast.success("Template defaults saved");
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- PAGE -------------------- */
export default function DoctorDashboard() {
  const [date, setDate] = useState(todayISO());
  const [q, setQ] = useState("");
  const qDeb = useDebounced(q, 250);

  const [patients, setPatients] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState({
    vitals: true,
    consultation: true,
    prescription: true,
    history: false,
    reports: false,
    templates: false,
  });

  const [visit, setVisit] = useState({
    // Vitals
    temperature: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    pulse: "",
    weight: "",
    height: "",
    oxygenSaturation: "",
    // Consultation
    chiefComplaints: "",
    symptoms: "",
    diagnosis: "",
    // Prescription
    tests: "",
    medicines: "",
    advice: "",
    followUpDate: "",
    notes: "",
  });

  const [medicineForm, setMedicineForm] = useState({
    name: "",
    dosage: "1-0-1",
    timing: "AFTER FOOD",
    days: "5",
  });
  const [testForm, setTestForm] = useState("");

  // Suggestions (optional; safe if backend route absent)
  const [symOpts, setSymOpts] = useState([]);
  const [medOpts, setMedOpts] = useState([]);
  const symQ = useDebounced(visit.symptoms.split(",").pop().trim(), 200);
  const medQ = useDebounced(medicineForm.name.trim(), 200);

  const [uploading, setUploading] = useState(false);
  const [tq, setTq] = useState("");

  // Editable template defaults (used by Certificates & Templates)
  const [templateData, setTemplateData] = useState({
    doctorName: "Dr. John Doe",
    designation: "Physician",
    regNo: "MED12345",
    hospitalName: "MediCare Hospital",
    hospitalAddress: "123 Healthcare Street, New Delhi, India",
    hospitalPhone: "+91 9876543210",
    hospitalEmail: "contact@medicare.com",
    customNote: "",
  });
  const [editingTpl, setEditingTpl] = useState(null); // when set, opens editor modal

  useEffect(() => {
    // Load saved template defaults
    try {
      const saved = JSON.parse(localStorage.getItem(LS_TEMPLATE_KEY) || "{}");
      if (saved && typeof saved === "object") {
        setTemplateData((s) => ({ ...s, ...saved }));
      }
    } catch {}
  }, []);

  const TEMPLATES = [
    { id: 1, title: "Medical Certificate", category: "CERTIFICATE" },
    { id: 2, title: "Fitness Certificate", category: "CERTIFICATE" },
    { id: 3, title: "Sick Leave Certificate", category: "LEAVE" },
    { id: 4, title: "Discharge Summary", category: "REPORT" },
    { id: 5, title: "Lab Report Template", category: "REPORT" },
  ];
  const filteredTemplates = useMemo(() => {
    if (!tq) return TEMPLATES;
    return TEMPLATES.filter(
      (t) =>
        t.title.toLowerCase().includes(tq.toLowerCase()) ||
        t.category.toLowerCase().includes(tq.toLowerCase())
    );
  }, [tq]);

  /* ------------ LOAD PATIENTS (REAL API) ------------ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        qDeb && qDeb.trim().length > 0
          ? { q: qDeb }
          : {
              q: "",
              from: new Date(`${date}T00:00:00.000Z`).toISOString(),
              to: new Date(`${date}T23:59:59.999Z`).toISOString(),
            };
      const { data } = await getPatients(params);
      const list = Array.isArray(data) ? data : [];
      setPatients(list);

      if (active) {
        const id = active._id || active.id;
        const fresh = list.find((p) => (p._id || p.id) === id);
        if (fresh) setActive(fresh);
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [qDeb, date]); // keep 'active' out to avoid flicker

  useEffect(() => {
    load();
  }, [load]);

  /* ------------ SUGGESTIONS (optional) ------------ */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!symQ) return setSymOpts([]);
      try {
        const { data } = await api.get("/suggestions", {
          params: { type: "SYMPTOM", startsWith: symQ },
        });
        if (!cancelled) setSymOpts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSymOpts([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [symQ]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!medQ) return setMedOpts([]);
      try {
        const { data } = await api.get("/suggestions", {
          params: { type: "MEDICINE", startsWith: medQ },
        });
        if (!cancelled) setMedOpts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMedOpts([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [medQ]);

  /* ------------ HELPERS ------------ */
  const toggle = (key) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const addMedicine = useCallback(() => {
    if (!medicineForm.name.trim()) return;
    const formatted = `${medicineForm.name.toUpperCase()} - ${medicineForm.dosage} ${medicineForm.timing} - ${medicineForm.days} DAYS`;
    const current = visit.medicines ? visit.medicines + "\n" + formatted : formatted;
    setVisit((v) => ({ ...v, medicines: current }));
    setMedicineForm({ name: "", dosage: "1-0-1", timing: "AFTER FOOD", days: "5" });
  }, [medicineForm, visit.medicines]);

  const addTest = useCallback(() => {
    if (!testForm.trim()) return;
    const current = visit.tests ? visit.tests + "\n" + testForm.toUpperCase() : testForm.toUpperCase();
    setVisit((v) => ({ ...v, tests: current }));
    setTestForm("");
  }, [testForm, visit.tests]);

  const removeMedicine = (index) => {
    const lines = (visit.medicines || "").split("\n").filter((_, i) => i !== index);
    setVisit((v) => ({ ...v, medicines: lines.join("\n") }));
  };

  const removeTest = (index) => {
    const lines = (visit.tests || "").split("\n").filter((_, i) => i !== index);
    setVisit((v) => ({ ...v, tests: lines.join("\n") }));
  };

  const acceptSym = (text) => {
    const list = (visit.symptoms || "").split(",");
    list[list.length - 1] = " " + String(text).toUpperCase();
    const cleaned = list.join(",").replace(/^,\s*/, "").replace(/\s+,/g, ", ");
    setVisit((v) => ({ ...v, symptoms: cleaned.trimStart() }));
    setSymOpts([]);
  };

  const acceptMed = (text) => {
    setMedicineForm((f) => ({ ...f, name: text }));
    setMedOpts([]);
  };

  const selectPatient = (p) => setActive(p);

  const validate = () => {
    if (!active) {
      toast.warning("Please select a patient first");
      return false;
    }
    if (visit.bloodPressureSystolic && !visit.bloodPressureDiastolic) {
      toast.warning("Enter both systolic and diastolic BP");
      return false;
    }
    if (visit.oxygenSaturation && (visit.oxygenSaturation < 50 || visit.oxygenSaturation > 100)) {
      toast.warning("SpO₂ should be between 50 and 100");
      return false;
    }
    return true;
  };

  /* ------------ SAVE VISIT (REAL API) ------------ */
  const saveVisit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        vitals: {
          temperature: visit.temperature,
          bloodPressure:
            visit.bloodPressureSystolic && visit.bloodPressureDiastolic
              ? `${visit.bloodPressureSystolic}/${visit.bloodPressureDiastolic}`
              : "",
          pulse: visit.pulse,
          weight: visit.weight,
          height: visit.height,
          oxygenSaturation: visit.oxygenSaturation,
        },
        chiefComplaints: visit.chiefComplaints,
        symptoms: visit.symptoms,
        diagnosis: visit.diagnosis,
        tests: visit.tests ? visit.tests.split("\n").map((s) => s.trim()).filter(Boolean) : [],
        medicines: visit.medicines ? visit.medicines.split("\n").map((s) => s.trim()).filter(Boolean) : [],
        advice: visit.advice,
        followUpDate: visit.followUpDate,
        notes: visit.notes,
      };

      const { data } = await addVisit(active._id || active.id, payload);

      setActive(data); // update active from server response

      // reset form
      setVisit({
        temperature: "",
        bloodPressureSystolic: "",
        bloodPressureDiastolic: "",
        pulse: "",
        weight: "",
        height: "",
        oxygenSaturation: "",
        chiefComplaints: "",
        symptoms: "",
        diagnosis: "",
        tests: "",
        medicines: "",
        advice: "",
        followUpDate: "",
        notes: "",
      });

      await load();
      toast.success("Visit saved successfully");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Could not save visit");
    } finally {
      setLoading(false);
    }
  };

  /* ------------ REPORTS (per VISIT aggregated in UI) ------------ */
  const newestVisit = useMemo(() => {
    if (!active?.visits?.length) return null;
    return [...active.visits].sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
  }, [active]);

  // ✅ robust upload (tries multiple field names) + unique filename
  const onUploadReport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!active) return toast.warning("Select a patient first");
    if (!newestVisit?._id && !newestVisit?.id)
      return toast.warning("Please save a visit before uploading a report");

    setUploading(true);
    try {
      const pid = active._id || active.id;
      const vid = newestVisit._id || newestVisit.id;

      const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
      const uniqueName = `${active.uniqueId || "PAT"}_${vid}_${Date.now()}${ext || ""}`;

      const attempts = [
        (fd) => (fd.append("file", file, uniqueName), fd.append("name", uniqueName), fd),
        (fd) => (fd.append("report", file, uniqueName), fd.append("filename", uniqueName), fd),
        (fd) => (fd.append("document", file, uniqueName), fd.append("fileName", uniqueName), fd),
      ];

      let ok = false, lastErr;
      for (const build of attempts) {
        const fd = build(new FormData());
        try {
          if (typeof uploadReport === "function") {
            await uploadReport(pid, vid, fd);
          } else {
           await api.post(`/patients/${pid}/visits/${vid}/reports`, fd);

          }
          ok = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!ok) throw lastErr || new Error("Upload failed");

      await load();
      toast.success("Report uploaded");
    } catch (e2) {
      console.error(e2);
      const msg =
        e2?.response?.data?.message ||
        e2?.response?.data?.error ||
        e2?.response?.data?.errors?.[0]?.msg ||
        "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // Aggregate reports with normalized names/urls
  const allReports = useMemo(() => {
    if (!active?.visits?.length) return [];
    const out = [];
    for (const v of active.visits) {
      (v.reports || []).forEach((r) => {
        const url = resolveUrl(r?.url || r?.fileUrl || r?.link || r?.path || "");
        const fallbackName = decodeURIComponent((url.split("/").pop() || "").split("?")[0] || "REPORT");
        out.push({
          ...r,
          displayName: r.name || r.filename || r.fileName || fallbackName,
          url,
          visitId: v._id || v.id,
          visitDate: v.date,
        });
      });
    }
    out.sort((a, b) => {
      const d = new Date(b.visitDate) - new Date(a.visitDate);
      if (d !== 0) return d;
      return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
    });
    return out;
  }, [active]);

  /* ------------ VIEW/PRINT (with blob fallback) ------------ */

  // Try multiple endpoints to get a file Blob (works even if the URL is not public)
  const fetchReportBlob = async (r) => {
    const pid = active?._id || active?.id;
    const vid = r.visitId;
    const rid = r._id || r.id;
    const name =
      r.displayName ||
      r.name ||
      r.filename ||
      r.fileName ||
      (r.url || r.fileUrl || r.link || "").split("/").pop();

    const tries = [];
    const add = (path, config = {}) =>
      tries.push(() => api.get(path, { responseType: "blob", ...config }));

    // Common REST patterns
    if (rid) {
      add(`/patients/${pid}/visits/${vid}/reports/${rid}/download`);
      add(`/patients/${pid}/visits/${vid}/reports/${rid}`); // some APIs stream here
      add(`/files/${rid}`);
    }
    if (name) {
      add(`/patients/${pid}/visits/${vid}/reports/download`, { params: { name } });
      add(`/patients/${pid}/visits/${vid}/report/download`, { params: { name } });
      add(`/uploads/${name}`); // if server serves /uploads statically
    }

    // Last resort: hit the absolute URL via API client if same-origin
    const raw = r?.url || r?.fileUrl || r?.link || r?.path || "";
    if (raw) {
      const abs = resolveUrl(raw);
      const base = api?.defaults?.baseURL?.replace(/\/$/, "") || "";
      if (abs.startsWith(base)) {
        const rel = abs.slice(base.length) || "/";
        add(rel[0] === "/" ? rel : `/${rel}`);
      }
    }

    let lastErr;
    for (const run of tries) {
      try {
        const res = await run();
        const ct = res.headers["content-type"] || "application/octet-stream";
        return {
          blob: res.data,
          contentType: ct,
          filename: name || rid || "report",
        };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not fetch report");
  };

  // Open report in new tab. If direct URL fails, fetch as blob and open.
  const openReport = async (r) => {
    try {
      const raw = r?.url || r?.fileUrl || r?.link || r?.path || r?.displayName;
      const direct = resolveUrl(raw);

      if (direct) {
        const tab = window.open(direct, "_blank");
        if (tab) {
          try {
            const base = api?.defaults?.baseURL?.replace(/\/$/, "") || "";
            if (direct.startsWith(base)) {
              await api.get(direct.slice(base.length) || "/", { responseType: "arraybuffer" });
            }
            return; // reachable
          } catch {
            try {
              const { blob, filename } = await fetchReportBlob(r);
              const url = URL.createObjectURL(blob);
              tab.location.href = url;
              tab.document.title = filename;
              return;
            } catch (e) {
              tab.close();
              throw e;
            }
          }
        }
      }

      // Blob fallback (if popup blocked or no direct URL)
      const { blob } = await fetchReportBlob(r);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Unable to open report");
    }
  };

  const printReport = async (r) => {
    const openPrintable = (url, title) => {
      const w = window.open("", "_blank");
      if (!w) return;
      const isPdf = /\.pdf($|\?)/i.test(url);
      const html = isPdf
        ? `<html><head><title>${title || "Report"}</title></head>
           <body style="margin:0">
             <iframe src="${url}" style="border:0;width:100vw;height:100vh" onload="setTimeout(()=>print(),200)"></iframe>
           </body></html>`
        : `<html><head><title>${title || "Report"}</title></head>
           <body style="margin:0;display:flex;align-items:center;justify-content:center">
             <img src="${url}" style="max-width:100%;max-height:100vh" onload="setTimeout(()=>print(),200)"/>
           </body></html>`;
      w.document.write(html);
      w.document.close();
    };

    try {
      const raw = r?.url || r?.fileUrl || r?.link || r?.path || r?.displayName;
      const direct = resolveUrl(raw);

      if (direct) {
        try {
          const base = api?.defaults?.baseURL?.replace(/\/$/, "") || "";
          if (direct.startsWith(base)) {
            await api.get(direct.slice(base.length) || "/", { responseType: "arraybuffer" });
          }
          openPrintable(direct, r.displayName || r.name || "Report");
          return;
        } catch {
          // fall through
        }
      }

      const { blob, filename, contentType } = await fetchReportBlob(r);
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: contentType }));
      openPrintable(blobUrl, filename);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Unable to print report");
    }
  };

  /* ------------ DELETE (multi-attempt) ------------ */
  const deleteReport = async (r) => {
    const pid = active._id || active.id;
    const vid = r.visitId;
    const rid = r._id || r.id;
    const name =
      r.displayName ||
      r.name ||
      r.filename ||
      r.fileName ||
      (r.url || "").split("/").pop();

    const attempts = [];

    if (rid) {
      // DELETE by id (path)
      attempts.push(() => api.delete(`/patients/${pid}/visits/${vid}/reports/${rid}`));
      // DELETE by id (query)
      attempts.push(() => api.delete(`/patients/${pid}/visits/${vid}/reports`, { params: { id: rid } }));
      attempts.push(() => api.delete(`/patients/${pid}/visits/${vid}/report`, { params: { id: rid } }));
      // POST delete-by-id
      attempts.push(() => api.post(`/patients/${pid}/visits/${vid}/reports/delete`, { id: rid }));
    }

    if (name) {
      // DELETE/POST by filename
      attempts.push(() => api.delete(`/patients/${pid}/visits/${vid}/reports`, { params: { name } }));
      attempts.push(() => api.post(`/patients/${pid}/visits/${vid}/reports/delete`, { name }));
    }

    let lastErr;
    for (const run of attempts) {
      try {
        await run();
        await load();
        toast.success("Report deleted");
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    console.error(lastErr);
    toast.error(lastErr?.response?.data?.message || "Delete failed");
  };

  const printPrescription = () => {
    if (!active) return toast.warning("Select a patient first");
    const bmi =
      visit.weight && visit.height
        ? (
            parseFloat(visit.weight) /
            Math.pow(parseFloat(visit.height) / 100, 2)
          ).toFixed(1)
        : "N/A";
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `
      <html><head><title>Prescription - ${active.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:15px;margin-bottom:20px}
        .header h1{margin:0;color:#2563eb;font-size:24px}
        .header p{margin:5px 0;color:#666}
        .section{margin:15px 0}
        .section-title{font-weight:bold;color:#2563eb;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:10px}
        .info-row{margin:5px 0}
        .label{font-weight:bold;color:#333}
        .vitals-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .prescription-list{margin:10px 0}
        .prescription-list li{margin:5px 0}
        .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;text-align:right}
        @media print{body{padding:10px}}
      </style></head>
      <body>
        <div class="header">
          <h1>${templateData.hospitalName}</h1>
          <p>${templateData.hospitalAddress} | Ph: ${templateData.hospitalPhone}</p>
          <p>${templateData.doctorName} - ${templateData.designation}</p>
        </div>

        <div class="section">
          <div class="info-row"><span class="label">Patient:</span> ${String(active.name || "").toUpperCase()}</div>
          <div class="info-row"><span class="label">Patient ID:</span> ${active.uniqueId}</div>
          <div class="info-row"><span class="label">Phone:</span> ${active.phone}</div>
          <div class="info-row"><span class="label">Date:</span> ${new Date().toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" })}</div>
        </div>

        ${
          visit.temperature ||
          visit.bloodPressureSystolic ||
          visit.pulse ||
          visit.weight
            ? `
        <div class="section">
          <div class="section-title">Vital Signs</div>
          <div class="vitals-grid">
            ${visit.temperature ? `<div><span class="label">Temperature:</span> ${visit.temperature}°F</div>` : ""}
            ${visit.bloodPressureSystolic ? `<div><span class="label">BP:</span> ${visit.bloodPressureSystolic}/${visit.bloodPressureDiastolic} mmHg</div>` : ""}
            ${visit.pulse ? `<div><span class="label">Pulse:</span> ${visit.pulse} bpm</div>` : ""}
            ${visit.weight ? `<div><span class="label">Weight:</span> ${visit.weight} kg</div>` : ""}
            ${visit.height ? `<div><span class="label">Height:</span> ${visit.height} cm</div>` : ""}
            ${visit.weight && visit.height ? `<div><span class="label">BMI:</span> ${bmi}</div>` : ""}
            ${visit.oxygenSaturation ? `<div><span class="label">SpO2:</span> ${visit.oxygenSaturation}%</div>` : ""}
          </div>
        </div>` : "" }

        ${visit.chiefComplaints ? `<div class="section"><div class="section-title">Chief Complaints</div><p>${visit.chiefComplaints.toUpperCase()}</p></div>` : ""}
        ${visit.symptoms ? `<div class="section"><div class="section-title">Symptoms</div><p>${visit.symptoms.toUpperCase()}</p></div>` : ""}
        ${visit.diagnosis ? `<div class="section"><div class="section-title">Diagnosis</div><p>${visit.diagnosis.toUpperCase()}</p></div>` : ""}

        ${
          visit.tests
            ? `<div class="section"><div class="section-title">Investigations/Tests Advised</div><ol class="prescription-list">${
                visit.tests.split("\n").filter(Boolean).map((t) => `<li>${t.trim().toUpperCase()}</li>`).join("")
              }</ol></div>`
            : ""
        }

        ${
          visit.medicines
            ? `<div class="section"><div class="section-title">Rx (Prescription)</div><ol class="prescription-list">${
                visit.medicines.split("\n").filter(Boolean).map((m) => `<li>${m.trim().toUpperCase()}</li>`).join("")
              }</ol></div>`
            : ""
        }

        ${visit.advice ? `<div class="section"><div class="section-title">Advice</div><p>${visit.advice.toUpperCase()}</p></div>` : ""}

        ${visit.followUpDate ? `<div class="section"><div class="info-row"><span class="label">Follow-up Date:</span> ${new Date(visit.followUpDate).toLocaleDateString("en-IN")}</div></div>` : ""}

        <div class="footer">
          <p>____________________</p>
          <p>${templateData.doctorName}</p>
          <p>Registration No: ${templateData.regNo}</p>
        </div>

        <script>window.onload=function(){ setTimeout(function(){ window.print(); }, 400); };</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 w-full">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Doctor Consultation
          </h1>
          <p className="text-sm text-slate-600 mt-1">Manage patient visits and medical records</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* PATIENT LIST */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                  <span className="hidden sm:inline">Patients</span>
                </h2>
                <input
                  type="date"
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Filter by date"
                />
              </div>

              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    placeholder="Search by name / phone / ID..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Search patients"
                  />
                </div>
              </div>

              {loading && (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              )}

              {!loading && patients.length === 0 && (
                <div className="text-center py-8">
                  <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">No patients</p>
                </div>
              )}

              {!loading && patients.length > 0 && (
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-auto pr-1">
                  {patients.map((p) => {
                    const isActive = active && (active._id || active.id) === (p._id || p.id);
                    return (
                      <button
                        key={p._id || p.id}
                        onClick={() => selectPatient(p)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                          isActive
                            ? "bg-blue-50/70 border-blue-500 shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 border-transparent"
                        }`}
                        aria-pressed={isActive}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">
                              {String(p.name || "").toUpperCase()}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{p.uniqueId}</p>
                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" /> {p.phone}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded-full text-[11px] font-semibold text-blue-700">
                            {(p.visits || []).length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CONSULTATION FORM */}
          <div className="lg:col-span-2">
            {!active ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
                <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Select a patient to start consultation</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* PATIENT CARD */}
                <div className="rounded-xl p-4 text-white shadow-md bg-gradient-to-r from-blue-600 to-indigo-600">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-wide">
                        {String(active.name || "").toUpperCase()}
                      </h2>
                      <p className="text-blue-100 text-sm mt-1">
                        ID: {active.uniqueId} • Phone: {active.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-100">Total Visits</p>
                      <p className="text-2xl font-bold">{(active.visits || []).length}</p>
                    </div>
                  </div>
                </div>

                {/* VITALS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("vitals")}
                    aria-expanded={expanded.vitals}
                    aria-controls="section-vitals"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-600" />
                      Vital Signs
                    </h3>
                    {expanded.vitals ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  <div
                    id="section-vitals"
                    role="region"
                    className={`grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-4 transition-all duration-200 ${
                      expanded.vitals ? "max-h-[900px] pt-0" : "max-h-0 overflow-hidden"
                    }`}
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Temperature (°F)
                      </label>
                      <div className="relative">
                        <Thermometer className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          min={90}
                          max={110}
                          step="0.1"
                          className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="98.6"
                          value={visit.temperature}
                          onChange={(e) => setVisit((v) => ({ ...v, temperature: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        BP Systolic
                      </label>
                      <input
                        type="number"
                        min={60}
                        max={220}
                        className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="120"
                        value={visit.bloodPressureSystolic}
                        onChange={(e) =>
                          setVisit((v) => ({ ...v, bloodPressureSystolic: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        BP Diastolic
                      </label>
                      <input
                        type="number"
                        min={40}
                        max={140}
                        className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="80"
                        value={visit.bloodPressureDiastolic}
                        onChange={(e) =>
                          setVisit((v) => ({ ...v, bloodPressureDiastolic: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Pulse (bpm)
                      </label>
                      <input
                        type="number"
                        min={40}
                        max={180}
                        className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="72"
                        value={visit.pulse}
                        onChange={(e) => setVisit((v) => ({ ...v, pulse: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Weight (kg)
                      </label>
                      <div className="relative">
                        <Weight className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          step="0.1"
                          className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="70"
                          value={visit.weight}
                          onChange={(e) => setVisit((v) => ({ ...v, weight: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="170"
                        value={visit.height}
                        onChange={(e) => setVisit((v) => ({ ...v, height: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        SpO2 (%)
                      </label>
                      <div className="relative">
                        <Droplet className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          min={50}
                          max={100}
                          className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="98"
                          value={visit.oxygenSaturation}
                          onChange={(e) =>
                            setVisit((v) => ({ ...v, oxygenSaturation: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    {visit.weight && visit.height && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">BMI</label>
                        <div className="px-2 py-2 text-sm bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900">
                          {(
                            parseFloat(visit.weight) /
                            Math.pow(parseFloat(visit.height) / 100, 2)
                          ).toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CONSULTATION */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("consultation")}
                    aria-expanded={expanded.consultation}
                    aria-controls="section-consultation"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                      Consultation Details
                    </h3>
                    {expanded.consultation ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  <div
                    id="section-consultation"
                    role="region"
                    className={`p-4 pt-0 space-y-3 transition-all duration-200 ${
                      expanded.consultation ? "max-h-[1200px]" : "max-h-0 overflow-hidden"
                    }`}
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Chief Complaints
                      </label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                        rows={2}
                        placeholder="MAIN REASON FOR VISIT"
                        value={visit.chiefComplaints}
                        onChange={(e) => setVisit((v) => ({ ...v, chiefComplaints: e.target.value }))}
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Symptoms (comma separated)
                      </label>
                      <div className="relative">
                        <AlertCircle className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input
                          className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                          placeholder="FEVER, COUGH, HEADACHE"
                          value={visit.symptoms}
                          onChange={(e) => setVisit((v) => ({ ...v, symptoms: e.target.value }))}
                        />
                      </div>
                      {symOpts.length > 0 && (
                        <div className="absolute z-50 bg-white border border-slate-200 rounded-lg w-full mt-1 shadow-lg max-h-40 overflow-auto">
                          {symOpts.map((s) => (
                            <div
                              key={s}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                acceptSym(s);
                              }}
                            >
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Diagnosis
                      </label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                        rows={2}
                        placeholder="DIAGNOSIS"
                        value={visit.diagnosis}
                        onChange={(e) => setVisit((v) => ({ ...v, diagnosis: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* PRESCRIPTION & FOLLOW-UP */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("prescription")}
                    aria-expanded={expanded.prescription}
                    aria-controls="section-prescription"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-green-600" />
                      Prescription & Follow-up
                    </h3>
                    {expanded.prescription ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  <div
                    id="section-prescription"
                    role="region"
                    className={`p-4 pt-0 space-y-4 transition-all duration-200 ${
                      expanded.prescription ? "max-h-[2000px]" : "max-h-0 overflow-hidden"
                    }`}
                  >
                    {/* Tests */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Tests / Investigations
                      </label>
                      <div className="flex gap-2 mb-2">
                        <div className="relative flex-1">
                          <TestTube className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                            placeholder="TYPE TEST NAME..."
                            value={testForm}
                            onChange={(e) => setTestForm(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTest();
                              }
                            }}
                            aria-label="Add test"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addTest}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[.99] transition"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add
                          </span>
                        </button>
                      </div>

                      {visit.tests && visit.tests.split("\n").filter((t) => t.trim()).length > 0 && (
                        <div className="space-y-1 max-h-32 overflow-auto border border-slate-200 rounded-lg p-2">
                          {visit.tests
                            .split("\n")
                            .filter((t) => t.trim())
                            .map((test, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded text-sm"
                              >
                                <span className="flex-1">{idx + 1}. {test.toUpperCase()}</span>
                                <button
                                  type="button"
                                  onClick={() => removeTest(idx)}
                                  className="ml-2 p-1 rounded hover:bg-red-50"
                                  aria-label={`Remove test ${idx + 1}`}
                                  title="Remove test"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Medicines */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Medicines (auto-formatted)
                      </label>
                      <div className="grid grid-cols-12 gap-2 mb-2">
                        <div className="col-span-12 sm:col-span-5 relative">
                          <Pill className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                            placeholder="MEDICINE NAME..."
                            value={medicineForm.name}
                            onChange={(e) => setMedicineForm((f) => ({ ...f, name: e.target.value }))}
                            aria-label="Medicine name"
                          />
                          {medOpts.length > 0 && (
                            <div className="absolute z-50 bg-white border border-slate-200 rounded-lg w-full mt-1 shadow-lg max-h-40 overflow-auto">
                              {medOpts.map((m) => (
                                <div
                                  key={m}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    acceptMed(m);
                                  }}
                                >
                                  {m}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <select
                            className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={medicineForm.dosage}
                            onChange={(e) => setMedicineForm((f) => ({ ...f, dosage: e.target.value }))}
                            aria-label="Dosage"
                          >
                            <option value="1-1-1">1-1-1</option>
                            <option value="1-0-1">1-0-1</option>
                            <option value="0-1-0">0-1-0</option>
                            <option value="1-0-0">1-0-0</option>
                            <option value="0-0-1">0-0-1</option>
                            <option value="2-2-2">2-2-2</option>
                            <option value="1-1-0">1-1-0</option>
                          </select>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <select
                            className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={medicineForm.timing}
                            onChange={(e) => setMedicineForm((f) => ({ ...f, timing: e.target.value }))}
                            aria-label="Timing"
                          >
                            <option value="AFTER FOOD">AFTER FOOD</option>
                            <option value="BEFORE FOOD">BEFORE FOOD</option>
                            <option value="EMPTY STOMACH">EMPTY STOMACH</option>
                            <option value="WITH FOOD">WITH FOOD</option>
                            <option value="AS NEEDED">AS NEEDED</option>
                          </select>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Days"
                            value={medicineForm.days}
                            onChange={(e) => setMedicineForm((f) => ({ ...f, days: e.target.value }))}
                            aria-label="Days"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-1">
                          <button
                            type="button"
                            onClick={addMedicine}
                            className="w-full px-2 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:scale-[.99] transition"
                            title="Add medicine"
                            aria-label="Add medicine"
                          >
                            <Plus className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>

                      {visit.medicines &&
                        visit.medicines.split("\n").filter((m) => m.trim()).length > 0 && (
                          <div className="space-y-1 max-h-48 overflow-auto border border-slate-200 rounded-lg p-2">
                            {visit.medicines
                              .split("\n")
                              .filter((m) => m.trim())
                              .map((med, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded text-sm"
                                >
                                  <span className="flex-1 font-mono text-xs">
                                    {idx + 1}. {med.toUpperCase()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeMedicine(idx)}
                                    className="ml-2 p-1 rounded hover:bg-red-50"
                                    aria-label={`Remove medicine ${idx + 1}`}
                                    title="Remove medicine"
                                  >
                                    <X className="w-4 h-4 text-red-600" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Advice & Instructions
                      </label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                        rows={3}
                        placeholder="REST FOR 3 DAYS, DRINK PLENTY OF WATER, AVOID COLD DRINKS"
                        value={visit.advice}
                        onChange={(e) => setVisit((v) => ({ ...v, advice: e.target.value }))}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Follow-up Date
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={visit.followUpDate}
                          onChange={(e) => setVisit((v) => ({ ...v, followUpDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Additional Notes
                        </label>
                        <input
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                          placeholder="PRIVATE NOTES"
                          value={visit.notes}
                          onChange={(e) => setVisit((v) => ({ ...v, notes: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={saveVisit}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 active:scale-[.99] transition inline-flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {loading ? "Saving..." : "Save Visit"}
                      </button>
                      <button
                        onClick={printPrescription}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-[.99] transition inline-flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Print Prescription
                      </button>
                    </div>
                  </div>
                </div>

                {/* HISTORY */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("history")}
                    aria-expanded={expanded.history}
                    aria-controls="section-history"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <History className="w-5 h-5 text-purple-600" />
                      Visit History ({(active.visits || []).length})
                    </h3>
                    {expanded.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expanded.history && (
                    <div id="section-history" role="region" className="p-4 pt-0">
                      {(active.visits || []).length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No previous visits</p>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-auto pr-1">
                          {[...active.visits].reverse().map((v, idx) => (
                            <div key={v._id || v.id || idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500 mb-2">
                                {new Date(v.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              {v.diagnosis && (
                                <p className="text-sm">
                                  <span className="font-semibold">Diagnosis:</span> {String(v.diagnosis).toUpperCase()}
                                </p>
                              )}
                              {Array.isArray(v.medicines) && v.medicines.length > 0 && (
                                <p className="text-sm">
                                  <span className="font-semibold">Medicines:</span>{" "}
                                  {v.medicines.map((m) => String(m).toUpperCase()).join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* REPORTS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("reports")}
                    aria-expanded={expanded.reports}
                    aria-controls="section-reports"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-600" />
                      Reports & Documents
                    </h3>
                    {expanded.reports ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expanded.reports && (
                    <div id="section-reports" role="region" className="p-4 pt-0">
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer mb-3 disabled:opacity-60 disabled:cursor-not-allowed">
                        <Upload className="w-4 h-4" />
                        {uploading ? "Uploading..." : newestVisit ? "Upload to Latest Visit" : "Save a Visit First"}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={onUploadReport}
                          disabled={uploading || !newestVisit}
                        />
                      </label>

                      {allReports.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No reports uploaded</p>
                      ) : (
                        <div className="space-y-2">
                          {allReports.map((r, idx) => (
                            <div key={(r.url || "") + idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{r.displayName}</p>
                                <p className="text-[11px] text-slate-500">
                                  Visit:{" "}
                                  {new Date(r.visitDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  className="p-2 rounded hover:bg-blue-50 transition"
                                  title="View"
                                  aria-label="View report"
                                  onClick={() => openReport(r)}
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </button>
                                <button
                                  className="p-2 rounded hover:bg-green-50 transition"
                                  title="Print"
                                  aria-label="Print report"
                                  onClick={() => printReport(r)}
                                >
                                  <Printer className="w-4 h-4 text-green-600" />
                                </button>
                                <button
                                  className="p-2 rounded hover:bg-red-50 transition"
                                  title="Delete"
                                  aria-label="Delete report"
                                  onClick={() => deleteReport(r)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* TEMPLATES */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle("templates")}
                    aria-expanded={expanded.templates}
                    aria-controls="section-templates"
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-teal-600" />
                      Certificates & Templates
                    </h3>
                    {expanded.templates ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {expanded.templates && (
                    <div id="section-templates" role="region" className="p-4 pt-0">
                      <input
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Search templates..."
                        value={tq}
                        onChange={(e) => setTq(e.target.value)}
                        aria-label="Search templates"
                      />

                      <div className="space-y-2 mt-3">
                        {filteredTemplates.map((tpl) => (
                          <div key={tpl.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium">{tpl.title}</p>
                              <p className="text-[11px] text-slate-500">{tpl.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingTpl(tpl)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 active:scale-[.99] transition"
                                aria-label={`Edit ${tpl.title}`}
                                title="Edit before printing"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  const w = window.open("", "_blank");
                                  if (!w) return;
                                  const html = `
                                <html><head><title>${tpl.title}</title>
                                <style>
                                  body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto}
                                  .header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:15px;margin-bottom:30px}
                                  .header h1{margin:0;color:#2563eb;font-size:26px}
                                  .header p{margin:5px 0;color:#666}
                                  .certificate-title{text-align:center;font-size:22px;font-weight:bold;color:#2563eb;margin:30px 0;text-transform:uppercase}
                                  .content{line-height:1.8;margin:20px 0}
                                  .patient-info{margin:20px 0}
                                  .info-row{margin:10px 0}
                                  .label{font-weight:bold}
                                  .footer{margin-top:60px;text-align:right}
                                  .signature-line{border-top:2px solid #333;width:200px;margin:10px 0 5px;display:inline-block}
                                  @media print{body{padding:15px}}
                                </style></head>
                                <body>
                                  <div class="header">
                                    <h1>${templateData.hospitalName}</h1>
                                    <p>${templateData.hospitalAddress}</p>
                                    <p>Phone: ${templateData.hospitalPhone} | Email: ${templateData.hospitalEmail}</p>
                                  </div>

                                  <div class="certificate-title">${tpl.title}</div>

                                  <div class="patient-info">
                                    <div class="info-row"><span class="label">Patient Name:</span> ${String(active.name || "").toUpperCase()}</div>
                                    <div class="info-row"><span class="label">Patient ID:</span> ${active.uniqueId}</div>
                                    <div class="info-row"><span class="label">Date:</span> ${new Date().toLocaleDateString("en-IN",{ day:"2-digit", month:"long", year:"numeric" })}</div>
                                  </div>

                                  <div class="content">
                                    <p>This is to certify that the above-mentioned patient was examined on ${new Date().toLocaleDateString("en-IN")}.</p>
                                    ${visit.diagnosis ? `<p><span class="label">Diagnosis:</span> ${String(visit.diagnosis).toUpperCase()}</p>` : ""}
                                    ${tpl.category === "LEAVE" ? `<p>The patient is advised to take rest for the period of recovery.</p>` : ""}
                                    ${tpl.category === "CERTIFICATE" && tpl.title.includes("Fitness") ? `<p>The patient is found medically fit for all activities.</p>` : ""}
                                    ${templateData.customNote ? `<p>${templateData.customNote}</p>` : ""}
                                  </div>

                                  <div class="footer">
                                    <div class="signature-line"></div>
                                    <p style="margin:5px 0;"><strong>${templateData.doctorName}</strong></p>
                                    <p style="margin:5px 0;">${templateData.designation}</p>
                                    <p style="margin:5px 0;">Registration No: ${templateData.regNo}</p>
                                    <p style="margin:5px 0;color:#666;">Date: ${new Date().toLocaleDateString("en-IN")}</p>
                                  </div>

                                  <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>
                                </body></html>`;
                                  w.document.write(html);
                                  w.document.close();
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[.99] transition inline-flex items-center gap-1"
                                aria-label={`Print ${tpl.title}`}
                                title="Print"
                              >
                                <Printer className="w-3 h-3" />
                                Print
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile action bar */}
      {active && (
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t p-3 flex gap-2">
          <button
            onClick={saveVisit}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold active:scale-[.99]"
          >
            Save
          </button>
          <button
            onClick={printPrescription}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white font-semibold active:scale-[.99]"
          >
            Print
          </button>
        </div>
      )}

      {/* Template editor modal */}
      <TemplateEditor
        open={!!editingTpl}
        tpl={editingTpl}
        value={templateData}
        onClose={() => setEditingTpl(null)}
        onSave={(v) => setTemplateData(v)}
      />
    </div>
  );
}
