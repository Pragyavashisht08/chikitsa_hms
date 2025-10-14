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

function Home(){ return (<div className="p-6"><h1 className="text-2xl font-bold">Welcome to CHIKITSA</h1><p className="text-gray-600">Mock mode is ON (no backend). Sign up and try dashboards.</p>
  <div className="mt-3 space-x-3 text-sm"><Link to="/dashboard/frontdesk" className="underline">Frontdesk</Link><Link to="/dashboard/doctor" className="underline">Doctor</Link><Link to="/dashboard/admin" className="underline">Admin</Link></div>
</div>); }

export default function App(){ return (
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
); }
