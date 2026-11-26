import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <div className="container-page container-narrow grid min-h-[60vh] place-items-center text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="search" className="h-7 w-7" />
        </span>
        <p className="eyebrow mt-5">Error 404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
        <p className="mx-auto mt-2 max-w-md text-fg-muted">
          The address may be mistyped, or the page was removed. Reports a moderator has hidden are only visible to their reporter and city staff.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Back to the map
          </Link>
          <Link href="/me" className="btn btn-secondary">
            My reports
          </Link>
        </div>
      </div>
    </div>
  );
}
