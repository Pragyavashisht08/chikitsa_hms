import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar(){
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-white font-bold">＋</span>
          <span className="font-extrabold tracking-wide text-brand-dark">CHIKITSA</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NavLink to="/dashboard/frontdesk" className="btn btn-ghost">Frontdesk</NavLink>
              <NavLink to="/dashboard/doctor" className="btn btn-ghost">Doctor</NavLink>
              <NavLink to="/dashboard/admin" className="btn btn-ghost">Admin</NavLink>
              <span className="text-sm text-slate-600 hidden sm:block">• {user.name} · {user.role}</span>
              <button onClick={logout} className="btn bg-white border border-slate-200 hover:bg-slate-50">Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn">Login</NavLink>
              <NavLink to="/signup" className="btn btn-primary">Sign up</NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
