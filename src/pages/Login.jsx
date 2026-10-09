import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useState } from "react";

import { useApp } from "../context/AppContext";
import { EMAIL_PATTERN } from "../lib/utils";
import GoogleButton from "../components/GoogleButton";
import AuthLayout from "../components/AuthLayout";
import { Alert, Button, Field, OrDivider, Spinner, cx, inputCls, inputErrCls } from "../components/ui";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();

  const from = location.state?.from || "/home";

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = {};
    if (!EMAIL_PATTERN.test(form.email)) found.email = "Enter a valid email address.";
    if (!form.password) found.password = "Enter your password.";

    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    const result = await login(form.email, form.password);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    navigate(from, { replace: true });
  };

  const fillDemo = () => {
    setForm({ email: "sarah.jenkins@example.com", password: "password123" });
    setErrors({});
    setFormError("");
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Good to see you again"
      subtitle="Sign in to manage your stays, reservations and guest details."
      footer={
        <>
          New to StayEase?{" "}
          <Link to="/signup" state={{ from }} className="font-semibold text-coral transition-colors hover:text-coral-dark">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field label="Email address" error={errors.email}>
          <div className="relative">
            <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              aria-invalid={Boolean(errors.email)}
              className={cx(inputCls, "pl-10", errors.email && inputErrCls)}
            />
          </div>
        </Field>

        <Field label="Password" error={errors.password}>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              aria-invalid={Boolean(errors.password)}
              className={cx(inputCls, "pr-11", errors.password && inputErrCls)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/35 transition hover:text-forest focus:outline-none focus-visible:ring-4 focus-visible:ring-forest/10"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" block disabled={submitting} className="mt-2">
          {submitting ? (
            <>
              <Spinner />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <OrDivider />

      <GoogleButton onSuccess={() => navigate(from, { replace: true })} text="signin_with" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream px-4 py-3 text-xs text-ink/60">
        <span>Trying the demo? Use sarah.jenkins@example.com</span>
        <button
          type="button"
          onClick={fillDemo}
          className="font-semibold text-coral transition-colors hover:text-coral-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-coral/25"
        >
          Fill it in
        </button>
      </div>
    </AuthLayout>
  );
}