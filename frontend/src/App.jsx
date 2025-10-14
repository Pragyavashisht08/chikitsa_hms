import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import DoctorDashboard from "./pages/dashboards/DoctorDashboard";
import FrontdeskDashboard from "./pages/dashboards/FrontdeskDashboard";

function Home(){
  return (
    <main className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10 items-center">
      <section className="space-y-5">
        <h1 className="text-4xl font-extrabold text-brand-dark leading-tight">
          Simple, fast & secure <span className="text-brand-primary">Hospital</span> Management
        </h1>
        <p className="text-slate-600">
          Role-based dashboards for Frontdesk, Doctors and Admins. Manage patients, visits and records effortlessly.
        </p>
        <div className="flex gap-3">
          <Link to="/signup" className="btn btn-primary">Create account</Link>
          <Link to="/login" className="btn bg-white border border-slate-200 hover:bg-slate-50">Login</Link>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-3xl">🏥</div>
          <div>
            <div className="font-bold text-lg">Trusted by clinics</div>
            <div className="text-slate-500 text-sm">Clean UI · Secure JWT · MongoDB Atlas</div>
          </div>
        </div>
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          {["Frontdesk","Doctor","Admin"].map((r)=>(
            <Link key={r} to={`/dashboard/${r.toLowerCase()}`} className="rounded-xl border border-slate-200 p-4 hover:border-brand-primary hover:shadow-soft">
              <div className="font-semibold">{r} Dashboard</div>
              <div className="text-xs text-slate-500">Explore</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar/>
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/signup" element={<Signup/>}/>

          <Route element={<ProtectedRoute/>}>
            <Route element={<RoleRoute allow={["FRONTDESK","ADMIN"]}/>}>
              <Route path="/dashboard/frontdesk" element={<FrontdeskDashboard/>}/>
            </Route>
            <Route element={<RoleRoute allow={["DOCTOR","ADMIN"]}/>}>
              <Route path="/dashboard/doctor" element={<DoctorDashboard/>}/>
            </Route>
            <Route element={<RoleRoute allow={["ADMIN"]}/>}>
              <Route path="/dashboard/admin" element={<AdminDashboard/>}/>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
