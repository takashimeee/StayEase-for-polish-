import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Pencil, Plus } from "lucide-react";
import PageShell from "../components/PageShell";
import { Alert, Badge, Button, EmptyState, Field, Page, Select, Toggle, cx, inputCls, inputErrCls } from "../components/ui";
import { useApp } from "../context/AppContext";
import { EMAIL_PATTERN, formatDate, formatMoney, formatShortRange, getStatus, uid } from "../lib/utils";

const SECTIONS = ["Personal Info", "Reservation History", "Payment Methods", "Preferences", "Security"];
const STATUS_TONE = { upcoming: "mint", completed: "sand", cancelled: "danger" };

function SectionCard({ title, description, action, children, as: Tag = "section", onSubmit }) {
  return (
    <Tag onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(38,67,52,0.06)] sm:p-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-[-0.015em] text-forest">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink/55">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Tag>
  );
}

export default function Profile() {
  const { user, logout, myReservations } = useApp();
  const [section, setSection] = useState("Personal Info");
  const navigate = useNavigate();

  if (!user) return null; // RequireAuth guards this route

  const initials = user.fullName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const stays = myReservations.filter((r) => getStatus(r) === "completed").length;
  const upcoming = myReservations.filter((r) => getStatus(r) === "upcoming").length;

  return (
    <PageShell>
      <Page width="md">
        {/* Identity */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-forest font-serif text-3xl text-white">{initials}</div>
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-coral">Your profile</p>
              <h1 className="truncate font-serif text-3xl tracking-[-0.03em] text-forest sm:text-4xl">{user.fullName}</h1>
              <p className="mt-1 text-sm text-ink/55">
                Guest since {user.memberSince}
                {" · "}
                {upcoming} upcoming · {stays} past stay{stays !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              logout();
              navigate("/home");
            }}
          >
            <LogOut size={15} aria-hidden="true" /> Log out
          </Button>
        </header>

        {/* Section tabs */}
        <nav aria-label="Profile sections" className="mb-8 border-b border-forest/10">
          <div className="-mb-px flex gap-7 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                aria-current={section === s ? "page" : undefined}
                className={cx(
                  "whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:text-coral",
                  section === s ? "border-coral text-forest" : "border-transparent text-ink/50 hover:text-ink"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {section === "Personal Info" && <PersonalInfo />}
          {section === "Reservation History" && <History />}
          {section === "Payment Methods" && <PaymentMethods />}
          {section === "Preferences" && <Preferences />}
          {section === "Security" && <Security />}
        </div>
      </Page>
    </PageShell>
  );
}

function PersonalInfo() {
  const { user, updateProfile } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  const fields = [
    { key: "fullName", label: "Full name", type: "text" },
    { key: "email", label: "Email address", type: "email" },
    { key: "phone", label: "Phone number", type: "tel" },
    { key: "birthday", label: "Date of birth", type: "date" },
    { key: "address", label: "Home address", type: "text", full: true },
  ];

  const display = (key) => {
    if (key === "birthday") return user.birthday ? formatDate(user.birthday) : "—";
    return user[key] || "—";
  };

  const save = async () => {
    const found = {};
    if (!draft.fullName.trim()) found.fullName = "Enter your full name.";
    if (!EMAIL_PATTERN.test(draft.email)) found.email = "Enter a valid email address.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const result = await updateProfile({
      fullName: draft.fullName.trim(),
      email: draft.email,
      phone: draft.phone,
      birthday: draft.birthday,
      address: draft.address,
    });
    if (!result.ok) {
      setErrors({ email: result.error });
      return;
    }
    setEditing(false);
    setMessage("Your details have been saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <SectionCard
      title="About you"
      description="We use these details to prepare your bookings."
      action={
        editing ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(user);
                setErrors({});
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(user);
              setEditing(true);
            }}
          >
            <Pencil size={13} aria-hidden="true" /> Edit
          </Button>
        )
      }
    >
      {message && (
        <Alert tone="success" className="mb-6">
          {message}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
            {editing ? (
              <Field label={f.label} error={errors[f.key]}>
                <input
                  className={cx(inputCls, errors[f.key] && inputErrCls)}
                  type={f.type}
                  value={draft[f.key] ?? ""}
                  onChange={(e) => {
                    setDraft({ ...draft, [f.key]: e.target.value });
                    setErrors({ ...errors, [f.key]: undefined });
                  }}
                />
              </Field>
            ) : (
              <>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">{f.label}</span>
                <div className="break-words text-[15px] text-ink">{display(f.key)}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function History() {
  const { myReservations } = useApp();
  const sorted = [...myReservations].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <SectionCard
      title="Your stays"
      action={
        <Button as={Link} to="/my-reservations" variant="outline" size="sm">
          Manage reservations
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState
          title="No stays yet"
          className="py-8"
          action={
            <Button as={Link} to="/rooms">
              Find a room
            </Button>
          }
        >
          Your bookings will appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-forest/[0.08]">
          {sorted.map((r) => {
            const status = getStatus(r);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                <div>
                  <div className="font-serif text-lg text-forest">{r.roomName}</div>
                  <div className="text-xs text-ink/55">
                    {formatShortRange(r.checkIn, r.checkOut)} · Ref {r.ref}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                  <div className="font-serif text-base font-semibold text-forest">₱{formatMoney(r.total)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function PaymentMethods() {
  const { user, updateProfile } = useApp();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("GCash");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const methods = user.paymentMethods;

  const save = (list) => updateProfile({ paymentMethods: list });

  const remove = (id) => {
    const rest = methods.filter((m) => m.id !== id);
    if (rest.length && !rest.some((m) => m.isDefault)) rest[0] = { ...rest[0], isDefault: true };
    save(rest);
  };

  const makeDefault = (id) => save(methods.map((m) => ({ ...m, isDefault: m.id === id })));

  const add = () => {
    const digits = number.replace(/\D/g, "");
    const isCard = type === "Card";
    if (isCard ? digits.length < 13 || digits.length > 19 : digits.length < 10) {
      setError(isCard ? "Enter a valid card number." : "Enter a valid mobile number.");
      return;
    }
    const label = isCard ? `Card •••• ${digits.slice(-4)}` : `Mobile Wallet (${type}) •••• ${digits.slice(-4)}`;
    save([...methods, { id: uid(), label, isDefault: methods.length === 0 }]);
    setAdding(false);
    setNumber("");
    setError("");
  };

  return (
    <SectionCard title="Ways to pay" description="Saved for faster checkout.">
      {methods.length === 0 && <p className="mb-4 text-sm text-ink/60">No saved payment methods yet.</p>}

      <ul className="divide-y divide-forest/[0.08]">
        {methods.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-ink">{m.label}</span>
              {m.isDefault && <Badge>Default</Badge>}
            </div>
            <div className="flex gap-1">
              {!m.isDefault && (
                <Button variant="ghost" size="sm" onClick={() => makeDefault(m.id)}>
                  Make default
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-ink/60 hover:text-[#B3453F]" onClick={() => remove(m.id)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-5 space-y-4 rounded-xl bg-cream p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Select aria-label="Method type" value={type} onChange={(e) => setType(e.target.value)}>
              <option>GCash</option>
              <option>Maya</option>
              <option>Card</option>
            </Select>
            <input
              className={cx(inputCls, error && inputErrCls)}
              aria-label={type === "Card" ? "Card number" : "Mobile number"}
              placeholder={type === "Card" ? "Card number" : "Mobile number, e.g. 0917 123 4567"}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setError("");
              }}
            />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={add}>
              Add method
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-ink/50">Only the last 4 digits are stored.</p>
        </div>
      ) : (
        <Button variant="outline" className="mt-5" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" /> Add a way to pay
        </Button>
      )}
    </SectionCard>
  );
}

function Preferences() {
  const { user, updateProfile } = useApp();
  const [prefs, setPrefs] = useState(user.preferences);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(t);
  }, [message]);

  const flip = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));
  const dirty = JSON.stringify(prefs) !== JSON.stringify(user.preferences);

  return (
    <SectionCard title="How we reach you" description="Choose the messages you'd like to receive.">
      <div className="-mt-2">
        <Toggle title="Email updates" description="Booking updates, offers and news from the resort." on={prefs.email} onToggle={() => flip("email")} />
        <Toggle title="Text reminders" description="Check-in reminders and time-sensitive updates by SMS." on={prefs.sms} onToggle={() => flip("sms")} />
        <Toggle title="Newsletter" description="A monthly note on new packages and local travel guides." on={prefs.newsletter} onToggle={() => flip("newsletter")} />
      </div>
      <div className="mt-6 flex items-center justify-end gap-4">
        {message && (
          <span role="status" className="text-sm font-medium text-forest">
            {message}
          </span>
        )}
        <Button
          onClick={() => {
            updateProfile({ preferences: prefs });
            setMessage("Preferences saved.");
          }}
          disabled={!dirty}
        >
          Save preferences
        </Button>
      </div>
    </SectionCard>
  );
}

function Security() {
  const { changePassword } = useApp();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
    setMessage("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) return setError("New password must be at least 8 characters.");
    if (form.next !== form.confirm) return setError("New passwords don't match.");
    const result = await changePassword(form.current, form.next);
    if (!result.ok) return setError(result.error);
    setForm({ current: "", next: "", confirm: "" });
    setMessage("Your password has been updated.");
    return undefined;
  };

  return (
    <SectionCard title="Password" description="Keep your account and reservations safe." as="form" onSubmit={submit}>
      <div className="max-w-sm space-y-5">
        <Field label="Current password">
          <input className={inputCls} type="password" autoComplete="current-password" value={form.current} onChange={(e) => set("current", e.target.value)} />
        </Field>
        <Field label="New password" hint="Use at least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.next} onChange={(e) => set("next", e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        <Button type="submit" variant="secondary">
          Update password
        </Button>
      </div>
    </SectionCard>
  );
}