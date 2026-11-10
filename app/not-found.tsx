import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-slate-600">It may have been removed, or it is not public yet.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to the map
      </Link>
    </div>
  );
}
