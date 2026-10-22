const objectTypes = new Set([
  "Rect",
  "rect",
  "Circle",
  "circle",
  "Ellipse",
  "ellipse",
  "Triangle",
  "triangle",
  "Polygon",
  "polygon",
  "Polyline",
  "polyline",
  "Path",
  "path",
  "Textbox",
  "textbox",
  "Text",
  "text",
  "IText",
  "i-text",
  "Image",
  "image",
  "Group",
  "group",
  "Line",
  "line",
]);
const auxiliaryTypes = new Set([
  "linear",
  "radial",
  "Grayscale",
  "Brightness",
  "Contrast",
  "Saturation",
  "Sepia",
  "Invert",
  "HueRotation",
  "Blur",
  "Pixelate",
  "Convolute",
  "shadow",
  "layoutManager",
]);
const filterBounds = {
  Brightness: ["brightness", -1, 1],
  Contrast: ["contrast", -1, 1],
  Saturation: ["saturation", -1, 1],
  HueRotation: ["rotation", -1, 1],
  Blur: ["blur", 0, 1],
  Pixelate: ["blocksize", 1, 64],
};
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
// One shared boundary policy for server persistence and client design imports.
// Uploaded asset ownership is additionally verified by the server.
export function validateCanvasTree(value, { local = false, base = "/" } = {}) {
  let count = 0;
  function visit(node, depth = 0) {
    if (depth > 40) fail("Design is too deeply nested");
    if (!node || typeof node !== "object") return;
    if (typeof node.type === "string") {
      if (objectTypes.has(node.type)) {
        if (++count > 1000)
          fail("A design supports up to 1,000 objects across its pages");
      } else if (!auxiliaryTypes.has(node.type))
        fail("Unsupported design object type");
    }
    const bound = filterBounds[node.type];
    if (bound && node[bound[0]] !== undefined) {
      const v = node[bound[0]];
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < bound[1] ||
        v > bound[2] ||
        (node.type === "Pixelate" && !Number.isInteger(v))
      )
        fail("Invalid image filter adjustment");
    }
    if (
      node.type === "Convolute" &&
      (!Array.isArray(node.matrix) ||
        node.matrix.length !== 9 ||
        node.matrix.some(
          (v) =>
            typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 16,
        ))
    )
      fail("Use a bounded 3 × 3 image convolution");
    for (const [key, child] of Object.entries(node)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        fail("Invalid design property");
      if (
        ["src", "source", "href", "url"].includes(key) &&
        typeof child === "string" &&
        !(!local && /^\/api\/assets\/[a-f0-9-]+\/file$/.test(child)) &&
        child !== "/images/ocean.jpg" &&
        !(
          local &&
          (child === base + "images/ocean.jpg" ||
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(child))
        )
      )
        fail("Use your own uploaded images rather than external URLs");
      if (
        key === "strategy" &&
        typeof child === "string" &&
        !["fit-content", "fixed", "clip-path"].includes(child)
      )
        fail("Unsupported group layout strategy");
      if (key === "text" && typeof child === "string" && child.length > 100000)
        fail("A text box is too long");
      if (
        ["width", "height", "radius", "fontSize", "strokeWidth"].includes(
          key,
        ) &&
        typeof child === "number" &&
        (!Number.isFinite(child) || Math.abs(child) > 100000)
      )
        fail("An object dimension is too large");
      visit(child, depth + 1);
    }
  }
  visit(value);
  return value;
}
