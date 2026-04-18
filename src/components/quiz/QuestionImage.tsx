import { useEffect, useState } from "react";

interface QuestionImageProps {
  url: string;
  alt?: string;
}

/** Renders a question image with a click-to-zoom full-screen modal. */
export function QuestionImage({ url, alt = "問題画像" }: QuestionImageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-xl border bg-card p-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="画像を拡大"
      >
        <img
          src={url}
          alt={alt}
          className="mx-auto max-h-[400px] w-full rounded-md object-contain"
          loading="lazy"
        />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-2xl text-white hover:bg-black/80"
            aria-label="閉じる"
          >
            ×
          </button>
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <p className="mt-3 text-xs text-white/70">タップまたはESCで閉じる</p>
        </div>
      )}
    </>
  );
}
