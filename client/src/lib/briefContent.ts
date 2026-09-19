export type BriefKind = "hackathon" | "image-object" | "about";

export const briefSummaries: Record<BriefKind, { menuLabel: string; route: string; title: string; source: string }> = {
  hackathon: {
    menuLabel: "Hackathon brief",
    route: "/compiler",
    title: "The `robby` hackathon brief",
    source: "Source: robby.md · SegFault 2026 project overview",
  },
  "image-object": {
    menuLabel: "Image-object concept",
    route: "/concept",
    title: "Even Better Than the Real Thing?",
    source: "Source: 2023 MFA PHT 805 Project Report · pp. 8, 16, 18, 20–24 · Sway: sway.cloud.microsoft/m4okFOpHUOMNhkgh",
  },
  about: {
    menuLabel: "About",
    route: "/about",
    title: "About — troid & robby",
    source: "Artist statement · Mahesh Shantaram · Bangalore · 2026",
  },
};
