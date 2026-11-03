import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { AuthLayout } from "../../layouts/AuthLayout";

interface Form { name: string; email: string; password: string }

export default function RegisterCustomerPage() {
  const { slug = "" } = useParams();
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>();

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      await registerCustomer({ organizationSlug: slug, ...values });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle={`You are signing up with the organization "${slug}".`}
      footer={<>Already have an account? <Link className="font-medium text-brand-600 hover:underline" to={`/o/${slug}/login`}>Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
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
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
