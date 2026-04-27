import { useEffect, useState } from 'react';
import { Users, Briefcase, Sheet, LayoutDashboard, Share2 } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { PALETTE } from '../utils/chartTransform.js';
import { fmtDateTime } from '../utils/format.js';

export default function SuperAdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [s, u, w] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/users'),
          api.get('/admin/workspaces'),
        ]);
        setStats(s.data);
        setUsers(u.data.users);
        setWorkspaces(w.data.workspaces);
      } catch {
        toast.error('Could not load admin data');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRole(id, role) {
    try {
      const { data } = await api.patch(`/admin/users/${id}/role`, { role });
      setUsers((arr) => arr.map((u) => (u._id === id ? data.user : u)));
      toast.success('Role updated');
    } catch { toast.error('Failed'); }
  }

  async function setPlan(id, plan) {
    try {
      const { data } = await api.patch(`/admin/workspaces/${id}/plan`, { plan });
      setWorkspaces((arr) => arr.map((w) => (w._id === id ? data.workspace : w)));
      toast.success('Plan updated');
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Super Admin</h1>
        <p className="text-sm text-ink-500 mt-0.5">Global system view.</p>
      </header>

      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat icon={Users} label="Users" value={stats.counts.users} />
            <Stat icon={Briefcase} label="Workspaces" value={stats.counts.workspaces} />
            <Stat icon={Sheet} label="Sheets" value={stats.counts.sheets} />
            <Stat icon={LayoutDashboard} label="Dashboards" value={stats.counts.dashboards} />
            <Stat icon={Share2} label="Share links" value={stats.counts.shares} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="card p-5">
              <div className="font-semibold mb-3">New users (7d)</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={(stats.newUsers || []).map((d) => ({ name: d._id, value: d.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PALETTE[0]} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <div className="font-semibold mb-3">Workspaces by plan</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.plans).map(([name, value]) => ({ name, value }))}
                      dataKey="value" nameKey="name"
                      innerRadius="55%" outerRadius="80%"
                    >
                      {Object.keys(stats.plans).map((_, i) => <Cell key={i} fill={PALETTE[i]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 font-semibold">Users</div>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead className="bg-ink-50 dark:bg-ink-800/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Email</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Workspace</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Role</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                      <td className="px-4 py-2 font-medium">{u.name}</td>
                      <td className="px-4 py-2 text-ink-500">{u.email}</td>
                      <td className="px-4 py-2 text-ink-500">{u.workspaceId?.name || '—'}</td>
                      <td className="px-4 py-2">
                        <select value={u.role} onChange={(e) => setRole(u._id, e.target.value)} className="input py-1 text-xs">
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-ink-500 text-xs">{fmtDateTime(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 font-semibold">Workspaces</div>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead className="bg-ink-50 dark:bg-ink-800/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Owner</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Plan</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((w) => (
                    <tr key={w._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                      <td className="px-4 py-2 font-medium">{w.name}</td>
                      <td className="px-4 py-2 text-ink-500">{w.ownerId?.email || '—'}</td>
                      <td className="px-4 py-2">
                        <select value={w.plan} onChange={(e) => setPlan(w._id, e.target.value)} className="input py-1 text-xs">
                          <option value="free">free</option>
                          <option value="pro">pro</option>
                          <option value="enterprise">enterprise</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-ink-500 text-xs">{fmtDateTime(w.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">{label}</div>
          <div className="text-2xl font-extrabold mt-1">{value}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
