import { useEffect, useState } from "react";
export default function AdminDashboard(){
  const [users] = useState(() => JSON.parse(localStorage.getItem("users")||"[]"));
  useEffect(()=>{},[]);
  return (<div className="p-6"><h1 className="text-2xl font-bold mb-4">Admin</h1>
    <table className="w-full border text-sm"><thead className="bg-gray-100"><tr><th className="p-2 border">Name</th><th className="p-2 border">Email</th><th className="p-2 border">Role</th></tr></thead><tbody>{users.map(u=> (<tr key={u.id}><td className="p-2 border">{u.name}</td><td className="p-2 border">{u.email}</td><td className="p-2 border">{u.role}</td></tr>))}</tbody></table>
  </div>);
}
