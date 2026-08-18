export type BriefKind = "hackathon" | "image-object";

export const briefSummaries: Record<BriefKind, { menuLabel: string; route: string; title: string; source: string }> = {
  hackathon: {
    menuLabel: "Hackathon brief",
    route: "/brief/hackathon",
    title: "The `robby` hackathon brief",
    source: "Source: robby.md · SegFault 2026 project overview",
  },
  "image-object": {
    menuLabel: "Image-object concept",
    route: "/brief/image-object",
    title: "Even Better Than the Real Thing?",
    source: "Source: 2023 MFA PHT 805 Project Report · pp. 8–10",
  },
};
