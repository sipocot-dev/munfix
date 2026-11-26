import Link from "next/link";
import Icon from "./Icon";

type Target = { href: string } | { onClick: () => void };

/** Previous / next pager. Works with links (server pages) or callbacks (client lists). */
export default function Pagination({
  page,
  label,
  prev,
  next,
}: {
  page: number;
  /** e.g. "Page 2 of 5" or "Showing 51–100 of 230". */
  label?: string;
  prev?: Target | null;
  next?: Target | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <PagerButton target={prev} dir="prev" />
      <p className="text-sm text-fg-muted" aria-live="polite">
        {label ?? `Page ${page}`}
      </p>
      <PagerButton target={next} dir="next" />
    </nav>
  );
}

function PagerButton({ target, dir }: { target?: Target | null; dir: "prev" | "next" }) {
  const content =
    dir === "prev" ? (
      <>
        <Icon name="chevronLeft" className="h-4 w-4" /> Newer
      </>
    ) : (
      <>
        Older <Icon name="chevronRight" className="h-4 w-4" />
      </>
    );
  if (!target) return <span className="btn btn-secondary btn-sm invisible" aria-hidden>{content}</span>;
  if ("href" in target) {
    return (
      <Link href={target.href} className="btn btn-secondary btn-sm" rel={dir}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={target.onClick} className="btn btn-secondary btn-sm">
      {content}
    </button>
  );
}
