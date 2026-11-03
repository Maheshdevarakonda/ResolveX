import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { AuthLayout } from "../../layouts/AuthLayout";

interface Form { password: string; confirm: string }

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState("");
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<Form>();

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      toast.success(await authApi.reset({ token, password: values.password }));
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  if (!token) {
    return (
      <AuthLayout title="Reset link missing" footer={<Link className="font-medium text-brand-600 hover:underline" to="/forgot-password">Request a new link</Link>}>
        <p className="text-sm text-slate-600">This page needs the link from your reset email.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        <Field label="New password" htmlFor="password" error={errors.password?.message} hint="8+ characters with a letter and a number">
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password}
            {...register("password", {
              required: "Password is required", minLength: { value: 8, message: "At least 8 characters" },
              validate: (v) => (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "Include a letter and a number",
            })} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm}
            {...register("confirm", { required: "Please confirm", validate: (v) => v === getValues("password") || "Passwords do not match" })} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
