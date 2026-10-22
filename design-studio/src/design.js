import { templateRecipe } from "./template-catalog";
import { IS_STATIC, assetUrl } from "./config";
import { validateCanvasTree } from "../shared/design-validation.mjs";
import { Textbox, Rect, Circle, FabricImage } from "fabric";
export const uid = () => crypto.randomUUID();
// Fabric resolves image URLs against the browser origin. Store portable, same-origin
// paths at the serialization boundary, including images nested in groups.
export function serializeCanvas(value) {
  const json =
    typeof value.toJSON === "function"
      ? value.toJSON()
      : structuredClone(value);
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "Image" && typeof node.src === "string") {
      const url = new URL(node.src, location.origin);
      if (url.origin === location.origin) node.src = url.pathname + url.search;
    }
    Object.values(node).forEach((child) => {
      if (child && typeof child === "object") visit(child);
    });
  };
  visit(json);
  return json;
}
const base = { originX: "left", originY: "top" };
export async function documentFromTemplate(item) {
  const width = item.width || 1200,
    height = item.height || 800;
  if (item.style === "photo" && item.upload) {
    const img = await FabricImage.fromURL(item.upload);
    if (img.width * img.height > 40000000)
      throw new Error("Image dimensions are too large");
    const scale = Math.min(1, 4096 / Math.max(img.width, img.height));
    const w = Math.max(64, Math.round(img.width * scale)),
      h = Math.max(64, Math.round(img.height * scale));
    img.set({
      ...base,
      left: 0,
      top: 0,
      scaleX: w / img.width,
      scaleY: h / img.height,
    });
    return {
      version: 1,
      width: w,
      height: h,
      pages: [
        {
          id: uid(),
          canvas: serializeCanvas({
            version: "7.4.0",
            background: "#ffffff",
            objects: [img.toObject()],
          }),
        },
      ],
    };
  }
  const objects = [];
  if (item.style === "original") {
    for (const n of templateRecipe(item)) {
      const common = {
        ...base,
        left: n.x * width,
        top: n.y * height,
        fill: n.fill,
      };
      if (n.kind === "rect")
        objects.push(
          new Rect({ ...common, width: n.w * width, height: n.h * height }),
        );
      if (n.kind === "circle")
        objects.push(new Circle({ ...common, radius: n.r * width }));
      if (n.kind === "text")
        objects.push(
          new Textbox(n.text, {
            ...common,
            width: n.w * width,
            fontSize: n.size * width,
            fontFamily: n.fontFamily,
            fontWeight: n.fontWeight || 400,
            fontStyle: n.fontStyle || "normal",
            textAlign: n.textAlign || "left",
            lineHeight: n.lineHeight || 1.16,
            charSpacing: n.charSpacing || 0,
          }),
        );
    }
    return {
      version: 1,
      width,
      height,
      pages: [
        {
          id: uid(),
          canvas: serializeCanvas({
            version: "7.4.0",
            background: item.color,
            objects: objects.map((o) => o.toObject()),
          }),
        },
      ],
    };
  }
  const text = (value, x, y, size, options = {}) =>
    objects.push(
      new Textbox(value, {
        ...base,
        left: x * width,
        top: y * height,
        width: width * 0.83,
        fontSize: size * width,
        fontFamily: "Georgia",
        fill: "#384534",
        ...options,
      }),
    );
  const circle = (x, y, r, fill) =>
    objects.push(
      new Circle({
        ...base,
        left: x * width,
        top: y * height,
        radius: r * width,
        fill,
        selectable: true,
      }),
    );
  let background = item.color || "#eee8dd";
  if (item.style === "summer" || item.upload) {
    const img = await FabricImage.fromURL(
      item.upload || assetUrl("images/ocean.jpg"),
    );
    const scale = Math.max(width / img.width, height / img.height);
    img.set({ ...base, left: 0, top: 0, scaleX: scale, scaleY: scale });
    objects.push(img);
    text("THE ART OF SLOWING DOWN", 0.07, 0.065, 0.009, {
      fontFamily: "DM Sans",
      fill: "#ffffff",
      charSpacing: 250,
    });
    text(item.text || "A slower kind\nof summer.", 0.07, 0.44, 0.065, {
      fill: "#ffffff",
      fontStyle: "italic",
    });
    text(item.sub || "LESS SCROLLING. MORE LIVING.", 0.07, 0.88, 0.011, {
      fill: "#ffffff",
      fontFamily: "DM Sans",
    });
  } else if (item.style === "good") {
    text("A NOTE TO SELF", 0.08, 0.065, 0.012, {
      fontFamily: "DM Sans",
      charSpacing: 250,
    });
    text(item.text || "GOOD\nTHINGS\nTAKE TIME", 0.1, 0.21, 0.083, {
      fontFamily: "Manrope",
      fontWeight: "800",
      lineHeight: 0.95,
      fill: "#254f2d",
      angle: -5,
    });
    text("✳", 0.66, 0.61, 0.26, { fill: "#568a41" });
    text(item.sub || "A little reminder for your day", 0.08, 0.92, 0.012, {
      fontFamily: "DM Sans",
    });
  } else if (item.style === "forma") {
    text("A STUDIO FOR EVERYDAY LIVING", 0.08, 0.06, 0.01, {
      fontFamily: "DM Sans",
      charSpacing: 200,
    });
    text(item.text || "forma", 0.16, 0.13, 0.17, { width: width * 0.7 });
    text(item.sub || "THOUGHTFUL DESIGN. EVERY DAY.", 0.16, 0.47, 0.012, {
      fontFamily: "DM Sans",
      charSpacing: 100,
    });
    objects.push(
      new Rect({
        ...base,
        left: width * 0.3,
        top: height * 0.6,
        width: width * 0.14,
        height: height * 0.25,
        rx: 30,
        ry: 30,
        fill: "#b9a68d",
      }),
      new Rect({
        ...base,
        left: width * 0.49,
        top: height * 0.55,
        width: width * 0.13,
        height: height * 0.3,
        rx: 50,
        ry: 50,
        fill: "#9da584",
      }),
    );
  } else {
    circle(0.72, 0.1, 0.21, "#9baa85");
    circle(0.83, 0.2, 0.2, "#bcc4a6");
    circle(0.73, 0.52, 0.13, "#d6bd9a");
    text("THE CREATIVE EDIT / 2026", 0.07, 0.065, 0.012, {
      fontFamily: "DM Sans",
      charSpacing: 200,
    });
    text(item.text || "Your next\nbig idea.", 0.07, 0.34, 0.08, {
      lineHeight: 1,
    });
    text(item.sub || "MAKE SOMETHING GREAT.", 0.07, 0.85, 0.015, {
      fontFamily: "DM Sans",
    });
  }
  return {
    version: 1,
    width,
    height,
    pages: [
      {
        id: uid(),
        canvas: serializeCanvas({
          version: "7.4.0",
          background,
          objects: objects.map((o) => o.toObject()),
        }),
      },
    ],
  };
}
export function validateImport(value) {
  if (
    value?.version !== 1 ||
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    value.width < 64 ||
    value.height < 64 ||
    value.width > 4096 ||
    value.height > 4096 ||
    !Array.isArray(value.pages) ||
    !value.pages.length ||
    value.pages.length > 50
  )
    throw new Error(
      "Choose an Open Studio design JSON file (64–4096 px, up to 50 pages).",
    );
  for (const p of value.pages) {
    if (
      !p?.id ||
      !Array.isArray(p.canvas?.objects) ||
      p.canvas.objects.length > 300
    )
      throw new Error("Invalid page");
  }
  if (IS_STATIC) {
    const portable = (node) => {
      if (!node || typeof node !== "object") return;
      for (const [key, child] of Object.entries(node)) {
        if (
          ["src", "source", "url", "href"].includes(key) &&
          typeof child === "string" &&
          /^\/(?:[^?#]*\/)?images\/ocean\.jpg$/.test(child)
        )
          node[key] = assetUrl("images/ocean.jpg");
        else portable(child);
      }
    };
    portable(value);
  }
  return validateCanvasTree(value, {
    local: IS_STATIC,
    base: import.meta.env.BASE_URL,
  });
}
