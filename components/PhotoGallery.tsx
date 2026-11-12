"use client";

import { useRef, useState } from "react";

interface Photo {
  id: string;
  url: string;
}

/** Thumbnails open a full-size viewer. Uses the native <dialog>, so Escape and focus handling come from the browser. */
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const images = photos.filter((p) => !p.url.endsWith(".pdf"));
  const pdfs = photos.filter((p) => p.url.endsWith(".pdf"));
  const current = images[index];

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
  }

  function step(delta: number) {
    setIndex((i) => (i + delta + images.length) % images.length);
  }

  return (
    <>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((m, i) => (
          <li key={m.id}>
            <button type="button" onClick={() => open(i)} aria-label={`Enlarge photo ${i + 1} of ${images.length}`} className="block w-full overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="aspect-square w-full object-cover transition duration-200 hover:scale-[1.03]" />
            </button>
          </li>
        ))}
        {pdfs.map((m) => (
          <li key={m.id}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="grid aspect-square w-full place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-ink-700">
              Open PDF
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label="Photo viewer"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => {
          // A click on the backdrop (outside the image panel) closes the viewer.
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[95vh] max-w-[95vw] bg-transparent p-0 backdrop:bg-slate-900/90"
      >
        {current && (
          <div className="relative flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={`Photo ${index + 1} of ${images.length}`} className="max-h-[82vh] max-w-full rounded-lg object-contain" />
            <div className="flex w-full items-center justify-between text-sm text-white">
              <button type="button" onClick={() => step(-1)} disabled={images.length < 2} className="rounded-lg bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 disabled:opacity-40">
                ← Previous
              </button>
              <span aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <button type="button" onClick={() => step(1)} disabled={images.length < 2} className="rounded-lg bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 disabled:opacity-40">
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close photo viewer"
              className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold text-slate-800 shadow-lg"
            >
              ×
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
