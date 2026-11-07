# Growth Gusto: brief for every agent

Growth Gusto is a kitchen-management web app (HACCP) for a small French restaurant, "Chemin des Sarments". It is built as an installable PWA and is mobile-first, with tablet and desktop layouts.

**Users.** Cooks and managers with wet hands, in a hurry, sometimes not tech-savvy. Every screen must be obvious with zero training: one primary action per screen, big tap targets (≥44px), short French copy, and instant feedback (sound + haptics + motion). The owner wants **best-in-class product quality**, like the best consumer apps (Linear, Revolut, Things). They also want it **ultra simple and very visual**, with tasteful motion design, micro-interactions and sounds.

**UI language.** All user-facing text is in French. Do not use English in the UI.

## Code layout

These are plain classic `<script>` files, not modules. They share one global scope and load in this order from `index.html`:

- `js/core.js` holds:
  - utils (`$`, `$$`, `esc`, `fmt`, `num`, `dayKey`, `monthKey`, `addDays`, `shortDate`, `hm`, `when`, `rid6`, `slotNow`, `debounce`);
  - the icon set `IC` and `ico(name, cls)`;
  - `logoMark()` and `appIcon()`;
  - sound `SFX.{tap,tick,ok,done,scan,err,sheet,close,print}` and `buzz(ms)`;
  - the data layer `DB.{watch,add,set,update,del}`. It uses localStorage in this standalone build: `DB.mode === "local"`, data under `restos/{rid}/{collection}`;
  - the state `S`, plus `logEvent(type, text, extra)` for the audit trail;
  - `boot()` / `attachResto()`, which subscribe the collections into `S.fridges`, `S.readings`, `S.lots`, `S.products`, `S.counts`, `S.receptions`, `S.events`, `S.notes`, `S.chores`, `S.choreLogs`, `S.tickets`, `S.members`;
  - the chrome: side nav (`NAV`) and tab bar (`TABS`, `TAB_OF`);
  - the router `go(route, params, {back, replace})`, `goBack()`, `refresh()`, `rerender()`, `topBar(title, opts)`;
  - sheets `openSheet(html)` / `closeSheet()`, `toast(msg, kind)`, `toastUndo(msg)`, `burst()`;
  - `data-bind` two-way binding into `S`;
  - the click dispatcher: `[data-act=name]` calls `ACT[name](el, el.dataset.id, el.dataset.v, event)`, `[data-go=route]` navigates, and `[data-tab]` switches tabs.
- `js/<area>.js` holds one area each. It defines `VIEWS.<route> = { render(), after()?, live? }` and adds actions with `Object.assign(ACT, {...})`. The areas are: `compte` (onboarding, équipe, réglages, more), `home`, `releve` (relevés, frigos, frigo detail), `labels` (scan, lots, étiquettes, QR, imprimante), `reception`, `stock`, `tickets`, `registre`, `notes`, `menage`.
- `css/base.css` holds the design system and global styles. `css/<area>.css` holds area-specific styles (empty at the start).
- `vendor/qrcode.js` provides the global `qrcode` (generator). `vendor/jsQR.js` provides the global `jsQR(imageData.data, w, h)` (decoder).

## Design language: "B2 Aurore"

- Frosted glass cards (`.glass`) over an animated violet aurora.
- Font: Manrope. Numbers use the JetBrains Mono class `.mono`.
- Tokens:
  - `--bg #ECEFFB`, `--ink #0E1330`, `--muted #5A6386`;
  - `--accent #4A1FE6`, `--accent-2 #7A4DFF`;
  - `--ok #078A5E`, `--warn #B86C00`, `--bad #D42A48`.
- Spring easing `cubic-bezier(.34,1.56,.64,1)`.
- Staggered entrance: `.st` with `style="--i:N"`.
- Existing component classes to reuse: `.btn` (`.acc`, `.soft`, `.ghost`, `.danger`, `.block`, `.sm`), `.chip`, `.seg`, `.pill` (`.ok`, `.warn`, `.bad`, `.acc`), `.field`, `.input`, `.ic`, `.h2`, `.h3`, `.sub`, `.lbl`, `.grid2`, `.grid3`, `.hstack`, `.ctabar` (sticky CTA), `.keypad`.
- Read `css/base.css` before inventing anything new.

## Standalone constraints

This build runs on GitHub Pages, with no Claude runtime.

- `window.claude` is absent, so `S.cap.sample`, `S.cap.assets`, `S.cap.downloads`, `S.cap.db` and `S.cap.user` are all `null`.
- Never show a feature that needs them as broken. When `S.cap.sample` is null, hide the OCR buttons, but keep "take a photo as proof". The core agent provides photo storage and file download fallbacks.
- Live camera **is** available: `navigator.mediaDevices.getUserMedia`, HTTPS on Pages.
- Data lives on the device (localStorage). Keep data small: compress photos.

## Rules that keep parallel agents from colliding

1. **Edit only the files your task says you own.** Read anything. For something you need from a file you don't own, work around it in your own file:
   - global helpers, prefixed with your area name;
   - `Object.assign(IC, {myicon: "…"})` for new icons;
   - `TAB_OF.myroute = "frigos"` for a new route;
   - your own `DB.watch` subscriptions, guarded once per `S.rid`.
   If you can't work around it, describe the core change you need in your final report.
2. **Work in a private copy, then copy your owned files back.** First run `mkdir -p /tmp/gg && rm -rf /tmp/gg/$ME && cp -r /home/claude/growth-gusto /tmp/gg/$ME`, where `$ME` is your agent label. Edit and test in `/tmp/gg/$ME`. When done and tested, copy **only your owned files** back into `/home/claude/growth-gusto/`. Never run git commands in the repo; the lead commits.
3. **Test for real.** Run `cd /tmp/gg/$ME && OUT=/tmp/gg/out-$ME node tools/run.js <your-script.js>`.
   - Add `DESKTOP=1` for 1366×860; the default is a 390×844 touch phone.
   - Write your Playwright scripts in `/tmp/gg/$ME/tools/` (see `tools/smoke.js` for the onboarding steps).
   - Click with `page.$eval(sel, e => e.click())`; `page.click` can time out on smooth scroll.
   - The harness prints `ERRORS: [...]`, which must be empty.
   - **Look at your screenshots** with the Read tool, on both phone and desktop, and fix what looks off.
   - Run `node -e "new Function(require('fs').readFileSync('js/<file>.js','utf8'))"` for a syntax check.
4. Keep the existing data shape backward compatible. Existing localStorage data must still load.
5. Your final message is read by the lead, not by the user. Keep it under 15 lines and cover:
   - what you changed;
   - what you verified, with screenshot paths;
   - anything left or needed from core.

## New module = new content on growthgusto.fr (checked by CI)

The marketing site follows the app menu automatically (`tools/site/registre.py` reads `NAV` from the code).
- Add your screen to the menu on **one line**: `NAV.splice(i, 0, ["route", "icon", "Nom"])`.
- Write its copy in French: a `FONCTION(…, app="route", …)` in `tools/site/accueil.py` (home page) **and** `"route"` in the `app=[…]`
  of the right page in `tools/site/content_features.py` (add a block there if it deserves one). Not a selling point (settings…)?
  Add it to `INTERNE` in `registre.py` with the reason. Honest labels only: En direct / Par import / Bientôt.
- Run `python3 tools/site/build.py && python3 tools/site/check.py`. `node tools/ci.js` fails while a screen has no site content.
- Removing a screen from the app removes its features and pages from the site by itself. Every deploy rebuilds the site.

## V3 data contract (2026-11-04)

Core already subscribes these collections into `S` (arrays, newest first where ordered). Use them, don't re-watch them:

| collection | `S.` key | shape (add fields freely, never rename) |
|---|---|---|
| `moves` | `S.moves` | stock movement: `{ productId, name, qty, unit, kind, ref?, refType?, fridgeId?, toFridgeId?, lotId?, at, uid, by }`. `qty` is signed in the product's unit: negative = out (recipe used, sold, waste), positive = in. `kind` ∈ `recette`, `vente`, `perte`, `transfert`, `correction`, `reception`. A fridge transfer has `kind:"transfert"`, `qty:0` impact on stock, and `fridgeId`/`toFridgeId`. |
| `staff` | `S.staff` | employee file, one per person: `{ memberId?, name, role, color, contract, weeklyHours, hourlyGross, chargesPct, pinHash?, active, start, end? }` |
| `shifts` | `S.shifts` | planned shift: `{ staffId, day:"YYYY-MM-DD", start:"HH:MM", end:"HH:MM", breakMin, post?, note? }` |
| `punches` | `S.punches` | time clock: `{ staffId, kind:"in"|"out"|"breakStart"|"breakEnd", at, day, by, edited?, editedBy?, note? }` |
| `obligations` | `S.obligations` | recurring legal obligation: `{ key, name, cat, everyMonths, provider?, phone?, contract?, lastDone?, nextDue?, notes?, archived? }` |
| `oblLogs` | `S.oblLogs` | one intervention: `{ oblId, day, provider, by, at, notes?, cost?, files:[{id,name,type}] }` |
| `feedback` | `S.feedback` | `{ source:"client"|"equipe", rating?, dish?, noteId?, channel?, text, at, by, reply?, status? }` |
| `expenses` | `S.expenses` | purchase or cost: `{ day, cat, supplier?, label, amountHT, vat?, receptionId?, at, by }` |
| `invoices` | `S.invoices` | supplier invoice (js/marge.js): `{ supplier, number, day, totalHT, totalTTC, vat, lines:[{ name, qty, unit, price, total, productId?, per?, unitPrice? }], photoId?, src:"photo"|"pdf"|"manuel", status, at, by }` |
| `prices` | `S.prices` | purchase price history (js/marge.js): `{ productId, name, supplier, unit, price, prev, pct, day, at, src:"facture"|"manuel", invoiceId?, by }`. The current price stays `products.price` (€ HT per stock unit). |

Shared globals: `ALLERGENS` (14 regulated allergens `{id,t,s}`) and `allergenOf(id)` live in core. Products and recipes store allergens as `allergens: ["lait","oeufs"]`.

Cross-area helpers (define in your own file; callers guard with `typeof x === "function"`):
- stock.js: `stockLevel(productId)` → theoretical quantity (last count + receptions + moves since), `stockMove(doc)` → writes a `moves` doc and logs the event.
- notes.js: `recipeAllergens(note)` → allergen ids of a recipe (own + from linked products and sub-recipes).
- rh.js: `staffCost(from, to)` → `{ hours, gross, loaded }` from punches (or shifts when no punch).
- tickets.js: `salesBetween(from, to)` → `{ ttc, ht, covers, days }`.
- oblig.js: `oblDue(days=30)` → obligations due or late within N days.
- marge.js: `mgDishCost(noteId)` → `{ portion, batch, margin, fc, coef, ht, ttc, complete }`, `mgPriceOf(productId, day?)` → € HT per stock unit on a day, `mgPriceAlerts(days=30)` → price changes with their effect on each dish. Recipes may carry `vat` (sale VAT, default 10) and `targetFc` (%); products may carry `aliases` and `packs` (invoice unit → stock units).

Routes already in NAV/TAB_OF (core): `dashboard`, `finance` (js/finance.js), `obligations` (js/oblig.js), `pointeuse`, `planning` (js/rh.js; employee files and salaries can live at route `staff` in rh.js too, add `TAB_OF.staff="more"`), `avis` (js/avis.js). Icons `dash`, `euro`, `calcheck`, `clock`, `cal`, `star` exist.

## Prise en main : chaque module arrive avec sa leçon (2026-11-07)

L'onboarding du patron (js/onboard.js + js/parcours.js) fait choisir les fonctionnalités, puis lance la « Prise en main » ; chaque
personne ajoutée reçoit sa formation selon son rôle, son poste, ses droits, ses vues et son appareil. Tout part du menu (NAV).

- **Un nouvel écran dans NAV doit avoir sa leçon**, sinon `tools/lecons-test.js` (lancé par `tools/ci.js`) bloque la mise en ligne.
  Dans le fichier du module, à côté du `NAV.splice` : `if (typeof PC_LECONS === "object") PC_LECONS.maRoute = { t, d, steps, q, sc, who? }`
  (modèle et liste des scènes en tête de `js/lecons.js`).
- Le choix des fonctionnalités (`PC_FAMILLES` dans js/lecons.js) suit aussi le menu : un écran hors famille apparaît seul sous « Autres ».
  Pour le ranger avec d'autres, ajoutez sa route à une famille.
- Une fonctionnalité coupée (`restos/{rid}.modsOff`) disparaît partout via `PERMS.routeAllowed` : rien à faire dans le module.
