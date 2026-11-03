import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input } from "../../components/ui";
import { LAST_ORG_KEY, useAuth } from "../../context/AuthContext";
import { AuthLayout } from "../../layouts/AuthLayout";

interface Form { organizationSlug: string; email: string; password: string }

function savedOrg(): string {
  try { return localStorage.getItem(LAST_ORG_KEY) ?? ""; } catch { return ""; }
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const initialOrg = slug ?? params.get("org") ?? savedOrg();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ defaultValues: { organizationSlug: initialOrg } });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      await login(values.organizationSlug.trim().toLowerCase(), values.email.trim(), values.password);
      navigate((location.state as { from?: string } | null)?.from ?? "/app", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the organization URL name you registered with."
      footer={
        <>
          New organization? <Link className="font-medium text-brand-600 hover:underline" to="/register">Create a workspace</Link>
          {slug && <> &middot; Customer? <Link className="font-medium text-brand-600 hover:underline" to={`/o/${slug}/register`}>Create an account</Link></>}
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <Field label="Organization" htmlFor="org" error={errors.organizationSlug?.message} hint="For example: acme-telecom">
          <Input id="org" autoComplete="organization" invalid={!!errors.organizationSlug} {...register("organizationSlug", { required: "Organization is required" })} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email", { required: "Email is required" })} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password", { required: "Password is required" })} />
        </Field>
        <div className="text-right text-sm"><Link className="text-brand-600 hover:underline" to="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
