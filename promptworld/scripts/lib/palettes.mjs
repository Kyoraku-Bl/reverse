/**
 * Named palettes. Every design prompt carries real hex values so the generated
 * page is not left to an AI's default purple-on-near-black.
 */

export const PALETTES = [
  { name: "Obsidian Ember", tone: "dark", colors: ["#08080a", "#141419", "#ff5a1f", "#ffb27a", "#f5f2ee"] },
  { name: "Vantablack Gold", tone: "dark", colors: ["#050505", "#101010", "#d4af37", "#f3e5ab", "#e8e6e1"] },
  { name: "Arctic Slate", tone: "light", colors: ["#f7f9fb", "#e6ebf1", "#2b3a4a", "#5b7c99", "#0f1720"] },
  { name: "Bleached Linen", tone: "light", colors: ["#fbf8f3", "#efe8dc", "#3a3630", "#8a7f6d", "#171512"] },
  { name: "Neon Kelp", tone: "dark", colors: ["#03120f", "#08211c", "#39ff9c", "#9dffd0", "#e9fff5"] },
  { name: "Ultraviolet Press", tone: "dark", colors: ["#0a0713", "#170f2b", "#7c3aed", "#c4b5fd", "#f2eeff"] },
  { name: "Solar Flare", tone: "dark", colors: ["#120604", "#2a0f07", "#ff8c00", "#ffd166", "#fff4e0"] },
  { name: "Bone China", tone: "light", colors: ["#ffffff", "#f4f1ec", "#1a1a1a", "#6e6a63", "#b9b3a8"] },
  { name: "Deep Sea Glass", tone: "dark", colors: ["#020b14", "#062033", "#22d3ee", "#a5f3fc", "#ecfeff"] },
  { name: "Rust Belt", tone: "light", colors: ["#f6efe7", "#e3d3c1", "#8c3b1b", "#c9743f", "#241a14"] },
  { name: "Matcha Ceramic", tone: "light", colors: ["#f6f7f0", "#dfe4cf", "#5c7a3a", "#9fb877", "#20261a"] },
  { name: "Midnight Iris", tone: "dark", colors: ["#070711", "#12122b", "#4f46e5", "#a5b4fc", "#eef0ff"] },
  { name: "Copper Circuit", tone: "dark", colors: ["#0d0a08", "#1c1512", "#b87333", "#e8b98a", "#f7ece2"] },
  { name: "Glacier Mint", tone: "light", colors: ["#f2fbf8", "#d8f1e8", "#0f8a6a", "#5cc7a8", "#0a2019"] },
  { name: "Crimson Noir", tone: "dark", colors: ["#0b0507", "#1d0c11", "#e11d48", "#fb7185", "#fff1f2"] },
  { name: "Sandstone Dusk", tone: "light", colors: ["#fdf6ee", "#f0dcc4", "#9a6b3f", "#c99a6b", "#2c1d12"] },
  { name: "Void Chrome", tone: "dark", colors: ["#09090b", "#18181b", "#a1a1aa", "#e4e4e7", "#fafafa"] },
  { name: "Cyanotype", tone: "dark", colors: ["#04121f", "#0a2540", "#1d4ed8", "#7dd3fc", "#f0f9ff"] },
  { name: "Terracotta Bloom", tone: "light", colors: ["#fff8f4", "#f7ddd0", "#c2542f", "#e8927a", "#2e1a13"] },
  { name: "Absinthe", tone: "dark", colors: ["#070d05", "#122009", "#a3e635", "#d9f99d", "#f7fee7"] },
  { name: "Porcelain Ink", tone: "light", colors: ["#ffffff", "#f2f4f7", "#111827", "#4b5563", "#9ca3af"] },
  { name: "Magma Shelf", tone: "dark", colors: ["#100301", "#2b0a03", "#ef4444", "#fbbf24", "#fff7ed"] },
  { name: "Sea Foam Paper", tone: "light", colors: ["#f4fbfa", "#dcf0ee", "#0d9488", "#5eead4", "#04231f"] },
  { name: "Bruised Plum", tone: "dark", colors: ["#0c0611", "#1d1029", "#9333ea", "#d8b4fe", "#faf5ff"] },
  { name: "Newsprint Amber", tone: "light", colors: ["#fbf7ef", "#eee4cf", "#b45309", "#f59e0b", "#1c1508"] },
  { name: "Titanium Frost", tone: "light", colors: ["#f8fafc", "#e2e8f0", "#475569", "#94a3b8", "#0f172a"] },
  { name: "Black Olive", tone: "dark", colors: ["#0a0c07", "#1a1f12", "#84cc16", "#bef264", "#f7fee7"] },
  { name: "Rose Quartz Lab", tone: "light", colors: ["#fff7f8", "#fbdfe4", "#be123c", "#fb7185", "#2a0a11"] },
  { name: "Ionosphere", tone: "dark", colors: ["#030712", "#0b1229", "#38bdf8", "#818cf8", "#f8fafc"] },
  { name: "Kiln Ash", tone: "light", colors: ["#faf8f5", "#e8e2d9", "#57534e", "#a8a29e", "#1c1917"] },
  { name: "Emerald Vault", tone: "dark", colors: ["#03110c", "#06251a", "#10b981", "#6ee7b7", "#ecfdf5"] },
  { name: "Cobalt Print", tone: "dark", colors: ["#050a1c", "#0d1839", "#3b82f6", "#93c5fd", "#eff6ff"] },
  { name: "Marigold Field", tone: "light", colors: ["#fffcf2", "#fdf0cf", "#ca8a04", "#facc15", "#26210a"] },
  { name: "Graphite Bloom", tone: "dark", colors: ["#0c0c0e", "#1b1b1f", "#f472b6", "#fbcfe8", "#fdf2f8"] },
  { name: "Chalk Cliff", tone: "light", colors: ["#fcfcfa", "#eceae3", "#262626", "#737373", "#171717"] },
  { name: "Abyss Coral", tone: "dark", colors: ["#04121a", "#0a2733", "#fb7185", "#fda4af", "#fff1f2"] },
  { name: "Verdigris", tone: "dark", colors: ["#05130f", "#0d2a22", "#2dd4bf", "#99f6e4", "#f0fdfa"] },
  { name: "Butter Paper", tone: "light", colors: ["#fffdf5", "#fbf3d9", "#a16207", "#eab308", "#221c07"] },
  { name: "Storm Lead", tone: "dark", colors: ["#0b0d10", "#171b21", "#64748b", "#cbd5e1", "#f8fafc"] },
  { name: "Peach Fuzz Studio", tone: "light", colors: ["#fff9f5", "#ffe4d6", "#ea580c", "#fb923c", "#2b1309"] },
];

export const MOODS = [
  "Luxe",
  "Technical",
  "Organic",
  "Playful",
  "Brutalist",
  "Calm",
  "Cinematic",
  "Retro-futurist",
  "Editorial",
  "Minimal",
  "Maximal",
  "Noir",
  "Clinical",
  "Warm",
  "Industrial",
  "Dreamlike",
];

/**
 * Evocative single/double word names for design layers. Combinations are drawn
 * without replacement, so a 42 x 40 grid yields far more than the ~700 design
 * prompts the library needs.
 */
export const NAME_HEADS = [
  "Halcyon", "Vesper", "Komorebi", "Aurum", "Argent", "Obsidian", "Solstice", "Meridian",
  "Quicksilver", "Laminar", "Serigraph", "Tombac", "Strigil", "Pharos", "Shoal", "Tress",
  "Kindle", "Rift", "Nimbus", "Cinder", "Umbra", "Lumen", "Zephyr", "Tessera", "Verdant",
  "Nocturne", "Axiom", "Basalt", "Corvid", "Drift", "Echelon", "Filament", "Glyph",
  "Helix", "Ion", "Jasper", "Kiln", "Lattice", "Monolith", "Nadir", "Opal", "Parallax",
  "Quartz", "Relay", "Sable", "Tundra", "Umber", "Vellum", "Wraith", "Xenon", "Yield",
  "Zenith", "Aperture", "Bellwether", "Caldera", "Doldrum", "Ember", "Fathom", "Gossamer",
];

export const NAME_TAILS = [
  "Gate", "Field", "Hall", "Press", "Studio", "Atlas", "Bloom", "Court", "Drift", "Engine",
  "Form", "Garden", "Harbor", "Index", "Junction", "Kiln", "Line", "Mirror", "Nest", "Orbit",
  "Pavilion", "Quarry", "Ridge", "Shelf", "Terrace", "Vault", "Wave", "Yard", "Arc", "Bank",
  "Bell", "Choir", "Coast", "Deck", "Dome", "Fold", "Forge", "Grove", "Loom", "Mark",
  "Mesa", "Pane", "Pier", "Plinth", "Reach", "Reef", "Road", "Spire", "Stone", "Tide",
];

export const STANDALONE_NAMES = [
  "Aegis", "Boreal", "Cirrus", "Doline", "Estuary", "Fjord", "Gradient", "Halide",
  "Isotope", "Juniper", "Kelp", "Lichen", "Moraine", "Nacre", "Ochre", "Patina",
  "Quill", "Rille", "Serein", "Thicket", "Umbral", "Vitrine", "Wold", "Xylem",
  "Yarrow", "Zircon", "Alloy", "Basin", "Cairn", "Dune", "Eddy", "Flint",
  "Gantry", "Hollow", "Ingress", "Jetty", "Keel", "Ledge", "Mica", "Notch",
  "Oriel", "Prism", "Quoin", "Ravel", "Sill", "Tarn", "Upland", "Verge",
  "Weir", "Yoke",
];
