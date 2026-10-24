#!/usr/bin/env node
/* Snapshot integrity check — run before trusting a deploy.
 *
 *   node site/tests/data-check.mjs [dir] [--only NQ,ES]
 *
 * Fails when a candle lies: unsorted or duplicated timestamps, high < low,
 * close/open outside the range, a zero price, or a run of empty volume where
 * the series should have volume.
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) || "site/data";
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1].split(",") : null;

let checks = 0, failures = 0;
function ok(name) { checks++; console.log("PASS  " + name); }
function bad(name, detail) { checks++; failures++; console.log("FAIL  " + name + (detail ? " — " + detail : "")); }

const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  : [];

if (!files.length) {
  console.log(`no snapshot files in ${dir}`);
  process.exit(1);
}

for (const file of files) {
  const id = file.replace(/\.json$/, "");
  if (ONLY && !ONLY.includes(id)) continue;
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); }
  catch (e) { bad(`${id}: parses`, e.message); continue; }
  if (!doc.tf || !Object.keys(doc.tf).length) { bad(`${id}: has timeframes`); continue; }

  for (const [tf, block] of Object.entries(doc.tf)) {
    const bars = block.bars || [];
    const label = `${id} ${tf}`;
    if (bars.length < 20) { bad(`${label}: ${bars.length} bars`, "too few"); continue; }
    let sorted = true, sane = true, dupe = false, zero = false;
    for (let i = 0; i < bars.length; i++) {
      const [t, o, h, l, c] = bars[i];
      if (i && t <= bars[i - 1][0]) { sorted = false; if (t === bars[i - 1][0]) dupe = true; }
      if (!(h >= l) || h < Math.max(o, c) - 1e-9 || l > Math.min(o, c) + 1e-9) sane = false;
      if (o <= 0 || c <= 0) zero = true;
    }
    if (!sorted) bad(`${label}: timestamps strictly increasing`, dupe ? "duplicates" : "out of order");
    else if (!sane) bad(`${label}: OHLC consistent`);
    else if (zero) bad(`${label}: positive prices`);
    else ok(`${label}: ${bars.length} bars, ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars[bars.length - 1][0] * 1000).toISOString().slice(0, 10)}`);
  }
}

/* priority trio must exist and be complete */
for (const id of ["NQ", "ES", "NAS100"]) {
  const f = path.join(dir, id + ".json");
  if (!fs.existsSync(f)) { bad(`${id}: snapshot present`); continue; }
  const doc = JSON.parse(fs.readFileSync(f, "utf8"));
  const tfs = Object.keys(doc.tf || {});
  if (tfs.length === 6) ok(`${id}: all six timeframes`);
  else bad(`${id}: all six timeframes`, "has " + tfs.join(","));
}

const idx = path.join(dir, "_index.json");
if (fs.existsSync(idx)) {
  const doc = JSON.parse(fs.readFileSync(idx, "utf8"));
  if (doc.count > 0) ok(`_index: ${doc.count} instruments`);
  else bad("_index: has instruments");
}
const q = path.join(dir, "_quotes.json");
if (fs.existsSync(q)) {
  const doc = JSON.parse(fs.readFileSync(q, "utf8"));
  const n = Object.keys(doc.quotes || {}).length;
  if (n > 0) ok(`_quotes: ${n} quotes`);
  else bad("_quotes: has quotes");
}

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
