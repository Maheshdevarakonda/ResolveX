import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { complaintApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { CATEGORIES, Category, PRIORITIES, Priority } from "../../types";
import { humanize } from "../../utils/format";

interface Form { title: string; description: string; category: Category; priority: Priority }

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export default function CreateComplaintPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ defaultValues: { category: "SERVICE", priority: "MEDIUM" } });

  const pickFiles = (list: FileList | null) => {
    setFileError("");
    const picked = Array.from(list ?? []);
    if (picked.length > MAX_FILES) return setFileError(`You can attach up to ${MAX_FILES} files.`);
    const bad = picked.find((f) => !ALLOWED.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return setFileError(`"${bad.name}" must be a PNG, JPEG, WebP or PDF under 5 MB.`);
    setFiles(picked);
  };

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    let created;
    try {
      created = await complaintApi.create(values);
    } catch (err) {
      return setError(getErrorMessage(err));
    }
    // The complaint exists now. A failed upload must not make the customer submit it twice.
    if (files.length > 0) {
      try { await complaintApi.upload(created.id, files); }
      catch (err) { toast.error(`Complaint submitted, but the files could not be uploaded: ${getErrorMessage(err)}`); }
    }
    toast.success(`Complaint ${created.ticketNo} submitted`);
    navigate(`/app/complaints/${created.id}`);
  });

  return (
    <>
      <PageHeader title="New complaint" subtitle="Tell us what went wrong. The higher the priority, the faster the response target." />
      <form onSubmit={onSubmit} className="card max-w-2xl space-y-5 p-6" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" maxLength={150} invalid={!!errors.title} placeholder="Short summary of the problem"
            {...register("title", { required: "Title is required", minLength: { value: 5, message: "At least 5 characters" } })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="category">
            <Select id="category" {...register("category")}>{CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" {...register("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" rows={6} maxLength={5000} invalid={!!errors.description} placeholder="What happened? When did it start? What have you tried?"
            {...register("description", { required: "Description is required", minLength: { value: 10, message: "At least 10 characters" } })} />
        </Field>
        <Field label="Attachments (optional)" htmlFor="files" error={fileError} hint="Up to 5 files: PNG, JPEG, WebP or PDF, 5 MB each.">
          <input id="files" type="file" multiple accept={ALLOWED.join(",")} onChange={(e) => pickFiles(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" />
          {files.length > 0 && <p className="mt-1 text-xs text-slate-500">{files.length} file{files.length > 1 ? "s" : ""} selected</p>}
        </Field>
        <div className="flex gap-3">
          <Button type="submit" loading={isSubmitting} disabled={!!fileError}>Submit complaint</Button>
          <Link to="/app/complaints"><Button type="button" variant="secondary">Cancel</Button></Link>
        </div>
      </form>
    </>
  );
}
