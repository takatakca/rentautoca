import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  url: string;
}

interface Props {
  photos: Photo[];
  title: string;
}

/**
 * Editorial gallery: hero + supporting grid on desktop, swipeable single
 * frame on mobile, with a fullscreen viewer. Presentation only.
 */
export function PhotoGallery({ photos, title }: Props) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const usable = photos.filter((p) => !broken[p.id]);
  const list = usable.length > 0 ? usable : [];
  const count = list.length;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, count]);

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted md:aspect-[16/9] md:rounded-2xl">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-sm">No photos yet</span>
        </div>
      </div>
    );
  }

  const markBroken = (id: string) => setBroken((b) => ({ ...b, [id]: true }));
  const hero = list[safeIndex];
  const supporting = list.filter((_, i) => i !== safeIndex).slice(0, 4);

  return (
    <>
      {/* Mobile: single swipe frame */}
      <div className="relative md:hidden">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={hero.url}
            alt={`${title} — photo ${safeIndex + 1} of ${count}`}
            className="h-full w-full object-cover"
            onError={() => markBroken(hero.id)}
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute inset-y-0 left-0 w-1/3"
              onClick={() => setIndex((i) => (i === 0 ? count - 1 : i - 1))}
            />
            <button
              type="button"
              aria-label="Next photo"
              className="absolute inset-y-0 right-0 w-1/3"
              onClick={() => setIndex((i) => (i === count - 1 ? 0 : i + 1))}
            />
          </>
        )}
        <span className="absolute bottom-4 left-4 rounded-full bg-background/85 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          {safeIndex + 1} / {count}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-4 right-4 rounded-full"
          onClick={() => setViewerOpen(true)}
        >
          <Expand className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> All photos
        </Button>
      </div>

      {/* Desktop: hero + supporting grid */}
      <div className="relative hidden gap-2 overflow-hidden rounded-2xl md:grid md:grid-cols-[70%_1fr]">
        <button
          type="button"
          className="group relative aspect-[4/3] overflow-hidden bg-muted"
          onClick={() => setViewerOpen(true)}
          aria-label="Open photo viewer"
        >
          <img
            src={hero.url}
            alt={`${title} — main photo`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            onError={() => markBroken(hero.id)}
          />
        </button>
        <div className="grid grid-rows-2 gap-2">
          {supporting.slice(0, 2).map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="relative overflow-hidden bg-muted"
              onClick={() => {
                setIndex(list.findIndex((x) => x.id === p.id));
              }}
              aria-label={`Show photo ${i + 2}`}
            >
              <img
                src={p.url}
                alt={`${title} — supporting photo ${i + 2}`}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => markBroken(p.id)}
              />
            </button>
          ))}
          {supporting.length === 0 && <div className="row-span-2 bg-muted" />}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-4 right-4 rounded-full"
          onClick={() => setViewerOpen(true)}
        >
          <Expand className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> View all {count} photos
        </Button>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl border-none bg-background/95 p-0">
          <DialogTitle className="sr-only">{title} photo viewer</DialogTitle>
          <div className="relative">
            <img
              src={hero.url}
              alt={`${title} — photo ${safeIndex + 1} of ${count}`}
              className="max-h-[80dvh] w-full object-contain"
              onError={() => markBroken(hero.id)}
            />
            {count > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => setIndex((i) => (i === 0 ? count - 1 : i - 1))}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => setIndex((i) => (i === count - 1 ? 0 : i + 1))}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            )}
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              {safeIndex + 1} / {count}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            {list.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === safeIndex}
                className={cn(
                  "h-16 w-24 shrink-0 overflow-hidden rounded-md border-2",
                  i === safeIndex ? "border-primary" : "border-transparent opacity-70",
                )}
              >
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close photo viewer"
            className="absolute right-2 top-2 rounded-full"
            onClick={() => setViewerOpen(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
