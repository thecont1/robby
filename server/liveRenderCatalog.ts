/** Immutable gallery sources permitted to enter the live base-only executor. */
export const liveRenderSources = {
  "MS201306-BipashaAashish0192.jpg": {
    storageKey: "MS201306-BipashaAashish0192_db5cccb3.jpg",
    sha256: "b1faf2ba275f8c33c3015705248c14f53ae64969c7f187a26addf78ff01acf68",
  },
  "MS201508-Uganda0016.jpg": {
    storageKey: "MS201508-Uganda0016_f138d65c.jpg",
    sha256: "02ab6db06a282c4362d30f5afc7922ece8c72c50a595acaf2c1e0ce936fbee8a",
  },
  "MS201804-FIDHGuinea0264.jpg": {
    storageKey: "MS201804-FIDHGuinea0264_3fc4dda5.jpg",
    sha256: "86e12a0501ed3f80910ec9c14db42afe83bcb7a15d07c0e371ec23a6a65c71aa",
  },
  "MS201901-Murgeshpalya0018.jpg": {
    storageKey: "MS201901-Murgeshpalya0018_087e242b.jpg",
    sha256: "a5f88d9555f6b76272ca6975ed05f7b65bc7cf0fb9ce10afe1d512af85b977b5",
  },
  "MS201904-Kashmir0594.jpg": {
    storageKey: "MS201904-Kashmir0594_ed01fbba.jpg",
    sha256: "e933b354d8a7909a3713a24fc354899b24063c3b5b8a490d06ac5f4d01c09a66",
  },
  "MS201910-Ghana9243.jpg": {
    storageKey: "MS201910-Ghana9243_a069f73d.jpg",
    sha256: "858bee16e500c6ad4d048391e53ab57a6e5622f0affab5a83360176334ecaebf",
  },
  "MS201912-Nagaland1300.jpg": {
    storageKey: "MS201912-Nagaland1300_a2148ba0.jpg",
    sha256: "f605086bf5182a1c557c1117d2ef8e62b9f8847cab292405c17e94c803e64e4e",
  },
  "MS202309-HongKong0469-Enhanced-NR.jpg": {
    storageKey: "MS202309-HongKong0469-Enhanced-NR_29eae7eb.jpg",
    sha256: "3eb60783974709c44a0088bacccf23d8896aab160d0d51bcdb18f228a8ae395e",
  },
  "MS202401-Ayodhya0041.jpg": {
    storageKey: "MS202401-Ayodhya0041_8327bd18.jpg",
    sha256: "7b97c159e3eb5b021e18cf76d9b3efd3704bf4f1990f985a460524c3d98926c8",
  },
  "MS202308-Bangalore0739-Enhanced-NR.jpg": {
    storageKey: "MS202308-Bangalore0739-Enhanced-NR_458ae022.jpg",
    sha256: "5f975d0b13563d5bc54e3fd98c559644a21a0219191afb6ca8e2c3a9c6d8e3a1",
  },
} as const;

export type LiveRenderSourceName = keyof typeof liveRenderSources;

export function getLiveRenderSource(name: string) {
  return liveRenderSources[name as LiveRenderSourceName] ?? null;
}
