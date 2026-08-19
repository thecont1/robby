/**
 * React hook that fetches gallery data from the server and subscribes
 * to SSE updates so the gallery auto-refreshes when images are added
 * or removed from the watched `gallery/` folder.
 */

import { useEffect, useState } from "react";
import type { GalleryItem } from "./demoData";

export function useGallery(): { items: GalleryItem[]; loading: boolean } {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Initial fetch
    fetch("/api/gallery")
      .then(res => res.json())
      .then((data: GalleryItem[]) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    // SSE subscription for live updates
    const es = new EventSource("/api/gallery/events");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GalleryItem[];
        if (active) { setItems(data); setLoading(false); }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      active = false;
      es.close();
    };
  }, []);

  return { items, loading };
}
