import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  photos: { id: string; url: string; sort_order: number }[];
}

export function CarImageCarousel({ photos }: Props) {
  const [current, setCurrent] = useState(0);
  const images = photos.length > 0 ? photos : [{ id: "placeholder", url: "/placeholder.svg", sort_order: 0 }];

  return (
    <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
      <img
        src={images[current].url}
        alt={`Vehicle photo ${current + 1}`}
        className="w-full h-full object-cover"
      />
      {/* Counter badge */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm text-foreground text-sm px-3 py-1 rounded-full font-medium">
        {current + 1} of {images.length}
      </div>
      {/* Touch navigation areas */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-0 top-0 bottom-0 w-1/3"
            onClick={() => setCurrent((p) => Math.max(0, p - 1))}
            aria-label="Previous photo"
          />
          <button
            className="absolute right-0 top-0 bottom-0 w-1/3"
            onClick={() => setCurrent((p) => Math.min(images.length - 1, p + 1))}
            aria-label="Next photo"
          />
        </>
      )}
    </div>
  );
}
