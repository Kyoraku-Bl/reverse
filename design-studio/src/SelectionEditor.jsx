import React from "react";
import { imagePresets } from "./image-editing";
export default function SelectionEditor({
  selected: s,
  update,
  align,
  imageEdit,
  crop,
  replaceImage,
  resetImage,
  downloadPhoto,
  shadow,
  group,
}) {
  if (!s)
    return (
      <p>
        Select any object on the canvas or in Layers to edit it. Double-click
        text to type. Ungroup a grouped layout to edit its individual elements.
      </p>
    );
  const number = (label, value, onChange, min, max, step = 1) => (
    <label key={label}>
      {label}
      <input
        aria-label={label}
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== "" && e.target.validity.valid)
            onChange(+e.target.value);
        }}
      />
    </label>
  );
  return (
    <div className="selection-editor">
      <p>
        {s.type === "image"
          ? "Non-destructive photo editing. The source stays in your library."
          : "Every object stays editable. Select a layer or use the canvas handles."}
      </p>
      {s.locked && (
        <p role="status">
          This layer is locked. Unlock it in Layers before editing.
        </p>
      )}
      <fieldset disabled={s.locked}>
        <h3>Position & size</h3>
        <div className="re-field-grid">
          {number(
            "Object X",
            s.left,
            (v) => update({ left: v }),
            -10000,
            10000,
          )}
          {number("Object Y", s.top, (v) => update({ top: v }), -10000, 10000)}
          {number(
            "Object width",
            s.width,
            (v) => update({ scaleX: v / s.nativeWidth }),
            1,
            10000,
          )}
          {number(
            "Object height",
            s.height,
            (v) => update({ scaleY: v / s.nativeHeight }),
            1,
            10000,
          )}
          {number(
            "Object angle",
            s.angle,
            (v) => update({ angle: v }),
            -360,
            360,
          )}
        </div>
        <label>
          Opacity · {Math.round(s.opacity * 100)}%
          <input
            aria-label="Selection opacity"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={s.opacity}
            onChange={(e) => update({ opacity: +e.target.value })}
          />
        </label>
        <div className="re-field-grid">
          <button
            aria-pressed={s.flipX}
            onClick={() => update({ flipX: !s.flipX })}
          >
            Flip horizontal
          </button>
          <button
            aria-pressed={s.flipY}
            onClick={() => update({ flipY: !s.flipY })}
          >
            Flip vertical
          </button>
        </div>
        <label>
          Align to page
          <select
            aria-label="Align object"
            defaultValue=""
            onChange={(e) => {
              align(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Choose alignment
            </option>
            {["left", "center", "right", "top", "middle", "bottom"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {s.type.includes("text") && (
          <>
            <h3>Text content & effects</h3>
            <label>
              Text
              <textarea
                aria-label="Selected text"
                rows={4}
                maxLength={10000}
                value={s.text}
                onChange={(e) => update({ text: e.target.value })}
              />
            </label>
            {number(
              "Text size",
              s.fontSize,
              (v) => update({ fontSize: v }),
              1,
              1000,
            )}
            {number(
              "Letter spacing",
              s.charSpacing,
              (v) => update({ charSpacing: v }),
              -100,
              1000,
              10,
            )}
            {number(
              "Line height",
              s.lineHeight,
              (v) => update({ lineHeight: v }),
              0.5,
              3,
              0.05,
            )}
            <div className="re-field-grid">
              <button
                aria-pressed={s.underline}
                onClick={() => update({ underline: !s.underline })}
              >
                Underline
              </button>
              <button
                aria-pressed={s.linethrough}
                onClick={() => update({ linethrough: !s.linethrough })}
              >
                Strikethrough
              </button>
            </div>
            <p>
              Use the Text tab for fonts, bold, italic and paragraph alignment.
            </p>
          </>
        )}
        {s.type !== "image" && (
          <label>
            Fill color
            <input
              aria-label="Selection fill"
              type="color"
              value={/^#[\da-f]{6}$/i.test(s.fill) ? s.fill : "#29352b"}
              onChange={(e) => update({ fill: e.target.value })}
            />
          </label>
        )}
        <h3>Border & shadow</h3>
        <label>
          Border color
          <input
            aria-label="Border color"
            type="color"
            value={/^#[\da-f]{6}$/i.test(s.stroke) ? s.stroke : "#29352b"}
            onChange={(e) => update({ stroke: e.target.value })}
          />
        </label>
        {number(
          "Border width",
          s.strokeWidth,
          (v) => update({ strokeWidth: v }),
          0,
          100,
        )}
        {s.type === "rect" &&
          number(
            "Corner radius",
            s.rx,
            (v) => update({ rx: v, ry: v }),
            0,
            500,
          )}
        <label>
          Shadow
          <select
            aria-label="Object shadow"
            value={s.shadow ? "soft" : "none"}
            onChange={(e) => shadow(e.target.value)}
          >
            <option value="none">None</option>
            <option value="soft">Soft drop shadow</option>
          </select>
        </label>
        {s.type === "group" && (
          <button className="re-wide" onClick={group}>
            Ungroup to edit individual elements
          </button>
        )}
        {s.type === "image" && (
          <>
            <h3>Photo editor</h3>
            <label>
              Photo look
              <select
                aria-label="Photo look"
                defaultValue=""
                onChange={(e) => {
                  imageEdit("preset", e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Apply a look (replaces adjustments)
                </option>
                {imagePresets.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {[
              ["brightness", -1, 1, 0.01],
              ["contrast", -1, 1, 0.01],
              ["saturation", -1, 1, 0.01],
              ["hue", -1, 1, 0.01],
              ["blur", 0, 1, 0.01],
              ["pixelate", 1, 40, 1],
            ].map(([key, min, max, step]) => (
              <label key={key}>
                {key} · {s.image[key]}
                <input
                  aria-label={"Photo " + key}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={s.image[key]}
                  onChange={(e) => imageEdit(key, +e.target.value)}
                />
              </label>
            ))}
            <div className="re-toggle-grid">
              {["grayscale", "sepia", "invert"].map((key) => (
                <button
                  key={key}
                  aria-pressed={s.image[key]}
                  onClick={() => imageEdit(key, !s.image[key])}
                >
                  {key}
                </button>
              ))}
            </div>
            <h3>Crop original image (%)</h3>
            <p>
              Margins from the source edges. Cropping is reversible and does not
              stretch the image.
            </p>
            <div className="re-field-grid">
              {["left", "top", "right", "bottom"].map((key) =>
                number(
                  "Crop " + key,
                  s.crop[key],
                  (v) => crop({ [key]: v }),
                  0,
                  95,
                ),
              )}
            </div>
            <button
              className="re-wide"
              onClick={() => crop({ left: 0, top: 0, right: 0, bottom: 0 })}
            >
              Reset crop
            </button>
            <button className="re-wide" onClick={replaceImage}>
              Replace selected image
            </button>
            <button className="re-wide" onClick={resetImage}>
              Reset photo adjustments
            </button>
            <button className="re-primary re-wide" onClick={downloadPhoto}>
              Download edited photo PNG
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}
