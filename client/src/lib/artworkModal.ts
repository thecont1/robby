export function artworkModalKeyAction(key: string, shiftKey: boolean, index: number, count: number): "close" | "previous" | "next" | "none" {
  if (key === "Escape") return "close";
  if (key !== "Tab" || count < 1) return "none";
  if (shiftKey && index <= 0) return "previous";
  if (!shiftKey && index >= count - 1) return "next";
  return "none";
}

export function focusableArtworkSelector() {
  return 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
}
