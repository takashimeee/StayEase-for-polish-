import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageShell from "../components/PageShell";
import { Page, PageHeader } from "../components/ui";

const CONTENT = {
  terms: {
    title: "Terms of Service",
    intro: "A few important things to know before using StayEase to plan and manage your stay.",
    sections: [
      ["Bookings", "A reservation is confirmed once payment succeeds. You'll receive a reference number you can use to find it under My Reservations."],
      ["Cancellations", "Cancel at least 48 hours before check-in for a full refund. Later cancellations are charged one night plus applicable taxes."],
      ["Your account", "Keep your login details private. You are responsible for activity on your account."],
      ["Demo notice", "This is a demonstration app. No real payments are processed and data is stored only in your browser."],
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro: "Your information should help us manage your stay, and nothing more.",
    sections: [
      ["What we store", "Your name, email, phone number and booking details, used only to manage your reservations."],
      ["Where it lives", "In this demo, everything is stored locally in your own browser (localStorage). Nothing is sent to a server."],
      ["Your choices", "Update your details or notification preferences any time from My Profile. Clearing your browser data removes everything."],
    ],
  },
};

export default function LegalPage({ kind }) {
  const page = CONTENT[kind];

  return (
    <PageShell>
      <Page width="sm">
        <Link
          to="/home"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-ink/55 transition-colors hover:text-forest"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>

        <PageHeader eyebrow="StayEase" title={page.title} subtitle={page.intro} className="mb-8 sm:mb-10" />

        <div className="divide-y divide-forest/[0.1] border-y border-forest/[0.1]">
          {page.sections.map(([heading, body], i) => (
            <section key={heading} className="grid gap-3 py-8 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
              <span className="font-serif text-2xl text-coral/70" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="font-serif text-xl text-forest">{heading}</h2>
                <p className="mt-2 text-[15px] leading-7 text-ink/65">{body}</p>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-xs leading-5 text-ink/45">Questions about your reservation? Contact the StayEase team.</p>
      </Page>
    </PageShell>
  );
}