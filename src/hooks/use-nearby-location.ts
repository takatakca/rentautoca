import { useEffect, useState } from "react";

const KEY = "rentauto:geo-declined";

/**
 * Approximate browser geolocation, requested only on explicit user intent.
 * Nothing is persisted except a "declined" flag so we never re-prompt.
 */
export function useNearbyLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "asking" | "granted" | "denied" | "unsupported">("idle");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) setStatus("unsupported");
    else if (localStorage.getItem(KEY) === "1") setStatus("denied");
  }, []);

  const request = () => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          /* noop */
        }
        setStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );
  };

  return { coords, status, request };
}
