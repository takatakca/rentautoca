import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

const DEFAULT_FALLBACK = "/placeholder.svg";

export function SafeImage({ fallback = DEFAULT_FALLBACK, className, src, alt, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const finalSrc = errored || !src ? fallback : src;
  return (
    <div className={cn("relative bg-muted overflow-hidden", className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        {...rest}
        src={finalSrc as string}
        alt={alt ?? ""}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
        className={cn("h-full w-full object-cover transition-opacity", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
