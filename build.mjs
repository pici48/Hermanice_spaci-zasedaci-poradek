#!/usr/bin/env node
// Postavi index.html z template.html + assets/*.jpg.
//
// Proc to existuje: do 20. 8. 2026 zadny build skript nebyl a pudorysy zily
// vyhradne jako base64 uvnitr index.html. Template se tim stal nepouzitelny
// a kdyby se index.html ztratil, plansky by byly nenavratne. Ted je zdroj
// template + assets a index.html je odvozeny artefakt.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(here, "template.html");
const OUT = join(here, "index.html");

const IMAGES = {
  __IMG_POD__: "podkrovi.jpg",
  __IMG_PRI__: "prizemi.jpg",
  __IMG_SEZ__: "zasedacka.jpg",
};

let html = readFileSync(TEMPLATE, "utf8");

for (const [placeholder, file] of Object.entries(IMAGES)) {
  if (!html.includes(placeholder)) {
    console.error(`CHYBA: placeholder ${placeholder} v template nenalezen`);
    process.exit(1);
  }
  const b64 = readFileSync(join(here, "assets", file)).toString("base64");
  html = html.replace(placeholder, `data:image/jpeg;base64,${b64}`);
}

const left = html.match(/__IMG_[A-Z]+__/g);
if (left) { console.error("CHYBA: nesubstituovane placeholdery:", left.join(", ")); process.exit(1); }

writeFileSync(OUT, html);
console.log(`index.html postaven: ${(html.length / 1024).toFixed(0)} KB`);
