import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export default function PageShell({ stepper = null, children }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-ink">
      <header className="sticky top-0 z-30 bg-white/85 shadow-[0_1px_0_rgba(38,67,52,0.06),0_8px_30px_rgba(38,67,52,0.04)] backdrop-blur-md">
        <SiteHeader />
        {stepper}
      </header>

      <div className="min-h-[60vh]">{children}</div>

      <SiteFooter />
    </div>
  );
}