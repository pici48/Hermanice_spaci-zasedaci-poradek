#!/usr/bin/env node
/**
 * Vygeneruje blok GUESTS do template.html ze souboru `hosti.csv`.
 *
 * Proč to existuje: seznam hostů se mění až do poslední chvíle a přepisovat ho
 * ručně uvnitř HTML je otrava. Tohle si ho vezme z tabulky, kterou umí vyplnit
 * kdokoli v Excelu nebo Google Sheets (export → CSV).
 *
 * Použití:
 *   node gen-guests.mjs            vypíše blok na obrazovku (nic nemění)
 *   node gen-guests.mjs --zapsat   rovnou ho vloží do template.html
 *
 * Formát CSV (oddělovač středník, první řádek je hlavička):
 *
 *   jmeno;skupinka;spani;ucast;jenMisto
 *   Matka nevěsty;Rodina nevěsty;?;ano;
 *   Oddávající;Obřad a služby;ne;ano;1
 *
 *   spani     ano | ne | ?      ? = zatím nevyplněno (NENÍ totéž co „ne")
 *   ucast     ano | nejista | ne
 *   jenMisto  1 = dostane místo u stolu, ale nespí (oddávající, fotograf, kapela)
 *
 * POZOR na `id`: generuje se ze jména a skupinky. Uložené rozvržení se na `id`
 * váže, takže když někomu po rozsazení změníte jméno, přijde o své lůžko i místo.
 * Přejmenovávejte před rozsazováním, ne po něm.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CSV = join(here, "hosti.csv");
const TPL = join(here, "template.html");

if (!existsSync(CSV)) {
  console.error(`Chybí ${CSV}.\nZkopírujte si vzor:  cp hosti.vzor.csv hosti.csv`);
  process.exit(1);
}

const DIA = { á:"a", č:"c", ď:"d", é:"e", ě:"e", í:"i", ň:"n", ó:"o", ř:"r",
              š:"s", ť:"t", ú:"u", ů:"u", ý:"y", ž:"z" };
const slug = s => s.toLowerCase().replace(/[áčďéěíňóřšťúůýž]/g, c => DIA[c])
                   .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SPANI = { "ano": "yes", "ne": "no", "?": "unk", "": "unk" };
const UCAST = { "ano": "ok", "nejista": "q", "nejistá": "q", "ne": "x" };

const lines = readFileSync(CSV, "utf8").split(/\r?\n/)
  .map(l => l.trim()).filter(Boolean);
if (!/^jmeno;/i.test(lines[0])) {
  console.error("První řádek CSV musí být hlavička: jmeno;skupinka;spani;ucast;jenMisto");
  process.exit(1);
}

const seen = new Map();
const out = lines.slice(1).map((line, i) => {
  const [jmeno, skupinka, spani = "?", ucast = "ano", jenMisto = ""] = line.split(";").map(x => (x || "").trim());
  if (!jmeno || !skupinka) { console.error(`Řádek ${i + 2}: chybí jméno nebo skupinka — "${line}"`); process.exit(1); }
  const sp = SPANI[spani.toLowerCase()];
  const uc = UCAST[ucast.toLowerCase()];
  if (sp === undefined) { console.error(`Řádek ${i + 2}: neznámé spaní "${spani}" (ano|ne|?)`); process.exit(1); }
  if (uc === undefined) { console.error(`Řádek ${i + 2}: neznámá účast "${ucast}" (ano|nejista|ne)`); process.exit(1); }

  let id = slug(jmeno) + "_" + slug(skupinka);
  const n = (seen.get(id) || 0) + 1; seen.set(id, n);
  if (n > 1) id += "_" + n;                      // dva stejně pojmenovaní ve stejné skupince
  return { id, jmeno, skupinka, sp, uc, seat: jenMisto === "1" };
});

const ids = out.map(o => o.id);
if (new Set(ids).size !== ids.length) throw new Error("kolize id — tohle by nemělo nastat");

const blok = "const GUESTS=[\n"
  + out.map(o => ` ["${o.id}","${o.jmeno}","${o.skupinka}","${o.sp}","${o.uc}"${o.seat ? ",1" : ""}]`).join(",\n")
  + ",\n].map(g=>({id:g[0],name:g[1],group:g[2],spani:g[3],\n"
  + "  ucast:g[4],seatOnly:!!g[5],kid:g[2]===\"Děti\"}));";

if (process.argv.includes("--zapsat")) {
  let t = readFileSync(TPL, "utf8");
  const a = t.indexOf("const GUESTS=[");
  const b = t.indexOf("kid:g[2]===\"Děti\"}));", a);
  if (a < 0 || b < 0) { console.error("V template.html se nenašel blok GUESTS."); process.exit(1); }
  t = t.slice(0, a) + blok + t.slice(b + "kid:g[2]===\"Děti\"}));".length);
  writeFileSync(TPL, t);
  console.error(`Zapsáno do template.html (${out.length} osob). Nezapomeňte na: node build.mjs`);
} else {
  console.log(blok);
  console.error("\n(nic se nezměnilo — pro zápis přidejte --zapsat)");
}

// --- kontrolní souhrn jde na stderr, ať nekazí výpis bloku ---
const hoste = out.filter(o => !o.seat);
console.error("--- kontrola ---");
console.error("řádků celkem:      ", out.length);
console.error("hostů (bez služeb):", hoste.length,
  `| přijde ${hoste.filter(g => g.uc === "ok").length}`,
  `· nejistí ${hoste.filter(g => g.uc === "q").length}`,
  `· nedorazí ${hoste.filter(g => g.uc === "x").length}`);
console.error("spaní:              ano", hoste.filter(g => g.sp === "yes").length,
  "| ne", hoste.filter(g => g.sp === "no").length,
  "| nevyplněno", hoste.filter(g => g.sp === "unk").length);
console.error("jen místo u stolu: ", out.filter(o => o.seat).length);
console.error("k stolu max:       ", out.filter(o => o.uc !== "x").length);
const skupiny = [...new Set(out.map(o => o.skupinka))];
console.error("skupinky:          ", skupiny.join(", "));
console.error("\nZkontrolujte, že všechny skupinky máte i v GROUP_COLORS v template.html,\njinak dostanou šedou.");
