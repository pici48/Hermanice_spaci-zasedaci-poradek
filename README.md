# Ubytování a zasedací pořádek

Webová appka na rozvrhování **kdo kde spí** a **kdo kde sedí** — přímo na
půdorysech místa konání.

Bez instalace, bez přihlašování: otevřete odkaz, klikáte na lůžka a židle,
všichni organizátoři vidí totéž během pár vteřin.

`index.html` jde otevřít rovnou z disku — appka naběhne v lokálním režimu
s ukázkovými hosty a je vidět, co umí. Stav se pak ukládá jen v prohlížeči,
ne na server.

Druhá polovina README je [brief pro AI agenta](#brief-pro-ai-agenta), který
appku nasadí a upraví.

---

## Co to umí

**Dvě záložky, přepínají se nahoře.**

| | |
|---|---|
| **Spaní** | Půdorysy podkroví a přízemí s každým lůžkem jako klikacím místem. Stany a „jinde / dojíždí" jako seznamy. |
| **Zasedací pořádek** | Plán velké stodoly, 68 míst u čtyř stolů. Podporuje **víc variant rozsazení**, které se přepínají a dají se pojmenovat. |

Dál:

- **Sdílený stav.** Všichni, kdo mají odkaz, vidí to samé. Ukládá se automaticky
  600 ms po každé změně, cizí změny se stahují každých 8 vteřin.
- **Historie.** Drží se 12 posledních verzí, dá se vrátit zpátky.
- **Hlídání kapacit.** Počítadla „na statku / jinde / neuloženo / neurčeno"
  a varování, když se překročí ubytovací strop nebo počet židlí na hostině.
- **Matrace na zem.** U každého pokoje jde přidat místo na zemi nad rámec
  postelí, bez zásahu do kódu.
- **Skupinky hostů** barevně odlišené (rodina, přátelé, kolegové, děti…).
- **Hledání** podle jména.
- **Tisk / PDF** — vygeneruje přehled po pokojích a po stolech, hodí se na cedulky.
- **Export / import JSON** jako záloha.
- **Funguje na mobilu**, půdorysy se dají přibližovat.

---

## Nasazení

Appka běží na Vercelu. Plán **Hobby** je pro nekomerční použití zdarma, vlastní
doména není potřeba — Vercel dá adresu typu `nazev-projektu.vercel.app`.
Aktuální podmínky na [vercel.com/pricing](https://vercel.com/pricing).

1. Účet na [vercel.com](https://vercel.com), propojit s GitHubem.
2. **Add New → Project**, vybrat tohle repo, **Deploy**.
3. V projektu **Storage → Create Database → Blob**, připojit k projektu. Tím
   vznikne nastavení `BLOB_READ_WRITE_TOKEN`, které appka potřebuje.
   **Bez tohohle kroku se stav nesdílí** — každý vidí jen svoje.
4. Vercel dá odkaz. Ten odkaz je celá appka.

> **Vercel nenasadí to, co v repu už bylo.** Reaguje na *nový* push, ne na
> aktuální stav. Když po napojení nic nenaběhne, dejte v dashboardu
> **Redeploy**.

Vercel Blob má na bezplatném tarifu limit počtu operací. Jedna akce s několika
organizátory je hluboko pod ním.

---

## Nastavení akce

Všechno se mění v `template.html`, otevře se v jakémkoli textovém editoru.
Nahoře za `<script>` je blok `NASTAVENÍ AKCE` — **jediné místo pro texty
a kapacity**:

```js
const EVENT = {
  akce:         "Jméno akce",          // např. „Svatba Novákových"
  datum:        "1. ledna 2027",
  misto:        "Statek Heřmanice",
  editori:      ["Organizátor 1", "Organizátor 2"],  // rozbalovátko „Kdo jsi…"
  stropSpani:   38,                    // kolik lidí smí přespat (budova + stany)
  stropHostina: 70,                    // kolik se vejde na hostinu
};
```

**Po každé úpravě `template.html` je nutný `node build.mjs`**, jinak se změna
na web nedostane. `./deploy.sh "popis změny"` udělá build i nahrání najednou.

---

## Seznam hostů

Hosté jsou pod blokem `EVENT`, označení `HOSTÉ`. V repu jsou ukázkoví lidé,
přepíšou se skutečnými.

Kdo chce vyjít z tabulky: zkopírovat `hosti.vzor.csv` na `hosti.csv`, vyplnit
v Excelu, spustit `node gen-guests.mjs --zapsat`. Seznam se vygeneruje a zapíše
do šablony.

`hosti.csv` se schválně neukládá do gitu, aby se jména hostů nedostala
na internet.

---

## Co je potřeba dodělat

### 1. Kdo zná odkaz, může rozpis přepsat

Appka nemá přihlašování ani hesla. **Kdokoli, kdo dostane odkaz, může rozvržení
změnit nebo smazat.** Dokud odkaz znají jen dva tři organizátoři, je to jedno.
Jakmile půjde hostům e-mailem nebo bude někde veřejně, je to problém.

Server má pojistku proti smazání všeho najednou a drží 12 verzí zpátky, takže
se z omylu dá vycouvat. Je to záchranná brzda, ne zámek.

Možnosti podle náročnosti (detaily v briefu pro agenta):

- **Vercel Password Protection** — jedno heslo na celý web, zapíná se
  v nastavení projektu, nulový zásah do kódu. Placená funkce.
- **Sdílené heslo v kódu** — pár řádků práce, zdarma.
- **Odkaz s tajným kódem** v adrese.

### 2. Zakreslené rozložení odpovídá současnému stavu statku

V kódu je zanesené tohle:

| Zóna | Co je zakreslené |
|---|---|
| **Podkroví** — 20 lůžek | Pokoj 01 (manželská, vlastní koupelna a obývací kout), Pokoj 02 a Pokoj 03 (manželská), Pokoj 04 — spací sál: 12 jednolůžek + rozkládací gauč pro 2 |
| **Přízemí** — 12 lůžek | Pokoj 05b, 06 a 08 (manželská), Pokoj 05a (rozkládací gauč pro 2), Pokoj 07 (manželská + rozkládací gauč pro 2) |
| **Stany s podsádkou** — 8 míst | 4 stany po 2 místech |
| **Zasedačka ve stodole** — 68 míst | Stůl 1, 2 a 3: vždy 9 židlí na každé straně + 1 v čele = 19. Stůl 4 u zdi: 9 z boku + 2 v čele = 11 |

Dohromady **32 lůžek v budově, 8 ve stanech, 68 židlí u stolů.**

Pozice každého lůžka a každé židle jsou ručně odměřené v pixelech proti
konkrétním obrázkům v `assets/`. Když se přestaví pokoj, přibude postel nebo
se změní rozestavení stolů, musí se souřadnice přepsat v kódu — editor plánků
v appce není. Je to nejpracnější část případné úpravy.

Drobné navýšení se ale řešit v kódu nemusí: u každého pokoje jde v appce
přidat matrace na zem tlačítkem „přidat na zem".

### 3. Drobnosti

- **Jen česky.** Texty jsou v kódu, mimo blok `EVENT`.
- **Jedna akce na jedno nasazení.** Pro dvě souběžné akce nasadit dvakrát,
  každé s vlastním úložištěm.
- **Otevřená karta, která se dlouho nemůže spojit se serverem**, umí vyčerpat
  bezplatný limit operací opakovanými pokusy. Stalo se to jednou a appka byla
  na den nečitelná.
- **Fotky hostů ani poznámky u lidí appka neumí** — jen jméno, skupinka, spaní
  a účast.
- **Nikdo nedostane e-mail ani pozvánku.** Je to plánovací nástroj pro
  organizátory, ne komunikace s hosty.

---
---

# Brief pro AI agenta

Zadání pro asistenta nebo vývojáře, který appku přebírá.

## Shrnutí

Jednostránková appka bez frameworku a bez bundleru. Veškerá logika, styly
i data jsou v `template.html` (~1 700 řádků). `build.mjs` do něj vloží tři JPEG
půdorysy jako base64 a vyplivne `index.html`, což je to, co Vercel servíruje.
Sdílený stav drží jedna serverless funkce `api/state.js` nad Vercel Blob,
zamykaná optimisticky přes číslo verze. Klient si stav zrcadlí do
`localStorage`, takže appka funguje i bez serveru — bez sdílení.

## Struktura repa

```
template.html    ZDROJ — logika, styly, data hostů, plánky. Jediný soubor.
assets/*.jpg     Půdorysy (podkroví, přízemí, plán stodoly).
build.mjs        Vloží obrázky jako base64 do template → index.html.
index.html       ODVOZENÝ soubor. Je v gitu schválně — Vercel ho servíruje.
api/state.js     Serverless funkce: sdílený stav ve Vercel Blob.
gen-guests.mjs   Vygeneruje blok GUESTS z hosti.csv.
hosti.vzor.csv   Vzor vstupu pro gen-guests.
deploy.sh        Build + kontroly + commit + push.
cdp-vers.mjs     Testy variant zasedačky (headless Chrome přes DevTools Protocol).
vercel.json      Konfigurace nasazení.
```

## Orientace v `template.html`

Soubor je členěný bannerovými komentáři. **Hledej je, ne čísla řádků** — ta se
posunou při první úpravě.

| Kotva | Co tam je |
|---|---|
| `/* ==== NASTAVENÍ AKCE ====` | `EVENT` — názvy, datum, editoři, kapacity. Propisuje se do `document.title`, `header .sub` a selectu `#who`. |
| `/* ==== HOSTÉ ====` | `GUESTS` — pole `[id, jméno, skupinka, spaní, účast, seatOnly?]`. |
| `PLANS` / `ZONES` | Obrázky půdorysů a ručně odměřené souřadnice pokojů a lůžek. |
| `HOUSE_ZONES` | Které zóny se počítají do ubytovacího stropu. |
| `TABLES` / `XS` / `YS` | Stoly a židle v zasedačce, 68 míst. |
| `GROUP_COLORS` | Barvy skupinek. Klíče musí sedět se `skupinka` u hostů. |
| `/* ==== SYNC SE SERVEREM ====` | `initSync`, `applyRemote`, `showConflict`, push se serverem. |

### Volitelné vlastnosti zón a pokojů

V ukázkových datech se nepoužívají, ale kód je podporuje:

- `zóna.editable:1` — u každého pokoje v zóně se zobrazí políčko „Kapacita:
  N lůžek". Hodí se pro zóny, kde se počet míst mění (ubytování mimo areál,
  přistýlky). Přepis se ukládá do `S.caps`.
- `zóna.cap:null` — zóna se nepočítá do ubytovacího stropu (viz `HOUSE_ZONES`).
- `pokoj.note` — kurzivní poznámka pod názvem pokoje.
- `pokoj.warn:1` — obarví tu poznámku jantarově.

## Tvar stavu

```js
{ assign: {}, spani: {}, caps: {}, floor: {}, seats: {}, seatVers: null, seatCur: null }
```

| Klíč | Význam |
|---|---|
| `assign` | `bedId → guestId` — kdo kde spí |
| `seats` | `seatId → guestId` — kdo kde sedí (aktivní varianta) |
| `seatVers` | `název varianty → mapa sedaček` — pojmenované varianty rozsazení |
| `seatCur` | název právě otevřené varianty |
| `spani` | ruční přepis údaje „spí / nespí / nevyplněno" proti seznamu hostů |
| `caps` | ruční přepis kapacity pokoje |
| `floor` | počet matrací na zemi v pokoji |

## API

`api/state.js`, jediný endpoint `/api/state`:

| Volání | Co udělá |
|---|---|
| `GET` | aktuální stav `{version, updatedAt, updatedBy, data}` |
| `GET ?history=1` | přehled posledních 12 verzí |
| `GET ?version=N` | konkrétní verze (obnova) |
| `PUT` `{version, by, data}` | zápis; `version` je verze, na které klient stavěl |

Odpovědi na `PUT`:

- `200` + nový payload — uloženo
- `409 {conflict:true, current}` — mezitím zapsal někdo jiný; klient si vezme
  serverovou verzi a svoje změny nabídne nemodální lištou
- `409 {blocked:"would_erase", current}` — zápis by smazal všechna přiřazení;
  projde jen s `force:true`

## Pravidla, která z kódu nevykoukáš

Každý bod je „změníš X, **musíš** i Y". Všechny stály čas při vývoji.

**Úprava `template.html` → `node build.mjs`.** Vercel servíruje `index.html`.
Bez buildu vypadá změna v gitu hotově, ale na webu není. `deploy.sh` to hlídá.

**Nové pole ve stavu → přidat do whitelistu v `api/state.js`.** Server skládá
`next.data` z explicitního seznamu klíčů a co v něm není, **tiše zahodí**.
Přesně tohle sežralo varianty zasedačky: `seatVers` a `seatCur` v seznamu
chyběly, takže varianty žily jen v `localStorage` jednotlivých zařízení
a nikdy se nepotkaly.

**`id` hosta je kotva.** Uložené rozvržení se váže na `id`, které
`gen-guests.mjs` odvozuje ze jména a skupinky. Přejmenování hosta po rozsazení
mu sebere lůžko i židli. Přejmenovávat před rozsazováním, nebo přepsat `id`
ručně.

**Klíče `GROUP_COLORS` musí sedět se sloupcem `skupinka`.** Jinak se host
vyrenderuje šedě a nikde to nevyhlásí chybu.

**Souřadnice v `PLANS`, `ZONES` a `TABLES` patří ke konkrétním JPEGům
v `assets/`.** Jsou odměřené ručně v pixelech proti referenčnímu rozměru
(`ref`). Výměna obrázku bez přeměření rozhází celý plánek.

**Prázdné „spaní" neznamená „nespí", znamená „nevyplněno".** V kódu `unk`.
Appka to odlišuje a počítá zvlášť, jinak by tvrdila, že jsou všichni uloženi.
Neslučovat.

**Nikdy nezapisovat prázdný stav s `force:true`.** Obchází to serverovou
pojistku. Jednou to smazalo hotové rozvržení a muselo se obnovovat z historie.
Při testech mířit na lokální soubor, ne na ostrý endpoint.

**Vercel Blob vynucuje minimálně 60 s CDN cache.** Proto se nepřepisuje stejná
cesta, ale každá verze jde do nové (`state/<verze>-<čas>.json`) a nejnovější se
hledá přes `list()`, které jde na API, ne přes CDN. Bez toho se zápisy tiše
ztrácely. Nezjednodušovat zpátky na jednu cestu.

**Žádné blokující `confirm()` v cestě startu.** Dřív při konfliktu naskočil
nativní `confirm()`, který zmrazil celou appku, dokud na něj někdo neklikl —
a protože si ho nikdo nevšiml, vypadalo to, že se appka nenačítá. Konflikty
řeší nemodální lišta (`showConflict`). Blokující dialog to rozbije znovu
a navíc zablokuje `Runtime.evaluate` v testech.

**Mobil se dá testovat jen přes CDP `Emulation.setDeviceMetricsOverride`.**
Headless Chrome s `--window-size` clampuje viewport na 500 px. Vzor je
v `cdp-vers.mjs`.

## Přidání autorizace

`api/state.js` momentálně přijímá `PUT` od kohokoli — viz *Co je potřeba
dodělat*. Nejlevnější zásah:

1. Nastavit ve Vercelu proměnnou prostředí, např. `SDILENE_HESLO`.
2. V handleru pro `PUT`/`POST` porovnat `req.headers["x-heslo"]` s ní
   a jinak vrátit `401`.
3. V `template.html` doplnit tu hlavičku do obou `fetch(API, {method:"PUT"…})`
   a heslo si po jednom dotazu uložit do `localStorage`.

Chrání to zápis, ne čtení. Na ochranu čtení použít Vercel Password Protection
nebo tajný kód v URL.

## Vývoj a testy

```sh
npm install
node build.mjs                             # přestavět index.html
npx serve .                                # nebo jakýkoli statický server
node cdp-vers.mjs http://localhost:PORT/   # testy variant zasedačky
./deploy.sh "popis změny"                  # build + kontroly + commit + push
```

`cdp-vers.mjs` řídí headless Chrome přes DevTools Protocol a ověří migraci
staršího stavu, přepínání variant a jejich izolaci. Potřebuje běžící server
a nainstalovaný Chrome.

> Při psaní CDP testů se připojuj na cíl s `type === "page"` z `/json/list`.
> První položka z `/json` je browser target a `Runtime.evaluate` na něm zamrzne.

`deploy.sh` před commitem kontroluje, že v `index.html` nezůstal
nesubstituovaný placeholder a že se vložily přesně tři obrázky.

---
---

## Původ a použití

Používejte, upravujte a nabízejte dál, jak uznáte za vhodné, bez jakýchkoli
podmínek.

Seznam hostů v repu jsou **ukázková data**, žádní skuteční lidé.
