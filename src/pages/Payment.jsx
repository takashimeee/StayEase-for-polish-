import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Lock, ShieldCheck, Wallet } from "lucide-react";
import PageShell from "../components/PageShell";
import Stepper from "../components/Stepper";
import PriceSummary from "../components/PriceSummary";
import { Alert, Button, Card, Field, Page, PageHeader, Spinner, cx, inputCls, inputErrCls } from "../components/ui";
import { useApp } from "../context/AppContext";
import { calcPricing, formatMoney, nightsBetween, stayIssue } from "../lib/utils";

const METHODS = [
  { id: "gcash", label: "GCash", detail: "Mobile wallet", icon: Wallet },
  { id: "maya", label: "Maya", detail: "Mobile wallet", icon: Wallet },
  { id: "card", label: "Credit / Debit Card", detail: "Visa, Mastercard, Amex", icon: CreditCard },
];

export default function Payment() {
  const { draft, findRoom } = useApp();
  const room = findRoom(draft?.roomId);
  if (!draft || !room) return <Navigate to="/rooms" replace />;
  return <PaymentInner draft={draft} room={room} />;
}

function PaymentInner({ draft, room }) {
  const { user, addReservation, clearDraft, isRoomAvailable } = useApp();
  const navigate = useNavigate();

  const [methodId, setMethodId] = useState(
    user?.paymentMethods?.find((m) => m.isDefault)?.label.includes("Maya") ? "maya" : "gcash"
  );
  const [status, setStatus] = useState("idle"); // idle | redirecting | error
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ mobile: "", cardNumber: "", cardName: "", expiry: "", cvc: "" });
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const method = METHODS.find((m) => m.id === methodId);
  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const available = nights > 0 ? isRoomAvailable(room.id, draft.checkIn, draft.checkOut) : true;
  const issue = stayIssue({ room, ...draft, available });
  const pricing = calcPricing(room, nights);
  const breakfastItems = (draft.breakfastItems || []).filter((item) => item.quantity > 0);
  const bookingTotal =
    pricing.total +
    breakfastItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (methodId === "card") {
      const digits = form.cardNumber.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) found.cardNumber = "Enter a valid card number.";
      if (!form.cardName.trim()) found.cardName = "Enter the name on the card.";
      const m = form.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
      if (!m) found.expiry = "Use MM/YY.";
      else {
        const month = Number(m[1]);
        const year = 2000 + Number(m[2]);
        const now = new Date();
        const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
        if (month < 1 || month > 12 || expired) found.expiry = "Card has expired or date is invalid.";
      }
      if (!/^\d{3,4}$/.test(form.cvc)) found.cvc = "3–4 digits.";
    } else {
      const digits = form.mobile.replace(/\D/g, "");
      const ok = /^(09\d{9}|639\d{9})$/.test(digits);
      if (!ok) found.mobile = "Enter a valid mobile number, e.g. 0917 123 4567.";
    }
    return found;
  };

  const handlePay = () => {
    if (issue) {
      setStatus("error");
      setErrorMsg(issue);
      return;
    }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("redirecting");
    setErrorMsg("");
    // Simulated round trip to the payment provider
    timer.current = setTimeout(async () => {
      const label =
        methodId === "card"
          ? `Card •••• ${form.cardNumber.replace(/\D/g, "").slice(-4)}`
          : method.label;
      const result = await addReservation({
        roomId: room.id,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        adults: draft.adults,
        children: draft.children,
        guest: {
          fullName: draft.fullName,
          email: draft.email,
          phone: draft.phone,
          specialRequests: draft.specialRequests,
        },
        paymentMethod: label,
        breakfastItems,
      });
      if (!result.ok) {
        setStatus("error");
        setErrorMsg(result.error);
        return;
      }
      navigate(`/booking/confirmation/${result.reservation.id}`, { replace: true });
      clearDraft();
    }, 1400);
  };

  const busy = status === "redirecting";

  return (
    <PageShell stepper={<Stepper current={2} />}>
      <Page>
        <PageHeader
          eyebrow="Last step"
          title="Secure your stay"
          subtitle="Choose how you'd like to pay. This is a demo, so no real payment is taken."
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <h2 className="font-serif text-xl text-forest">Payment method</h2>
              <p className="mt-1 text-xs text-ink/55">Your reservation is confirmed once payment succeeds.</p>

              <div role="radiogroup" aria-label="Payment method" className="mt-5 space-y-3">
                {METHODS.map(({ id, label, detail, icon: Icon }) => {
                  const selected = id === methodId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={busy}
                      onClick={() => {
                        setMethodId(id);
                        setErrors({});
                        setStatus("idle");
                      }}
                      className={cx(
                        "flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all",
                        "focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/15 disabled:opacity-60",
                        selected
                          ? "border-forest bg-mint/60 shadow-sm ring-1 ring-forest"
                          : "border-forest/15 bg-white hover:border-forest/35"
                      )}
                    >
                      <span
                        className={cx(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          selected ? "bg-forest text-white" : "bg-mint text-forest"
                        )}
                      >
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-ink/55">{detail}</span>
                      </span>
                      <span
                        className={cx(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                          selected ? "border-forest bg-forest text-white" : "border-ink/20"
                        )}
                      >
                        {selected && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 space-y-4 rounded-xl bg-cream p-5">
                {methodId === "card" ? (
                  <>
                    <Field label="Card number" error={errors.cardNumber}>
                      <input
                        className={cx(inputCls, errors.cardNumber && inputErrCls)}
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="4242 4242 4242 4242"
                        value={form.cardNumber}
                        disabled={busy}
                        onChange={(e) => setField("cardNumber", e.target.value)}
                      />
                    </Field>
                    <Field label="Name on card" error={errors.cardName}>
                      <input
                        className={cx(inputCls, errors.cardName && inputErrCls)}
                        autoComplete="cc-name"
                        placeholder="Sarah Jenkins"
                        value={form.cardName}
                        disabled={busy}
                        onChange={(e) => setField("cardName", e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiry (MM/YY)" error={errors.expiry}>
                        <input
                          className={cx(inputCls, errors.expiry && inputErrCls)}
                          autoComplete="cc-exp"
                          placeholder="08/29"
                          value={form.expiry}
                          disabled={busy}
                          onChange={(e) => setField("expiry", e.target.value)}
                        />
                      </Field>
                      <Field label="CVC" error={errors.cvc}>
                        <input
                          className={cx(inputCls, errors.cvc && inputErrCls)}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="123"
                          value={form.cvc}
                          disabled={busy}
                          onChange={(e) => setField("cvc", e.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <Field
                    label={`${method.label} mobile number`}
                    error={errors.mobile}
                    hint={`We'll use this number to complete your ${method.label} payment.`}
                  >
                    <input
                      className={cx(inputCls, errors.mobile && inputErrCls)}
                      type="tel"
                      autoComplete="tel"
                      placeholder="0917 123 4567"
                      value={form.mobile}
                      disabled={busy}
                      onChange={(e) => setField("mobile", e.target.value)}
                    />
                  </Field>
                )}
              </div>

              <div aria-live="polite" className="mt-5 empty:hidden">
                {busy && (
                  <Alert tone="success" icon={false}>
                    <span className="flex items-center gap-2">
                      <Spinner /> Processing your {method.label} payment. Please don't close this page.
                    </span>
                  </Alert>
                )}
                {status === "error" && (
                  <Alert tone="error">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {errorMsg || "Payment unsuccessful. Please try again or select another payment method."}
                      </span>
                      {issue ? (
                        <Link to="/booking/review" className="shrink-0 font-semibold underline hover:no-underline">
                          Edit stay
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus("idle")}
                          className="shrink-0 font-semibold underline hover:no-underline"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </Alert>
                )}
              </div>

              <Button size="lg" block className="mt-5" onClick={handlePay} disabled={busy}>
                {busy ? (
                  <>
                    <Spinner /> Processing…
                  </>
                ) : (
                  <>
                    <Lock size={15} aria-hidden="true" />
                    Pay ₱{formatMoney(bookingTotal)} with {method.label}
                  </>
                )}
              </Button>

              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-ink/50">
                <ShieldCheck size={13} className="text-forest/70" aria-hidden="true" />
                Demo checkout · no real charge is made
              </p>
            </Card>

            <Link
              to="/booking/review"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition-colors hover:text-coral"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back to review
            </Link>
          </div>

          <PriceSummary
            room={room}
            draft={draft}
            nights={nights}
            pricing={pricing}
            breakfastItems={breakfastItems}
            note="Free cancellation up to 48 hours before check-in"
          />
        </div>
      </Page>
    </PageShell>
  );
}