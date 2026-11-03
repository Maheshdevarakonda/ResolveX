import { useForm } from "react-hook-form";
import { userApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, Field, Input, PageHeader } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { humanize } from "../../utils/format";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<{ name: string }>({ defaultValues: { name: user!.name } });

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      setUser(await userApi.updateMe(name.trim()));
      toast.success("Profile updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details." />
      <form onSubmit={onSubmit} className="card max-w-lg space-y-4 p-6" noValidate>
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" invalid={!!errors.name} {...register("name", { required: "Name is required", minLength: { value: 2, message: "Too short" } })} />
        </Field>
        <Field label="Email" htmlFor="email" hint="Email cannot be changed."><Input id="email" value={user!.email} disabled readOnly /></Field>
        <Field label="Role" htmlFor="role"><Input id="role" value={humanize(user!.role)} disabled readOnly /></Field>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
      </form>
    </>
  );
}
