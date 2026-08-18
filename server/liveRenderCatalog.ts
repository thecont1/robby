/** Immutable gallery sources permitted to enter the live base-only executor. */
export const liveRenderSources = {
  "IMG_20210916_185510.jpg": {
    storageKey: "IMG_20210916_185510_4187fe5a.jpg",
    sha256: "261639173101e8b07f8b77da5104206c2deb7db4e7c42bad2d78b461907c7302",
  },
  "MS202401-Ayodhya0041.jpg": {
    storageKey: "MS202401-Ayodhya0041_4dd896b7.jpg",
    sha256: "7b97c159e3eb5b021e18cf76d9b3efd3704bf4f1990f985a460524c3d98926c8",
  },
  "_DSF0739-Enhanced-NR.jpg": {
    storageKey: "_DSF0739-Enhanced-NR_f8fa3226.jpg",
    sha256: "5f975d0b13563d5bc54e3fd98c559644a21a0219191afb6ca8e2c3a9c6d8e3a1",
  },
  "MS201901-Murgeshpalya0018.jpg": {
    storageKey: "MS201901-Murgeshpalya0018_0d8e06c5.jpg",
    sha256: "a5f88d9555f6b76272ca6975ed05f7b65bc7cf0fb9ce10afe1d512af85b977b5",
  },
  "MS201508-Uganda0016.jpg": {
    storageKey: "MS201508-Uganda0016_6aa6400d.jpg",
    sha256: "02ab6db06a282c4362d30f5afc7922ece8c72c50a595acaf2c1e0ce936fbee8a",
  },
} as const;

export type LiveRenderSourceName = keyof typeof liveRenderSources;

export function getLiveRenderSource(name: string) {
  return liveRenderSources[name as LiveRenderSourceName] ?? null;
}
