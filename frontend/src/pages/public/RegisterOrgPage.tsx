import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { AuthLayout } from "../../layouts/AuthLayout";

interface Form { organizationName: string; organizationSlug: string; name: string; email: string; password: string }

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function RegisterOrgPage() {
  const { registerOrg } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting, dirtyFields } } = useForm<Form>();

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      await registerOrg({ ...values, organizationSlug: values.organizationSlug.trim().toLowerCase() });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="You become the administrator of a new, private organization."
      footer={<>Already have a workspace? <Link className="font-medium text-brand-600 hover:underline" to="/login">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <Field label="Organization name" htmlFor="orgName" error={errors.organizationName?.message}>
          <Input id="orgName" invalid={!!errors.organizationName}
            {...register("organizationName", {
              required: "Organization name is required", minLength: { value: 2, message: "Too short" },
              onChange: (e) => { if (!dirtyFields.organizationSlug) setValue("organizationSlug", slugify(e.target.value)); },
            })} />
        </Field>
        <Field label="Organization URL name" htmlFor="slug" error={errors.organizationSlug?.message} hint="Lowercase letters, numbers and hyphens. Customers use this to find you.">
          <Input id="slug" invalid={!!errors.organizationSlug}
            {...register("organizationSlug", {
              required: "URL name is required", minLength: { value: 3, message: "At least 3 characters" },
              pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: "Use lowercase letters, numbers and single hyphens" },
            })} />
        </Field>
        <Field label="Your name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" invalid={!!errors.name} {...register("name", { required: "Name is required", minLength: { value: 2, message: "Too short" } })} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email", { required: "Email is required" })} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with a letter and a number">
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password}
            {...register("password", {
              required: "Password is required", minLength: { value: 8, message: "At least 8 characters" },
              validate: (v) => (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "Include a letter and a number",
            })} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create workspace</Button>
      </form>
    </AuthLayout>
  );
}
