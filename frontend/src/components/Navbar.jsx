import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Navbar(){ const { user, logout } = useAuth(); return (
  <nav className="w-full bg-black text-white px-4 py-3 flex items-center justify-between">
    <Link to="/" className="font-bold">CHIKITSA</Link>
    <div className="flex items-center gap-4">
      {user && <span className="text-sm">{user.name} · {user.role}</span>}
      {user ? <button onClick={logout} className="bg-brand-orange px-3 py-1 rounded">Logout</button> : (<>
        <Link to="/login">Login</Link>
        <Link to="/signup" className="bg-brand-orange px-3 py-1 rounded">Sign up</Link>
      </>)}
    </div>
  </nav>
); }
