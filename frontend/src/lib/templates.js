// frontend/src/lib/templates.js

// ---------- helpers ----------
function pad(n){ return n < 10 ? "0"+n : String(n); }
function fmtDate(d){
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return `${pad(dt.getDate())}-${pad(dt.getMonth()+1)}-${dt.getFullYear()}`;
  } catch { return ""; }
}

// Replace {{PLACEHOLDER}} with values from patient + visit + now context
function fillPlaceholders(html, patient = {}, ctx = {}) {
  const visit = ctx.visit || {};
  const now = ctx.now || new Date();

  const map = {
    NAME:        String(patient.name || "").toUpperCase(),
    PHONE:       String(patient.phone || ""),
    UNIQUE_ID:   String(patient.uniqueId || ""),
    TODAY:       fmtDate(now),

    // visit fields (uppercased where text-like)
    SYMPTOMS:    String(visit.symptoms || "").toUpperCase(),
    DIAGNOSIS:   String(visit.diagnosis || "").toUpperCase(),
    TESTS:       String(visit.tests || ""),
    MEDICINES:   String(visit.medicines || ""),
    ADVICE:      String(visit.advice || "").toUpperCase(),
  };

  return html.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_, key) => map[key] ?? "");
}

// basic print-friendly shell
function wrapDoc(title, bodyHtml){
  return `
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        :root{ --brand:#0B6E99; }
        body{ font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #0f172a; }
        h1,h2,h3{ margin: 0 0 12px }
        .muted{ color:#64748b }
        .row{ margin:6px 0 }
        .box{ border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin:12px 0 }
        .head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px }
        .brand{ color: var(--brand); font-weight: 800; letter-spacing: 0.5px }
        table { width: 100%; border-collapse: collapse; }
        th, td{ border:1px solid #e2e8f0; padding:8px; text-align:left }
        .right{ text-align:right }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
  </html>`;
}

// ---------- templates ----------
const RAW_TEMPLATES = [
  {
    id: "LEAVE_CERT",
    title: "Leave Certificate",
    category: "Certificate",
    keywords: ["leave","rest","time off","certificate"],
    html: wrapDoc("LEAVE CERTIFICATE", `
      <div class="head">
        <h1 class="brand">LEAVE CERTIFICATE</h1>
        <div class="muted">DATE: {{TODAY}}</div>
      </div>
      <div class="box">
        <div class="row"><b>PATIENT:</b> {{NAME}} (ID: {{UNIQUE_ID}}) · PHONE: {{PHONE}}</div>
        <div class="row">This is to certify that <b>{{NAME}}</b> is advised leave on medical grounds.</div>
        <div class="row"><b>DIAGNOSIS:</b> {{DIAGNOSIS}}</div>
        <div class="row"><b>ADVICE:</b> {{ADVICE}}</div>
      </div>
      <div class="row right muted">Signature &amp; Stamp</div>
    `)
  },
  {
    id: "DISCHARGE_SUMMARY",
    title: "Discharge Summary",
    category: "Report",
    keywords: ["discharge","summary","report","hospitalisation"],
    html: wrapDoc("DISCHARGE SUMMARY", `
      <div class="head">
        <h1 class="brand">DISCHARGE SUMMARY</h1>
        <div class="muted">DATE: {{TODAY}}</div>
      </div>
      <div class="box">
        <div class="row"><b>PATIENT:</b> {{NAME}} (ID: {{UNIQUE_ID}}) · PHONE: {{PHONE}}</div>
        <div class="row"><b>SYMPTOMS ON ADMISSION:</b> {{SYMPTOMS}}</div>
        <div class="row"><b>FINAL DIAGNOSIS:</b> {{DIAGNOSIS}}</div>
        <div class="row"><b>TESTS DONE:</b> {{TESTS}}</div>
        <div class="row"><b>MEDICINES GIVEN:</b> {{MEDICINES}}</div>
        <div class="row"><b>ADVICE ON DISCHARGE:</b> {{ADVICE}}</div>
      </div>
      <div class="row right muted">Doctor's Signature</div>
    `)
  },
  {
    id: "FITNESS_CERT",
    title: "Fitness Certificate",
    category: "Certificate",
    keywords: ["fitness","fit","certificate"],
    html: wrapDoc("FITNESS CERTIFICATE", `
      <div class="head">
        <h1 class="brand">FITNESS CERTIFICATE</h1>
        <div class="muted">DATE: {{TODAY}}</div>
      </div>
      <div class="box">
        <div class="row"><b>PATIENT:</b> {{NAME}} (ID: {{UNIQUE_ID}}) · PHONE: {{PHONE}}</div>
        <div class="row">On examination, <b>{{NAME}}</b> is found <b>FIT</b> for duty with the following notes:</div>
        <div class="row"><b>DIAGNOSIS / REMARKS:</b> {{DIAGNOSIS}}</div>
      </div>
      <div class="row right muted">Doctor's Signature</div>
    `)
  },
  {
    id: "OPD_PRESCRIPTION",
    title: "OPD Prescription",
    category: "OPD",
    keywords: ["opd","prescription","rx"],
    html: wrapDoc("OPD PRESCRIPTION", `
      <div class="head">
        <h1 class="brand">OPD PRESCRIPTION</h1>
        <div class="muted">DATE: {{TODAY}}</div>
      </div>
      <div class="box">
        <div class="row"><b>PATIENT:</b> {{NAME}} (ID: {{UNIQUE_ID}}) · PHONE: {{PHONE}}</div>
        <div class="row"><b>SYMPTOMS:</b> {{SYMPTOMS}}</div>
        <div class="row"><b>DIAGNOSIS:</b> {{DIAGNOSIS}}</div>
        <div class="row"><b>TESTS:</b> {{TESTS}}</div>
        <div class="row"><b>MEDICINES:</b> {{MEDICINES}}</div>
        <div class="row"><b>ADVICE:</b> {{ADVICE}}</div>
      </div>
      <div class="row right muted">Doctor's Signature</div>
    `)
  }
];

// Build function injected later (to use ctx)
export const TEMPLATES = RAW_TEMPLATES.map(t => ({
  ...t,
  build: (patient, ctx) => fillPlaceholders(t.html, patient, ctx),
}));

export function searchTemplates(query = "") {
  const q = String(query).trim().toLowerCase();
  if (!q) return TEMPLATES;
  return TEMPLATES.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    (t.keywords || []).some(k => k.toLowerCase().includes(q))
  );
}
