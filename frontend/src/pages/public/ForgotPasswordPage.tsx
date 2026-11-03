import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { authApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input } from "../../components/ui";
import { LAST_ORG_KEY } from "../../context/AuthContext";
import { AuthLayout } from "../../layouts/AuthLayout";

interface Form { organizationSlug: string; email: string }

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saved = (() => { try { return localStorage.getItem(LAST_ORG_KEY) ?? ""; } catch { return ""; } })();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ defaultValues: { organizationSlug: saved } });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      setMessage(await authApi.forgot({ organizationSlug: values.organizationSlug.trim().toLowerCase(), email: values.email.trim() }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your organization and email." footer={<Link className="font-medium text-brand-600 hover:underline" to="/login">Back to sign in</Link>}>
      {message ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">{message}</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
          <Field label="Organization" htmlFor="org" error={errors.organizationSlug?.message}>
            <Input id="org" invalid={!!errors.organizationSlug} {...register("organizationSlug", { required: "Organization is required" })} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" invalid={!!errors.email} {...register("email", { required: "Email is required" })} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
