import { useEffect, useState } from "react";

export default function AdminDashboard(){
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("users") || "[]");
    setUsers(u);
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark">Admin</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-light/60 text-slate-700">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/40">
            {users.map(u=>(
              <tr key={u.id} className="border-b border-slate-100">
                <td className="p-2">{(u.name || "").toUpperCase()}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{(u.role || "").toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
