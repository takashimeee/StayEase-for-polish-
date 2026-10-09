import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import PageShell from "../components/PageShell";
import { Button, Page } from "../components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <Page width="xs" className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <span className="mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-mint text-forest">
          <Compass size={26} strokeWidth={1.6} aria-hidden="true" />
        </span>

        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">A little off course</p>

        <p className="mt-3 font-serif text-7xl font-semibold leading-none tracking-[-0.05em] text-forest/15" aria-hidden="true">
          404
        </p>

        <h1 className="-mt-1 font-serif text-3xl tracking-[-0.025em] text-forest">This page isn't here.</h1>

        <p className="mx-auto mb-8 mt-3 max-w-sm text-sm leading-6 text-ink/60">
          The page you're looking for doesn't exist or may have moved. Let's get you back to somewhere beautiful.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button as={Link} to="/home" size="lg">
            Back to home
          </Button>
          <Button as={Link} to="/rooms" size="lg" variant="outline">
            Browse rooms
          </Button>
        </div>
      </Page>
    </PageShell>
  );
}