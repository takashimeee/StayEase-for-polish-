import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";

import { useApp } from "../context/AppContext";
import { EMAIL_PATTERN } from "../lib/utils";
import GoogleButton from "../components/GoogleButton";
import AuthLayout from "../components/AuthLayout";
import { Alert, Button, Field, OrDivider, Spinner, cx, inputCls, inputErrCls } from "../components/ui";

const iconCls = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30";

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup } = useApp();

  const from = location.state?.from || "/home";

  const [form, setForm] = useState({ fullName: "", email: "", password: "", agreed: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError("");
  };

  const validate = () => {
    const found = {};
    if (!form.fullName.trim()) found.fullName = "Enter your full name.";
    if (!EMAIL_PATTERN.test(form.email)) found.email = "Enter a valid email address.";
    if (form.password.length < 8) found.password = "Use at least 8 characters.";
    if (!form.agreed) found.agreed = "Agree to the Terms of Service and Privacy Policy to continue.";
    return found;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setLoading(true);
    const result = await signup(form);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Join us"
      title="Create your account"
      subtitle="Save your details, manage your reservations, and make every future stay a little easier."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" state={{ from }} className="font-semibold text-coral transition-colors hover:text-coral-dark">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field label="Full name" error={errors.fullName}>
          <div className="relative">
            <UserRound size={16} aria-hidden="true" className={iconCls} />
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={form.fullName}
              onChange={handleChange}
              aria-invalid={Boolean(errors.fullName)}
              className={cx(inputCls, "pl-10", errors.fullName && inputErrCls)}
            />
          </div>
        </Field>

        <Field label="Email address" error={errors.email}>
          <div className="relative">
            <Mail size={16} aria-hidden="true" className={iconCls} />
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

        <Field label="Password" error={errors.password} hint="Use at least 8 characters.">
          <div className="relative">
            <LockKeyhole size={16} aria-hidden="true" className={iconCls} />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              aria-invalid={Boolean(errors.password)}
              className={cx(inputCls, "pl-10 pr-11", errors.password && inputErrCls)}
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

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-ink/65">
            <input
              type="checkbox"
              name="agreed"
              checked={form.agreed}
              onChange={handleChange}
              aria-invalid={Boolean(errors.agreed)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-forest/30 accent-forest"
            />
            <span>
              I agree to StayEase's{" "}
              <Link to="/terms" className="font-semibold text-coral transition-colors hover:text-coral-dark">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="font-semibold text-coral transition-colors hover:text-coral-dark">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {errors.agreed && (
            <span role="alert" className="mt-2 block text-xs text-red-600">
              {errors.agreed}
            </span>
          )}
        </div>

        <Button type="submit" size="lg" block disabled={loading}>
          {loading ? (
            <>
              <Spinner />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <OrDivider />

      <GoogleButton onSuccess={() => navigate(from, { replace: true })} text="signup_with" />
    </AuthLayout>
  );
}