import { FormEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { departmentApi, userApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Pagination, Select } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type { Role, User } from "../../types";
import { cn } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

interface CreateForm { name: string; email: string; password: string; departmentId: string }

// One page for both "Employees" and "Customers": only the role and a few columns differ.
export default function UsersAdminPage({ role }: { role: Extract<Role, "EMPLOYEE" | "CUSTOMER"> }) {
  const isEmployee = role === "EMPLOYEE";
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [toggle, setToggle] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const users = useAsync(() => userApi.list({ role, page, limit: 15, q: applied }), [role, page, applied]);
  const depts = useAsync(() => (isEmployee ? departmentApi.list() : Promise.resolve([])), [isEmployee]);
  const deptName = (id?: string) => depts.data?.find((d) => d.id === id)?.name ?? "-";
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({ defaultValues: { departmentId: "" } });

  const onCreate = handleSubmit(async (values) => {
    setFormError("");
    try {
      await userApi.createEmployee({ name: values.name.trim(), email: values.email.trim(), password: values.password, ...(values.departmentId ? { departmentId: values.departmentId } : {}) });
      toast.success("Employee created. Share the password with them securely.");
      setCreateOpen(false); reset(); users.reload();
    } catch (err) { setFormError(getErrorMessage(err)); }
  });

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await userApi.update(editing.id, { name: editName.trim(), ...(isEmployee ? { departmentId: editDept || null } : {}) });
      toast.success("Saved"); setEditing(null); users.reload();
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  const confirmToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try {
      await userApi.update(toggle.id, { isActive: !toggle.isActive });
      toast.success(toggle.isActive ? "Account deactivated" : "Account activated");
      setToggle(null); users.reload();
    } catch (err) { toast.error(getErrorMessage(err)); setToggle(null); } finally { setBusy(false); }
  };

  const search = (e: FormEvent) => { e.preventDefault(); setPage(1); setApplied(q.trim()); };
  const label = isEmployee ? "Employees" : "Customers";

  return (
    <>
      <PageHeader title={label} subtitle={isEmployee ? "Staff who resolve complaints." : "People who submit complaints. They register themselves through your organization link."}
        actions={isEmployee ? <Button onClick={() => { setFormError(""); setCreateOpen(true); }}>Add employee</Button> : undefined} />

      <form onSubmit={search} className="card mb-4 flex gap-3 p-4">
        <Input aria-label="Search" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <div className="card overflow-hidden">
        {users.loading && <PageLoader />}
        {!users.loading && users.error && <div className="p-4"><ErrorState message={users.error} onRetry={users.retry} /></div>}
        {!users.loading && !users.error && users.data?.items.length === 0 && (
          <EmptyState title={applied ? "No matches" : `No ${label.toLowerCase()} yet`}
            message={applied ? "Try a different search." : isEmployee ? "Add your first employee to start assigning complaints." : "Customers appear here after they register."} />
        )}
        {!users.loading && !users.error && users.data && users.data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Email</th>{isEmployee && <th className="th">Department</th>}<th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {users.data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="td font-medium text-slate-900">{u.name}</td>
                      <td className="td">{u.email}</td>
                      {isEmployee && <td className="td">{deptName(u.departmentId)}</td>}
                      <td className="td"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{u.isActive ? "Active" : "Deactivated"}</span></td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => { setEditing(u); setEditName(u.name); setEditDept(u.departmentId ?? ""); }}>Edit</Button>
                          {u.id !== me!.id && <Button size="sm" variant={u.isActive ? "danger" : "secondary"} onClick={() => setToggle(u)}>{u.isActive ? "Deactivate" : "Activate"}</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={users.data.meta.page} totalPages={users.data.meta.totalPages} total={users.data.meta.total} onPage={setPage} />
          </>
        )}
      </div>

      <Modal open={createOpen} title="Add employee" onClose={() => setCreateOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={isSubmitting} onClick={onCreate}>Create employee</Button></>}>
        <form onSubmit={onCreate} className="space-y-4" noValidate>
          {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>}
          <Field label="Name" htmlFor="e-name" error={errors.name?.message}><Input id="e-name" invalid={!!errors.name} {...register("name", { required: "Name is required", minLength: { value: 2, message: "Too short" } })} /></Field>
          <Field label="Email" htmlFor="e-email" error={errors.email?.message}><Input id="e-email" type="email" invalid={!!errors.email} {...register("email", { required: "Email is required" })} /></Field>
          <Field label="Initial password" htmlFor="e-pass" error={errors.password?.message} hint="8+ characters with a letter and a number. They can change it with Forgot password.">
            <Input id="e-pass" type="text" autoComplete="off" invalid={!!errors.password}
              {...register("password", { required: "Password is required", minLength: { value: 8, message: "At least 8 characters" }, validate: (v) => (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "Include a letter and a number" })} />
          </Field>
          <Field label="Department (optional)" htmlFor="e-dept">
            <Select id="e-dept" {...register("departmentId")}><option value="">No department</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          </Field>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      <Modal open={!!editing} title={`Edit ${isEmployee ? "employee" : "customer"}`} onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} disabled={editName.trim().length < 2} onClick={saveEdit}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="x-name"><Input id="x-name" value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
          {isEmployee && (
            <Field label="Department" htmlFor="x-dept">
              <Select id="x-dept" value={editDept} onChange={(e) => setEditDept(e.target.value)}><option value="">No department</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!toggle} danger={!!toggle?.isActive} loading={busy}
        title={toggle?.isActive ? "Deactivate this account?" : "Activate this account?"}
        message={toggle?.isActive ? `${toggle.name} will be signed out immediately and will not be able to sign in.` : `${toggle?.name} will be able to sign in again.`}
        confirmLabel={toggle?.isActive ? "Deactivate" : "Activate"} onConfirm={confirmToggle} onCancel={() => setToggle(null)} />
    </>
  );
}
