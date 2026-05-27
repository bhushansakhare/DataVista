import { useEffect, useMemo, useState } from 'react';
import { Users, Briefcase, Sheet, LayoutDashboard, Share2, Trash2, Plus, Edit3, CreditCard } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { PALETTE } from '../utils/chartTransform.js';
import { fmtDateTime } from '../utils/format.js';

// Admin tables paginate at 5/page per spec.
const ADMIN_PAGE_SIZE = 5;

function paginate(list, page, size) {
  const total = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(total, Math.max(1, page));
  return {
    visible: list.slice((safePage - 1) * size, safePage * size),
    totalPages: total,
  };
}
function clampPage(page, listLength, size = ADMIN_PAGE_SIZE) {
  const total = Math.max(1, Math.ceil(listLength / size));
  return Math.min(total, Math.max(1, page));
}

export default function SuperAdminPage() {
  const { user: me } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [plans, setPlans] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name } | null
  const [editingPlan, setEditingPlan] = useState(null); // plan object or 'new'
  // Per-table page state. Reset to 1 whenever the underlying list shrinks
  // below the current page (e.g., delete on last row).
  const [usersPage, setUsersPage] = useState(1);
  const [wsPage, setWsPage] = useState(1);
  const [plansPage, setPlansPage] = useState(1);
  const toast = useToast();

  const usersView      = useMemo(() => paginate(users,      usersPage, ADMIN_PAGE_SIZE), [users, usersPage]);
  const workspacesView = useMemo(() => paginate(workspaces, wsPage,    ADMIN_PAGE_SIZE), [workspaces, wsPage]);
  const plansView      = useMemo(() => paginate(plans,      plansPage, ADMIN_PAGE_SIZE), [plans, plansPage]);

  useEffect(() => { setUsersPage((p) => clampPage(p, users.length)); }, [users.length]);
  useEffect(() => { setWsPage((p) => clampPage(p, workspaces.length)); }, [workspaces.length]);
  useEffect(() => { setPlansPage((p) => clampPage(p, plans.length)); }, [plans.length]);

  async function reload() {
    try {
      const [s, u, w, p] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/workspaces'),
        api.get('/plans/admin'),
      ]);
      setStats(s.data);
      setUsers(u.data.users);
      setWorkspaces(w.data.workspaces);
      setPlans(p.data.plans);
    } catch {
      toast.error('Could not load admin data');
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

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

  async function deleteUser(id) {
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((arr) => arr.filter((u) => u._id !== id));
      toast.success('User deleted');
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete');
    }
  }

  async function deletePlan(id) {
    if (!confirm('Delete this plan? Existing users keep their plan reference but it will be a dangling pointer.')) return;
    try {
      await api.delete(`/plans/admin/${id}`);
      setPlans((arr) => arr.filter((p) => p._id !== id));
      toast.success('Plan deleted');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function savePlan(planData) {
    try {
      if (planData._id) {
        const { data } = await api.patch(`/plans/admin/${planData._id}`, planData);
        setPlans((arr) => arr.map((p) => (p._id === planData._id ? data.plan : p)));
        toast.success('Plan updated');
      } else {
        const { data } = await api.post('/plans/admin', planData);
        setPlans((arr) => [...arr, data.plan]);
        toast.success('Plan created');
      }
      setEditingPlan(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed');
    }
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

          {/* ── Plans CRUD ───────────────────────────────────────────── */}
          <div className="card mt-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <CreditCard className="w-4 h-4 text-ink-500" /> Plans
              </div>
              <button onClick={() => setEditingPlan('new')} className="btn-primary inline-flex items-center gap-1.5 text-xs">
                <Plus className="w-4 h-4" /> New plan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead className="bg-ink-50 dark:bg-ink-800/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Price</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Period</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Credits</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Dashboards</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Visibility</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Default</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-ink-500">
                      No plans yet. Click "New plan" to add Free / Pro / Business tiers.
                    </td></tr>
                  )}
                  {plansView.visible.map((p) => (
                    <tr key={p._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2">{p.price === 0 ? 'Free' : `${p.currency === 'USD' ? '$' : ''}${p.price}`}</td>
                      <td className="px-4 py-2 text-ink-500">{p.period}</td>
                      <td className="px-4 py-2">{p.credits === -1 ? '∞' : p.credits}</td>
                      <td className="px-4 py-2">{p.dashboardLimit === 0 ? '∞' : p.dashboardLimit}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                          p.isPublic
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-ink-200 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                        }`}>
                          {p.isPublic ? 'public' : 'hidden'}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.isDefault ? '✓' : ''}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditingPlan(p)} className="btn-ghost p-1.5" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deletePlan(p._id)} className="btn-ghost p-1.5 text-rose-500" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3">
              <Pagination page={plansPage} totalPages={plansView.totalPages} onChange={setPlansPage} />
            </div>
          </div>

          {/* ── Users with delete ────────────────────────────────────── */}
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
                    <th className="text-left px-4 py-2.5 font-semibold">Credits</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Joined</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {usersView.visible.map((u) => {
                    const isSelf = String(u._id) === String(me?._id);
                    return (
                      <tr key={u._id} className="border-t border-ink-200/60 dark:border-ink-800/60">
                        <td className="px-4 py-2 font-medium">{u.name}</td>
                        <td className="px-4 py-2 text-ink-500">{u.email}</td>
                        <td className="px-4 py-2 text-ink-500">{u.workspaceId?.name || '—'}</td>
                        <td className="px-4 py-2">
                          <select value={u.role} onChange={(e) => setRole(u._id, e.target.value)} className="input py-1 text-xs" disabled={isSelf}>
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-ink-500">{u.credits ?? 0}</td>
                        <td className="px-4 py-2 text-ink-500 text-xs">{fmtDateTime(u.createdAt)}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => setConfirmDelete({ id: u._id, name: u.name })}
                            disabled={isSelf}
                            title={isSelf ? 'Use Settings → Delete account to remove yourself' : 'Delete user'}
                            className="btn-ghost p-1.5 text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3">
              <Pagination page={usersPage} totalPages={usersView.totalPages} onChange={setUsersPage} />
            </div>
          </div>

          {/* ── Workspaces ──────────────────────────────────────────── */}
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
                  {workspacesView.visible.map((w) => (
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
            <div className="px-4 pb-3">
              <Pagination page={wsPage} totalPages={workspacesView.totalPages} onChange={setWsPage} />
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDeleteUserModal
          name={confirmDelete.name}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteUser(confirmDelete.id)}
        />
      )}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan === 'new' ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={savePlan}
        />
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

function ConfirmDeleteUserModal({ name, onCancel, onConfirm }) {
  const [text, setText] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-5 space-y-3">
        <h3 className="font-bold text-lg text-rose-600 dark:text-rose-400">Delete user</h3>
        <p className="text-sm text-ink-600 dark:text-ink-300">
          This deletes <strong>{name}</strong> and cascades: workspace, sheets, dashboards, templates, shares, referrals.
          This cannot be undone.
        </p>
        <div className="text-xs text-ink-600 dark:text-ink-300">
          Type the user's name (<span className="font-mono">{name}</span>) to confirm.
        </div>
        <input className="input w-full" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            disabled={text !== name}
            onClick={onConfirm}
            className="btn-primary bg-rose-500 hover:bg-rose-600"
          >
            Delete user
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    name: plan?.name || '',
    slug: plan?.slug || '',
    price: plan?.price ?? 0,
    currency: plan?.currency || 'USD',
    period: plan?.period || 'month',
    description: plan?.description || '',
    features: (plan?.features || []).join('\n'),
    credits: plan?.credits ?? 0,
    dashboardLimit: plan?.dashboardLimit ?? 0,
    isPublic: plan?.isPublic ?? true,
    isDefault: plan?.isDefault ?? false,
    sortOrder: plan?.sortOrder ?? 0,
  }));

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    onSave({
      ...(plan?._id ? { _id: plan._id } : {}),
      ...form,
      price: Number(form.price),
      credits: Number(form.credits),
      dashboardLimit: Number(form.dashboardLimit),
      sortOrder: Number(form.sortOrder),
      features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="card max-w-2xl w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">{plan ? 'Edit plan' : 'New plan'}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PField label="Name *">
            <input required className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </PField>
          <PField label="Slug (auto if blank)">
            <input className="input w-full" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </PField>
          <PField label="Price">
            <input type="number" min="0" step="0.01" className="input w-full" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </PField>
          <PField label="Currency">
            <input className="input w-full" value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={3} />
          </PField>
          <PField label="Period">
            <select className="input w-full" value={form.period} onChange={(e) => set('period', e.target.value)}>
              <option value="month">month</option>
              <option value="year">year</option>
              <option value="one_time">one-time</option>
            </select>
          </PField>
          <PField label="Sort order">
            <input type="number" className="input w-full" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </PField>
          <PField label="Credits (-1 = unlimited)">
            <input type="number" className="input w-full" value={form.credits} onChange={(e) => set('credits', e.target.value)} />
          </PField>
          <PField label="Dashboard limit (0 = unlimited)">
            <input type="number" min="0" className="input w-full" value={form.dashboardLimit} onChange={(e) => set('dashboardLimit', e.target.value)} />
          </PField>
        </div>

        <PField label="Description">
          <textarea rows={2} className="input w-full" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </PField>
        <PField label="Features (one per line)">
          <textarea rows={5} className="input w-full font-mono text-xs" value={form.features} onChange={(e) => set('features', e.target.value)} />
        </PField>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPublic} onChange={(e) => set('isPublic', e.target.checked)} />
            Public (shown on /pricing)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
            Default plan (auto-assigned on signup)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">{plan ? 'Save changes' : 'Create plan'}</button>
        </div>
      </form>
    </div>
  );
}

function PField({ label, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-bold text-ink-600 dark:text-ink-300 mb-1">{label}</div>
      {children}
    </label>
  );
}
