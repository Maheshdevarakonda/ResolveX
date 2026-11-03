import { useState } from "react";
import { departmentApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Textarea } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import type { Department } from "../../types";
import { useAsync } from "../../utils/useAsync";

export default function DepartmentsPage() {
  const toast = useToast();
  const { data, loading, error, reload, retry } = useAsync(() => departmentApi.list(), []);
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const openForm = (d: Department | "new") => {
    setEditing(d); setFormError("");
    setName(d === "new" ? "" : d.name); setDescription(d === "new" ? "" : d.description ?? "");
  };

  const save = async () => {
    setBusy(true); setFormError("");
    try {
      if (editing === "new") await departmentApi.create({ name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
      else if (editing) await departmentApi.update(editing.id, { name: name.trim(), description: description.trim() });
      toast.success("Department saved"); setEditing(null); reload();
    } catch (err) { setFormError(getErrorMessage(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await departmentApi.remove(deleting.id); toast.success("Department deleted"); reload(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setBusy(false); setDeleting(null); }
  };

  return (
    <>
      <PageHeader title="Departments" subtitle="Group employees by team so complaints are routed correctly." actions={<Button onClick={() => openForm("new")}>Add department</Button>} />
      <div className="card overflow-hidden">
        {loading && <PageLoader />}
        {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
        {!loading && !error && data?.length === 0 && <EmptyState title="No departments yet" message="Create departments like Billing or Network support." action={<Button onClick={() => openForm("new")}>Add department</Button>} />}
        {!loading && !error && data && data.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div><p className="text-sm font-medium text-slate-900">{d.name}</p>{d.description && <p className="mt-0.5 text-sm text-slate-500">{d.description}</p>}</div>
                <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => openForm(d)}>Edit</Button><Button size="sm" variant="danger" onClick={() => setDeleting(d)}>Delete</Button></div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!editing} title={editing === "new" ? "Add department" : "Edit department"} onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} disabled={name.trim().length < 2} onClick={save}>Save</Button></>}>
        <div className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>}
          <Field label="Name" htmlFor="d-name"><Input id="d-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description (optional)" htmlFor="d-desc"><Textarea id="d-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} danger loading={busy} title="Delete department?" message={`"${deleting?.name}" will be removed. Departments with employees cannot be deleted.`}
        confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </>
  );
}
