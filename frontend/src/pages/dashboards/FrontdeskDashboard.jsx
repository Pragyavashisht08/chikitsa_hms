import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  User,
  Phone,
  Search,
  Calendar,
  Plus,
  ClipboardList,
  History,
  X,
} from "lucide-react";
import api, { getPatients, createPatient } from "../../lib/api";



/* ------------ Utils ------------ */
const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const todayStr = () => new Date().toISOString().slice(0, 10);

function makeId(name, phone) {
  const N = (name || "").replace(/\s+/g, "").toUpperCase();
  const P = (phone || "").replace(/\D+/g, "");
  return N && P ? `${N}_${P}` : "";
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ------------ Page ------------ */
export default function FrontdeskDashboard() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState(todayStr());
  // Default OFF so patients load even if none registered today
  const [onlyToday, setOnlyToday] = useState(false);

  // Separate loading flags so buttons don't get stuck
  const [listLoading, setListLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showMobilePatient, setShowMobilePatient] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "" });
  const uniqueId = useMemo(() => makeId(form.name, form.phone), [form.name, form.phone]);
  const phoneValid = /^\d{10}$/.test((form.phone || "").replace(/\D+/g, ""));
  const canCreatePatient = !!uniqueId && phoneValid && form.name.trim().length > 0;

  const [active, setActive] = useState(null);
  // keep currently selected id in a ref (optional, for rehydrate if you add it later)
  const activeIdRef = useRef(null);

  const [visit, setVisit] = useState({
    symptoms: "",
    bpS: "",
    bpD: "",
    payAmount: "",
    payMode: "CASH",
    payStatus: "PENDING",
    notes: "",
  });

  const debouncedQ = useDebounce(q, 400);

  const fromISO = useMemo(
    () => (onlyToday && date ? new Date(`${date}T00:00:00.000Z`).toISOString() : ""),
    [onlyToday, date]
  );
  const toISO = useMemo(
    () => (onlyToday && date ? new Date(`${date}T23:59:59.999Z`).toISOString() : ""),
    [onlyToday, date]
  );

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { q: debouncedQ };
      if (onlyToday && date) {
        params.from = fromISO;
        params.to = toISO;
      }
      const res = await api.get("/patients", { params });
      const data = Array.isArray(res.data) ? res.data : [];

      // ✅ normalize: ensure both id and _id exist; prefer _id for backend calls
      const normalized = data.map((p) => {
        const _id = p._id || p.id || p.uniqueId || String(p.phone || "");
        return {
          id: _id,                 // for React keys and equality checks
          _id,                     // for API paths when backend expects Mongo _id
          uniqueId: p.uniqueId,
          name: p.name,
          phone: p.phone,
          registeredAt: p.registeredAt || p.createdAt || new Date().toISOString(),
          visits: Array.isArray(p.visits) ? p.visits : [],
        };
      });

      setList(normalized);

      // (Optional) rehydrate selection: if we had a selected id, refresh that object
      if (activeIdRef.current) {
        const fresh = normalized.find((p) => p.id === activeIdRef.current);
        if (fresh) setActive(fresh);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to load patients.");
    } finally {
      setListLoading(false);
    }
  }, [debouncedQ, onlyToday, date, fromISO, toISO]);

  // 🔁 load data on first render and whenever filters change
  useEffect(() => {
    load();
  }, [load]);

  const createPatient = async (e) => {
    e.preventDefault();
    if (!canCreatePatient || creating) return;

    setCreating(true);
    try {
      const payload = {
        uniqueId,
        name: (form.name || "").toUpperCase(),
        phone: (form.phone || "").replace(/\D+/g, ""),
      };
      const res = await api.post("/patients", payload);
      const p = res.data;

      setForm({ name: "", phone: "" });

      // normalize response
      const _id = p._id || p.id || p.uniqueId || String(p.phone || "");
      const newActive = {
        id: _id,
        _id,
        uniqueId: p.uniqueId,
        name: p.name,
        phone: p.phone,
        registeredAt: p.registeredAt || p.createdAt || new Date().toISOString(),
        visits: Array.isArray(p.visits) ? p.visits : [],
      };
      setActive(newActive);
      activeIdRef.current = newActive.id;

      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not create patient.");
    } finally {
      setCreating(false);
    }
  };

  const addVisit = async (e) => {
    e.preventDefault();
    if (!active || saving) return;

    setSaving(true);
    try {
      const payload = {
        date: new Date().toISOString(),
        symptoms: visit.symptoms,
        bp: {
          systolic: visit.bpS ? Number(visit.bpS) : undefined,
          diastolic: visit.bpD ? Number(visit.bpD) : undefined,
        },
        payment: {
          amount: visit.payAmount ? Number(visit.payAmount) : undefined,
          mode: visit.payMode,
          status: visit.payStatus,
        },
        notes: visit.notes,
      };

      // ✅ prefer _id for API path
      const path = `/patients/${active._id || active.id}/visits`;
      const res = await api.post(path, payload);
      const p = res.data;

      const _id = p._id || p.id || p.uniqueId || String(p.phone || "");
      const updated = {
        id: _id,
        _id,
        uniqueId: p.uniqueId,
        name: p.name,
        phone: p.phone,
        registeredAt: p.registeredAt || p.createdAt || new Date().toISOString(),
        visits: Array.isArray(p.visits) ? p.visits : [],
      };
      setActive(updated);
      activeIdRef.current = updated.id;

      setVisit({
        symptoms: "",
        bpS: "",
        bpD: "",
        payAmount: "",
        payMode: "CASH",
        payStatus: "PENDING",
        notes: "",
      });
      await load();
      alert("Visit added successfully!");
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not add visit.");
    } finally {
      setSaving(false);
    }
  };

  const clearActive = () => {
    setActive(null);
    activeIdRef.current = null;
    setShowMobilePatient(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6 lg:pb-8">
        {/* Header block (kept as in your UI) */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
                Frontdesk Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">Patient Registration & Triage</p>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Total Patients:</span>
              <span className="text-lg font-bold text-blue-600">{list.length}</span>
            </div>
          </div>
        </div>

        {/* Patient Registration */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Patient Registration
          </h2>
          <form
            onSubmit={createPatient}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Patient Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition uppercase text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D+/g, "").slice(0, 10),
                    })
                  }
                  placeholder="10-digit mobile"
                />
              </div>
              {!phoneValid && form.phone && (
                <p className="text-xs text-red-600 mt-1">Must be exactly 10 digits</p>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition shadow-sm flex items-center justify-center gap-2 text-sm"
                disabled={!canCreatePatient || creating}
              >
                {creating ? "Processing..." : "Add Patient"}
              </button>
            </div>
            {uniqueId && (
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Unique ID (Auto-generated)
                </label>
                <input
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm text-gray-600"
                  value={uniqueId}
                  readOnly
                />
              </div>
            )}
          </form>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            Search & Filter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  placeholder="Name, Phone, or ID..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!onlyToday}
                />
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition w-full">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  checked={onlyToday}
                  onChange={(e) => setOnlyToday(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">Today Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Patient List
            </h2>
          </div>

          {listLoading && (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-600 mt-2">Loading patients...</p>
            </div>
          )}

          {!listLoading && list.length === 0 && (
            <div className="p-8 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No patients found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your filters or add a new patient
              </p>
            </div>
          )}

          {!listLoading && list.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Unique ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Registered
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Visits
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {list.map((p) => (
                      <tr
                        key={p.id}
                        className={`cursor-pointer transition ${
                          active && active.id === p.id
                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          setActive(p);
                          activeIdRef.current = p.id; // keep track for optional rehydrate
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-sm text-gray-900">
                          {p.uniqueId}
                        </td>
                        <td className="px-4 py-3 font-medium text-sm text-gray-900">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {fmtDateTime(p.registeredAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {(p.visits || []).length}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-200">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 cursor-pointer transition ${
                      active && active.id === p.id
                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setActive(p);
                      activeIdRef.current = p.id;
                      setShowMobilePatient(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {(p.visits || []).length} visits
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="font-mono">{p.uniqueId}</p>
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fmtDateTime(p.registeredAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Triage and History - Desktop */}
        {active && (
          <div className="hidden md:grid md:grid-cols-2 gap-6">
            {/* Triage Form */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  Reception Triage
                </h2>
                <button
                  onClick={clearActive}
                  className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                  title="Close patient pane"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>

              <form onSubmit={addVisit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Symptoms
                  </label>
                  <input
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                    value={visit.symptoms}
                    onChange={(e) => setVisit({ ...visit, symptoms: e.target.value })}
                    placeholder="Fever, cough, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      BP Systolic
                    </label>
                    <input
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      inputMode="numeric"
                      value={visit.bpS}
                      onChange={(e) =>
                        setVisit({ ...visit, bpS: e.target.value.replace(/\D+/g, "") })
                      }
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      BP Diastolic
                    </label>
                    <input
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      inputMode="numeric"
                      value={visit.bpD}
                      onChange={(e) =>
                        setVisit({ ...visit, bpD: e.target.value.replace(/\D+/g, "") })
                      }
                      placeholder="80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Amount (₹)
                    </label>
                    <input
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      inputMode="numeric"
                      value={visit.payAmount}
                      onChange={(e) =>
                        setVisit({
                          ...visit,
                          payAmount: e.target.value.replace(/[^\d.]/g, ""),
                        })
                      }
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                      value={visit.payMode}
                      onChange={(e) => setVisit({ ...visit, payMode: e.target.value })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Payment Status
                  </label>
                  <select
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                    value={visit.payStatus}
                    onChange={(e) => setVisit({ ...visit, payStatus: e.target.value })}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Notes for Doctor
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                    rows={3}
                    value={visit.notes}
                    onChange={(e) => setVisit({ ...visit, notes: e.target.value })}
                    placeholder="Any important information..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition shadow-sm text-sm"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Visit & Send to Doctor"}
                </button>
              </form>
            </div>

            {/* Previous Visits */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Previous Visits
              </h2>
              {!active?.visits?.length ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No previous visits</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-auto pr-2">
                  {[...active.visits]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((v) => (
                      <div
                        key={v.id || v.date}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmtDateTime(v.date)}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          {v.symptoms && (
                            <p>
                              <span className="font-semibold text-gray-900">Symptoms:</span>{" "}
                              <span className="text-gray-700">{v.symptoms}</span>
                            </p>
                          )}
                          {(v?.bp?.systolic || v?.bp?.diastolic) && (
                            <p>
                              <span className="font-semibold text-gray-900">BP:</span>{" "}
                              <span className="text-gray-700">
                                {v?.bp?.systolic || "-"}/{v?.bp?.diastolic || "-"}
                              </span>
                            </p>
                          )}
                          {(v?.payment?.amount != null || v?.payment?.status) && (
                            <p>
                              <span className="font-semibold text-gray-900">Payment:</span>{" "}
                              <span className="text-gray-700">
                                ₹{v?.payment?.amount ?? 0} · {v?.payment?.mode || "CASH"} ·{" "}
                                {v?.payment?.status || "PENDING"}
                              </span>
                            </p>
                          )}
                          {v.notes && (
                            <p>
                              <span className="font-semibold text-gray-900">Notes:</span>{" "}
                              <span className="text-gray-700">{v.notes}</span>
                            </p>
                          )}
                          {v.diagnosis && (
                            <p>
                              <span className="font-semibold text-gray-900">Diagnosis:</span>{" "}
                              <span className="text-gray-700">{v.diagnosis}</span>
                            </p>
                          )}
                          {!!(v.tests || []).length && (
                            <p>
                              <span className="font-semibold text-gray-900">Tests:</span>{" "}
                              <span className="text-gray-700">{(v.tests || []).join(", ")}</span>
                            </p>
                          )}
                          {v.advice && (
                            <p>
                              <span className="font-semibold text-gray-900">Advice:</span>{" "}
                              <span className="text-gray-700">{v.advice}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Modal for Patient Details */}
        {showMobilePatient && active && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Patient Details</h2>
                <button
                  onClick={() => setShowMobilePatient(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Triage Form */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    Reception Triage
                  </h3>
                  <form onSubmit={addVisit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Symptoms
                      </label>
                      <input
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        value={visit.symptoms}
                        onChange={(e) => setVisit({ ...visit, symptoms: e.target.value })}
                        placeholder="Fever, cough, etc."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          BP Systolic
                        </label>
                        <input
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          inputMode="numeric"
                          value={visit.bpS}
                          onChange={(e) =>
                            setVisit({ ...visit, bpS: e.target.value.replace(/\D+/g, "") })
                          }
                          placeholder="120"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          BP Diastolic
                        </label>
                        <input
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          inputMode="numeric"
                          value={visit.bpD}
                          onChange={(e) =>
                            setVisit({ ...visit, bpD: e.target.value.replace(/\D+/g, "") })
                          }
                          placeholder="80"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Amount (₹)
                        </label>
                        <input
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          inputMode="numeric"
                          value={visit.payAmount}
                          onChange={(e) =>
                            setVisit({
                              ...visit,
                              payAmount: e.target.value.replace(/[^\d.]/g, ""),
                            })
                          }
                          placeholder="300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Payment Mode
                        </label>
                        <select
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          value={visit.payMode}
                          onChange={(e) => setVisit({ ...visit, payMode: e.target.value })}
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Payment Status
                      </label>
                      <select
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        value={visit.payStatus}
                        onChange={(e) => setVisit({ ...visit, payStatus: e.target.value })}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Notes for Doctor
                      </label>
                      <textarea
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={3}
                        value={visit.notes}
                        onChange={(e) => setVisit({ ...visit, notes: e.target.value })}
                        placeholder="Any important information..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition text-sm"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Visit & Send to Doctor"}
                    </button>
                  </form>
                </div>

                {/* Previous Visits */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    Previous Visits
                  </h3>
                  {!active?.visits?.length ? (
                    <div className="text-center py-8">
                      <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">No previous visits</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...active.visits]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((v) => (
                          <div
                            key={v.id || v.date}
                            className="border border-gray-200 rounded-lg p-3"
                          >
                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {fmtDateTime(v.date)}
                            </div>
                            <div className="space-y-1.5 text-sm">
                              {v.symptoms && (
                                <p>
                                  <span className="font-semibold text-gray-900">Symptoms:</span>{" "}
                                  <span className="text-gray-700">{v.symptoms}</span>
                                </p>
                              )}
                              {(v?.bp?.systolic || v?.bp?.diastolic) && (
                                <p>
                                  <span className="font-semibold text-gray-900">BP:</span>{" "}
                                  <span className="text-gray-700">
                                    {v?.bp?.systolic || "-"}/{v?.bp?.diastolic || "-"}
                                  </span>
                                </p>
                              )}
                              {(v?.payment?.amount != null || v?.payment?.status) && (
                                <p>
                                  <span className="font-semibold text-gray-900">Payment:</span>{" "}
                                  <span className="text-gray-700">
                                    ₹{v?.payment?.amount ?? 0} · {v?.payment?.mode || "CASH"} ·{" "}
                                    {v?.payment?.status || "PENDING"}
                                  </span>
                                </p>
                              )}
                              {v.notes && (
                                <p>
                                  <span className="font-semibold text-gray-900">Notes:</span>{" "}
                                  <span className="text-gray-700">{v.notes}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
