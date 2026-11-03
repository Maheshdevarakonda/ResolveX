import { useEffect, useState } from "react";
import { organizationApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, ErrorState, Field, Input, PageHeader, PageLoader } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../utils/useAsync";

export default function SettingsPage() {
  const toast = useToast();
  const { data, loading, error, retry, setData } = useAsync(() => organizationApi.get(), []);
  const [name, setName] = useState("");
  const [allow, setAllow] = useState(true);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) { setName(data.name); setAllow(data.settings.allowCustomerRegistration); setDays(data.settings.reopenWindowDays); }
  }, [data]);

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || "Could not load settings"} onRetry={retry} />;

  const registerLink = `${window.location.origin}/o/${data.slug}/register`;
  const loginLink = `${window.location.origin}/o/${data.slug}/login`;
  const dirty = name !== data.name || allow !== data.settings.allowCustomerRegistration || days !== data.settings.reopenWindowDays;
  const valid = name.trim().length >= 2 && Number.isInteger(days) && days >= 1 && days <= 90;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Link copied"); } catch { toast.error("Could not copy. Select the text and copy it manually."); }
  };

  const save = async () => {
    setBusy(true);
    try {
      setData(await organizationApi.update({ name: name.trim(), settings: { allowCustomerRegistration: allow, reopenWindowDays: days } }));
      toast.success("Settings saved");
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Organization" subtitle="Settings for your workspace." />
      <div className="max-w-2xl space-y-6">
        <section className="card space-y-4 p-6">
          <Field label="Organization name" htmlFor="name"><Input id="name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="URL name" htmlFor="slug" hint="Used to sign in. It cannot be changed."><Input id="slug" value={data.slug} disabled readOnly /></Field>
          <Field label="Reopen window (days)" htmlFor="days" hint="How long after resolution a customer may reopen a complaint (1 to 90).">
            <Input id="days" type="number" min={1} max={90} className="w-32" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
            <span><span className="font-medium">Allow customers to register themselves</span><br /><span className="text-slate-500">Turn off to stop new sign-ups through your registration link.</span></span>
          </label>
          <Button loading={busy} disabled={!dirty || !valid} onClick={save}>Save changes</Button>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold">Share with your customers</h2>
          {[["Customer registration link", registerLink], ["Sign-in link", loginLink]].map(([label, link]) => (
            <div key={label}>
              <p className="label">{label}</p>
              <div className="flex gap-2"><Input readOnly value={link} aria-label={label} onFocus={(e) => e.target.select()} /><Button variant="secondary" onClick={() => copy(link)}>Copy</Button></div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
