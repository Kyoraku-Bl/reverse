// An original, finite library: the same IDs own validation, UI and export filters.
// CSS is an approximate preview, not a promise of pixel-identical FFmpeg output.
export const videoLooks = [
  { id: "none", name: "Original", ff: [], css: "" },
  { id: "mono", name: "Black & white", ff: ["hue=s=0"], css: "grayscale(1)" },
  {
    id: "warm",
    name: "Warm",
    ff: ["colorbalance=rs=0.12:bs=-0.1"],
    css: "sepia(.25) saturate(1.15)",
  },
  {
    id: "cool",
    name: "Cool",
    ff: ["colorbalance=rs=-0.1:bs=0.12"],
    css: "sepia(.15) hue-rotate(165deg)",
  },
  {
    id: "vintage",
    name: "Vintage sepia",
    ff: ["colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"],
    css: "sepia(1)",
  },
  {
    id: "cinema",
    name: "Cinema teal",
    ff: [
      "colorbalance=rs=-0.08:gs=0.04:bs=0.12:rh=0.08:bh=-0.06",
      "eq=contrast=1.15:saturation=0.85",
    ],
    css: "sepia(.2) hue-rotate(150deg) contrast(1.15) saturate(.85)",
  },
  {
    id: "golden",
    name: "Golden hour",
    ff: [
      "colorbalance=rs=0.18:gs=0.06:bs=-0.15",
      "eq=brightness=0.03:saturation=1.15",
    ],
    css: "sepia(.35) saturate(1.3) brightness(1.05)",
  },
  {
    id: "faded",
    name: "Faded film",
    ff: ["eq=contrast=0.8:brightness=0.07:saturation=0.7"],
    css: "contrast(.8) brightness(1.07) saturate(.7)",
  },
  {
    id: "vivid",
    name: "Vivid",
    ff: ["eq=contrast=1.15:saturation=1.5"],
    css: "contrast(1.15) saturate(1.5)",
  },
  {
    id: "noir",
    name: "Noir",
    ff: ["hue=s=0", "eq=contrast=1.5:brightness=-0.04"],
    css: "grayscale(1) contrast(1.5) brightness(.96)",
  },
  {
    id: "rose",
    name: "Rose",
    ff: ["colorbalance=rs=0.12:gs=-0.06:bs=0.08"],
    css: "sepia(.25) hue-rotate(300deg)",
  },
  {
    id: "arctic",
    name: "Arctic",
    ff: ["colorbalance=rs=-0.12:bs=0.2", "eq=saturation=0.75:brightness=0.04"],
    css: "sepia(.3) hue-rotate(160deg) saturate(.75) brightness(1.04)",
  },
  {
    id: "sunset",
    name: "Sunset",
    ff: ["colorbalance=rs=0.2:gs=-0.04:bs=-0.12"],
    css: "sepia(.5) saturate(1.3)",
  },
  {
    id: "forest",
    name: "Forest",
    ff: ["colorbalance=rs=-0.08:gs=0.12:bs=-0.04"],
    css: "sepia(.25) hue-rotate(55deg)",
  },
  {
    id: "lavender",
    name: "Lavender",
    ff: ["colorbalance=rs=0.06:gs=-0.08:bs=0.15"],
    css: "sepia(.3) hue-rotate(230deg)",
  },
  {
    id: "retro",
    name: "Retro print",
    ff: ["eq=contrast=1.2:saturation=0.6", "colorbalance=rs=0.06:bs=-0.08"],
    css: "sepia(.3) contrast(1.2) saturate(.6)",
  },
  {
    id: "pastel",
    name: "Pastel",
    ff: ["eq=brightness=0.07:contrast=0.9:saturation=0.65"],
    css: "brightness(1.07) contrast(.9) saturate(.65)",
  },
  {
    id: "dramatic",
    name: "Dramatic",
    ff: ["eq=contrast=1.4:saturation=0.8:brightness=-0.03"],
    css: "contrast(1.4) saturate(.8) brightness(.97)",
  },
  {
    id: "ocean",
    name: "Ocean blue",
    ff: ["colorbalance=rs=-0.12:gs=0.06:bs=0.18", "eq=saturation=1.2"],
    css: "sepia(.3) hue-rotate(150deg) saturate(1.2)",
  },
  {
    id: "amber",
    name: "Amber",
    ff: ["colorbalance=rs=0.15:gs=0.05:bs=-0.18", "eq=contrast=1.1"],
    css: "sepia(.6) contrast(1.1)",
  },
];
export const videoEffects = [
  { id: "none", name: "No extra effect", ff: [], css: "" },
  { id: "vignette", name: "Vignette", ff: ["vignette=angle=PI/4"], css: "" },
  {
    id: "sharpen",
    name: "Sharpen",
    ff: ["unsharp=5:5:1.2:5:5:0"],
    css: "contrast(1.1)",
  },
  { id: "grain", name: "Film grain", ff: ["noise=alls=18:allf=t+u"], css: "" },
  { id: "negative", name: "Negative", ff: ["negate"], css: "invert(1)" },
  {
    id: "edges",
    name: "Neon edges",
    ff: ["edgedetect=low=0.1:high=0.3:mode=colormix"],
    css: "contrast(2) saturate(2)",
  },
  {
    id: "emboss",
    name: "Emboss",
    ff: [
      "convolution='-2 -1 0 -1 1 1 0 1 2: -2 -1 0 -1 1 1 0 1 2: -2 -1 0 -1 1 1 0 1 2'",
    ],
    css: "grayscale(1) contrast(1.5)",
  },
  {
    id: "soft",
    name: "Soft focus",
    ff: ["gblur=sigma=1.5", "eq=brightness=0.04"],
    css: "blur(1.5px) brightness(1.04)",
  },
  {
    id: "pixel",
    name: "Pixel mosaic",
    ff: ["pixelize=width=12:height=12"],
    css: "",
  },
  {
    id: "scanlines",
    name: "Scan lines",
    ff: ["drawgrid=w=iw:h=4:t=1:c=black@0.25"],
    css: "",
  },
  { id: "rgb", name: "RGB split", ff: ["rgbashift=rh=4:bh=-4"], css: "" },
];
export const lookIds = videoLooks.map((x) => x.id);
export const effectIds = videoEffects.map((x) => x.id);
