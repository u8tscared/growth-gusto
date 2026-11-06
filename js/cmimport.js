/* Growth Gusto — import the restaurant's menu into « Commandes en ligne » (prefix ci). Owned: js/cmimport.js, css/cmimport.css.
   Sources, all read for free:
     · a PDF or a photo of the menu: read ON THE DEVICE (pdf.js text, else Tesseract OCR: MGOCR / mgReadPdf / mgPrepImage from js/marge.js)
     · the restaurant's website: the server only fetches the page (orderApi op "site", functions/src/commande.js) and returns
       schema.org items, the page text, a PDF menu linked from the site, or a menu picture; everything is parsed here.
   ciParse(text) turns any menu text into sections and dishes (name, price, description, guessed allergens). The review sheet lets
   the gérant fix everything before anything is written; imported dishes are recipe sheets (notes, cat "Recettes", carte: true),
   with alCheck: true until someone confirms their allergens (the public page then says « demandez au personnel »). */

/* ───────── parser (pure: also run by the tests in node) ───────── */
/* whole words, accents included (\b treats « œ », « à », « é » as non-letters) */
const ciW = (re) => new RegExp("(?<!\\p{L})(?:" + re.source.replace(/^\\b\(|\)\\b$/g, (m) => (m[0] === "\\" ? "(" : ")")) + ")(?!\\p{L})", "iu");
const CI_KINDS = [
  ["dessert", /\b(desserts?|douceurs?|sucr[ée]s?|p[âa]tisseries?|glaces?|sorbets?|fromages?|gourmandises?|caf[ée]s? gourmands?|pour finir|la fin)\b/i],
  ["boisson", /\b(boissons?|vins?|bi[èe]res?|cocktails?|mocktails?|softs?|caf[ée]s?|th[ée]s?|infusions?|ap[ée]ritifs?|digestifs?|alcools?|spiritueux|champagnes?|eaux?|jus|sodas?|whiske?y|rhums?|drinks?|boissons chaudes|rouges?|blancs?|ros[ée]s?|à boire|a boire|la cave|carte des vins|pressions?)\b/i],
  ["partage", /\b([àa] partager|tapas|planches?|ap[ée]ro|snacks?|mezzes?|antipasti|finger ?food|grignotages?|[àa] grignoter|petites? faims?)\b/i],
  ["entree", /\b(entr[ée]es?|starters?|hors[- ]d.?(?:oe|œ)uvres?|soupes?|velout[ée]s?|pour commencer)\b/i],
  ["plat", /\b(plats?|burgers?|pizzas?|p[âa]tes|pastas?|viandes?|poissons?|grillades?|salades?|bowls?|suggestions?|sp[ée]cialit[ée]s?|risottos?|tartares?|menus?|formules?|enfants?|accompagnements?|garnitures?|sandwich(?:e)?s?|tartines?|cr[êe]pes?|galettes?|woks?|sushis?|makis?|ramens?|tacos?|kebabs?|le midi|du jour|à la broche|rôtisserie|mer|terre|v[ée]g[ée]tariens?|nos classiques|la carte|signatures?)\b/i],
];
const CI_JUNK = /(https?:\/\/|www\.|@|\b0[1-9](?:[ .-]?\d{2}){4}\b|\+33|\bprix (?:nets?|ttc|en euros)|\bservice compris|\btaxes?\b|\bt\.?v\.?a\.?\b|\bsiret\b|\bhoraires?\b|\bouvert\b|\bferm[ée]\b|\br[ée]servations?\b|\binstagram|\bfacebook|\bsuivez[- ]nous|\bcb accept|\btickets? resto|\bpage \d|\bmerci de|\bliste des allerg|\bcopyright|©|\bmentions l[ée]gales|\bcookies?\b)/i;
const CI_AL = [
  ["gluten", /\b(pain|p[âa]te|p[âa]tes|farine|bl[ée]|burgers?|pizzas?|cro[ûu]tons?|chapelure|pan[ée]e?s?|tarte|tartine|toast|brioche|baguette|bun|gnocchis?|raviolis?|lasagnes?|spaghettis?|tagliatelles?|penne|linguine|nouilles?|ramen|couscous|semoule|boulgour|seigle|orge|biscuits?|cr[êe]pes?|galettes?|feuillet[ée]e?|sabl[ée]e?|g[âa]teau|cake|fondant|brownie|cookie|crumble|cr[êe]pe|gaufre|bi[èe]re|tempura|wrap|croque|quiche|tourte|panini|bagel|naan|pita|beignets?|chou|choux|profiteroles?|financier|madeleine|macaron|tiramisu|panna? ?cotta|seitan)\b/i],
  ["crustaces", /\b(crevettes?|gambas|homards?|langoustes?|langoustines?|crabes?|tourteaux?|[ée]crevisses?|crustac[ée]s?|bisque)\b/i],
  ["oeufs", /\b((?:oe|œ)ufs?|mayo(?:nnaise)?|a[ïi]oli|b[ée]arnaise|hollandaise|meringue|cr[èe]me br[ûu]l[ée]e|flan|mousse au chocolat|carbonara|tiramisu|quiche|omelette|brioche|cr[êe]pes?|g[âa]teau|cake|fondant|clafoutis|macaron|financier|madeleine|choux?|profiteroles?|g[ée]noise|tartare|aïoli|gaufre|frittata|tortilla)\b/i],
  ["poissons", /\b(poissons?|saumon|thon|cabillaud|bar|dorade|daurade|truite|sole|lieu|merlu|colin|maquereau|sardines?|anchois|hareng|turbot|lotte|espadon|haddock|rouget|brochet|sandre|tarama|surimi|bonite|fish|sushis?|sashimis?|ceviche|brandade|bouillabaisse|nuoc|nu[oô]c|worcestershire)\b/i],
  ["arachides", /\b(arachides?|cacahu[èe]tes?|satay|peanut|beurre de cacahu[èe]te)\b/i],
  ["soja", /\b(soja|tofu|edamame|miso|tempeh|sauce soja|teriyaki|shoyu|tamari|yakitori)\b/i],
  ["lait", /\b(lait|cr[èe]me|beurre|fromages?|mozzarella|burrata|parmesan|comt[ée]|ch[èe]vre|brebis|roquefort|bleu|camembert|brie|reblochon|raclette|emmental|gruy[èe]re|ricotta|mascarpone|feta|halloumi|cheddar|gorgonzola|yaourt|yogourt|fromage blanc|glaces?|chantilly|b[ée]chamel|gratin|gratin[ée]e?|cheese|cheesecake|latte|cappuccino|chocolat chaud|milk|panna cotta|tiramisu|cr[èe]me br[ûu]l[ée]e|flan|fondue|tartiflette|aligot|pur[ée]e|beurre blanc|carbonara|alfredo|quatre fromages|4 fromages|croque|cr[èe]meux)\b/i],
  ["fruitscoque", /\b(noix|noisettes?|amandes?|pistaches?|cajou|p[ée]cans?|macadamia|pralin[ée]?|frangipane|nougat|massepain|pesto|financier|macaron|gianduja|nutella)\b/i],
  ["celeri", /\b(c[ée]leri|c[ée]leri-rave|r[ée]moulade|bouillon|pot[- ]au[- ]feu|bourguignon|blanquette|minestrone|bloody mary)\b/i],
  ["moutarde", /\b(moutarde|vinaigrette|r[ée]moulade|mayo(?:nnaise)?|dijon|[àa] l.ancienne|tartare|cocktail sauce|sauce burger)\b/i],
  ["sesame", /\b(s[ée]same|tahin[ée]?|tahini|houmous|hummus|gomasio|bun)\b/i],
  ["sulfites", /\b(vins?|champagne|cr[ée]mant|prosecco|cidre|vinaigre|vinaigrette|fruits secs|abricots secs|raisins secs|bourguignon|coq au vin|marchand de vin|vermouth|porto|martini|spritz|sangria|kir|sauce au vin|r[ée]duction)\b/i],
  ["lupin", /\blupin\b/i],
  ["mollusques", /\b(moules?|hu[îi]tres?|calamars?|encornets?|seiches?|poulpes?|pieuvres?|saint[- ]jacques|st[- ]jacques|coquilles?|bulots?|palourdes?|coques|escargots?|bigorneaux|couteaux|oursins?)\b/i],
];
const ciNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ciCap = (s) => { const t = String(s || "").trim(); if (!t) return t; const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, ""); if (letters.length > 3 && letters === letters.toUpperCase()) { const l = t.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); } return t.charAt(0).toUpperCase() + t.slice(1); };
const CI_KW = CI_KINDS.map(([k, re]) => [k, ciW(re)]), CI_ALW = CI_AL.map(([k, re]) => [k, ciW(re)]);
function ciKind(t) { for (const [k, re] of CI_KW) if (re.test(t)) return k; return ""; }
function ciGuessAl(t) { const s = String(t || ""); return CI_ALW.filter(([, re]) => re.test(s)).map(([id]) => id); }
/* a price at the end of a line: 12 · 12,50 · 12.5 · 12 € · 12€50 · € 12 · 12,- · 12 eur (never a year, a weight or a volume) */
const CI_PRICE = /(?<=^|[\s.…_\-–—|:€(*])(\d{1,3})(?:\s?€\s?(\d{2})(?!\d)|[.,](\d{1,2})|,-)?(?:\s*(?:€|eur(?:os?)?\.?)|(?<=\d)[eE])?\s*\)?$/i;
function ciPrice(line) {
  const m = CI_PRICE.exec(line); if (!m) return null;
  const before = line.slice(0, m.index), raw = m[0];
  const v = +m[1] + (m[2] ? +m[2] / 100 : m[3] ? +(m[3].length === 1 ? m[3] + "0" : m[3]) / 100 : 0);
  if (!(v >= 0.5 && v <= 600)) return null;
  /* « pour 2 », « x 6 », « n° 3 », « les 6 » are quantities, not prices (unless written with € or cents) */
  if (!/[€.,]|eur|\de/i.test(raw) && /(?:^|\s)(pour|x|n°|no|de|à|a|par|les|des|aux|au|en|et|by|lot de|le|la)\s*$/i.test(before)) return null;
  return { v: Math.round(v * 100) / 100, name: before };
}
const ciTrimLead = (s) => s.replace(/[\s.…_·•\-–—|:]+$/g, "").replace(/^[\s•·*\-–—>»]+/, "").replace(/\s{2,}/g, " ").trim();
/* split a line read across two columns: « Salade César 12   Tarte Tatin 7 » */
function ciSplitCols(line) {
  const parts = line.split(/\s{3,}|\t+/).map((x) => x.trim()).filter(Boolean); if (parts.length < 2) return [line];
  const out = []; let cur = "";
  parts.forEach((p) => { cur = cur ? cur + "   " + p : p; if (ciPrice(cur)) { out.push(cur); cur = ""; } });
  if (cur) { if (out.length && !/[A-Za-zÀ-ÿ]{3}/.test(cur)) out[out.length - 1] += " " + cur; else out.push(cur); }
  return out.length > 1 ? out : [line];
}
/* letter-spaced titles come out of PDFs as « E N T R É E S » or « P l at s »: glue the letters back */
function ciUnspace(line) {
  return line.split(/(\s{3,})/).map((seg) => { const T = seg.trim().split(/\s+/); if (T.length >= 3 && T.filter((t) => t.length <= 2).length / T.length >= 0.6 && T.every((t) => /^[A-Za-zÀ-ÿŒœ'’]{1,3}$/.test(t))) return seg.trim().split(/ {2,}/).map((w) => w.replace(/ /g, "")).join(" "); return seg; }).join("");
}
function ciParse(text) {
  const raw = String(text || "").replace(/\r/g, "").replace(/[   ]/g, " ").replace(/[‐‑‒]/g, "-").split("\n");
  const L = []; raw.forEach((l) => { const t = l.replace(/\s+$/, ""); if (!t.trim()) { L.push(""); return; } ciSplitCols(ciUnspace(t)).forEach((x) => L.push(x)); });
  const secs = []; let sec = null; const items = []; let last = null; let pend = "", pendD = "";
  const newSec = (t) => { const title = ciCap(ciTrimLead(t)).slice(0, 40); const k = ciKind(title) || (sec ? sec.k : "plat"); sec = { id: "s" + secs.length, t: title, k }; secs.push(sec); last = null; pend = ""; pendD = ""; };
  const isPriceOnly = (l) => { const p = ciPrice(l); return p && !/[A-Za-zÀ-ÿ]{2}/.test(p.name.replace(/\b(eur|euros?)\b/gi, "")) ? p : null; };
  const nextPriced = (i) => { for (let j = i + 1; j < Math.min(L.length, i + 4); j++) { if (!L[j].trim() || CI_JUNK.test(L[j])) continue; return !!ciPrice(L[j]); } return false; };
  for (let i = 0; i < L.length; i++) {
    const line = L[i].trim(); if (!line) { flush(); continue; }
    if (line.length > 240 || CI_JUNK.test(line)) continue;
    const po = isPriceOnly(line);
    if (po) { if (pend) { add(pend, po.v, 0, pendD); pend = ""; pendD = ""; } continue; }
    const pr = ciPrice(line);
    if (pr) {
      let name = ciTrimLead(pr.name);
      /* glass / bottle: « Côtes du Rhône 6 / 28 » → the first price is ordered, the other one goes to the description */
      let alt = 0; const m2 = /(?<![\d.,])(\d{1,3}(?:[.,]\d{1,2})?)\s*€?\s*[/|]?\s*$/.exec(name);
      if (m2 && /[/|]\s*$|\s{2,}$|€\s*$/.test(name.slice(0, m2.index + m2[0].length) + " ") && /[A-Za-zÀ-ÿ]{3}/.test(name.slice(0, m2.index))) { alt = pr.v; pr.v = Math.round(parseFloat(m2[1].replace(",", ".")) * 100) / 100; name = ciTrimLead(name.slice(0, m2.index)); }
      if (!/[A-Za-zÀ-ÿ]{2}/.test(name)) { if (pend) { add(pend, pr.v, alt, pendD); pend = ""; pendD = ""; } continue; }
      /* « Velouté de potimarron » / « crème fouettée, graines de courge   7 »: the priced line is the description */
      if (pend && /^[a-zà-ÿ(]/.test(name)) { add(pend, pr.v, alt, (pendD ? pendD + " " : "") + name); pend = ""; pendD = ""; continue; }
      if (pend && name.length < 4) { name = pend + " " + name; pend = ""; }
      flush(); add(name, pr.v, alt); continue;
    }
    /* no price: a section title, a description, or a name whose price is on the next line */
    const words = line.split(/\s+/).length, letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const caps = letters.length >= 3 && letters === letters.toUpperCase() && /[A-Z]/.test(letters);
    const kind = ciKind(line);
    let sc = 0; if (kind && words <= 5) sc += 3; if (caps && words <= 6) sc += 2; if (words <= 3) sc += 1; if (nextPriced(i)) sc += 1; if (!L[i - 1] || !L[i - 1].trim()) sc += 1;
    if (/,/.test(line)) sc -= 2; if (/^[a-zà-ÿ(]/.test(line)) sc -= 3; if (/[.;]$/.test(line)) sc -= 1; if (line.length > 42) sc -= 3;
    const lower = /^[a-zà-ÿ(]/.test(line);
    if (pend && lower) { pendD = (pendD ? pendD + " " : "") + line; continue; }
    const nx = (k) => { let n = 0; for (let j = i + 1; j < L.length; j++) { if (!L[j].trim()) return ""; if (++n === k) return L[j].trim(); } return ""; };
    const n1 = nx(1), n2 = nx(2);
    const nameNext = !lower && (isPriceOnly(n1) || (ciPrice(n1) && /^[a-zà-ÿ(]/.test(n1)) || (/^[a-zà-ÿ(]/.test(n1) && !ciPrice(n1) && (isPriceOnly(n2) || (ciPrice(n2) && /^[a-zà-ÿ(]/.test(n2)))));
    if (nameNext && !(sc >= 4 && caps)) { flush(); pend = ciTrimLead(line); continue; }
    if (sc >= 3) { newSec(line); continue; }
    if (pend) { pendD = (pendD ? pendD + " " : "") + line; continue; }
    if (last && last.d.length < 220) { last.d = (last.d ? last.d + " " : "") + ciTrimLead(line).replace(/^[(]|[)]$/g, ""); continue; }
  }
  flush();
  /* a name that never got a price: it was a description of the dish before it */
  function flush() { if (pend && last && last.d.length < 200) last.d = (last.d ? last.d + " " : "") + pend + (pendD ? " " + pendD : ""); pend = ""; pendD = ""; }
  function add(name, p, alt, desc) {
    name = ciCap(name.replace(/\s*[(][^)]*$/, "").replace(/^\d{1,2}[.)]\s+/, "")).slice(0, 80);
    if (name.length < 2 || !/[A-Za-zÀ-ÿ]{2}/.test(name)) return;
    if (!sec) newSec("La carte");
    const key = ciNorm(name); if (items.some((x) => x.key === key && x.sec === sec.id)) return;
    const dd = [String(desc || "").replace(/^[(]|[)]$/g, "").trim(), alt ? `Aussi ${alt.toLocaleString("fr-FR", { minimumFractionDigits: alt % 1 ? 2 : 0, maximumFractionDigits: 2 })} €` : ""].filter(Boolean).join(" · ");
    last = { key, t: name, p, d: dd ? dd.charAt(0).toUpperCase() + dd.slice(1) : "", sec: sec.id };
    items.push(last);
  }
  /* the section title helps too: « Pizzas » → gluten, lait ; « Vins » → sulfites */
  items.forEach((x) => { x.d = x.d.replace(/\s+/g, " ").trim().slice(0, 220); const st = (secs.find((y) => y.id === x.sec) || {}).t || ""; x.al = ciGuessAl(x.t + " " + x.d + " " + st); });
  const used = secs.filter((s) => items.some((x) => x.sec === s.id));
  /* a section with the word « boissons » etc. inherits its kind; one item-less title right before a section is dropped */
  return { secs: used, items };
}
/* schema.org items from the server → same shape */
function ciFromLd(list) {
  const secs = [], items = [];
  (list || []).forEach((x) => {
    const st = ciCap(x.s || "La carte").slice(0, 40); let s = secs.find((y) => ciNorm(y.t) === ciNorm(st)); if (!s) { s = { id: "s" + secs.length, t: st, k: ciKind(st) || ciKind(x.t) || "plat" }; secs.push(s); }
    if (!(x.p > 0)) return; const t = ciCap(x.t).slice(0, 80); const key = ciNorm(t); if (items.some((y) => y.key === key)) return;
    items.push({ key, t, p: Math.round(x.p * 100) / 100, d: String(x.d || "").slice(0, 220), sec: s.id, img: x.img || "", al: ciGuessAl(t + " " + (x.d || "") + " " + st) });
  });
  return { secs: secs.filter((s) => items.some((x) => x.sec === s.id)), items };
}
/* photos of the site: an <img> whose alt text or file name matches a dish */
function ciMatchImgs(res, imgs) {
  if (!imgs || !imgs.length) return;
  const I = imgs.map((i) => ({ u: i.u, k: ciNorm(i.alt + " " + decodeURIComponent(String(i.u).split("/").pop().replace(/\.[a-z]+(\?.*)?$/i, "")).replace(/[-_]+/g, " ")) }));
  res.items.forEach((x) => { if (x.img) return; const w = x.key.split(" ").filter((t) => t.length > 3); if (!w.length) return; let best = null, bs = 0; I.forEach((i) => { const s = w.filter((t) => i.k.includes(t)).length / w.length; if (s > bs) { bs = s; best = i; } }); if (best && bs >= 0.67) x.img = best.u; });
}
if (typeof module !== "undefined" && module.exports) module.exports = { ciParse, ciFromLd, ciGuessAl, ciPrice, ciMatchImgs };
const ciKindOf = (t) => ciKind(t);

/* ───────── the import sheet (app only) ───────── */
if (typeof window !== "undefined" && typeof ACT !== "undefined") (function ciUi() {
  const CI = { step: "src", st: "", pct: 0, thumb: "", src: "", res: null, err: "", cover: "", useCover: true, busy: false };
  const SAMPLE = `LE BISTROT DU MARCHÉ\n\nPOUR COMMENCER\nŒuf mayonnaise, salade de pousses ........ 6,50\nTerrine de campagne, pickles maison ........ 8,00\nVelouté de châtaignes\ncrème fouettée, noisettes torréfiées ........ 7,50\n\nÀ PARTAGER\nPlanche mixte charcuterie et fromages ........ 19\nCroquettes de jambon (par 6) ........ 9\n\nNOS PLATS\nBœuf bourguignon, purée maison ........ 21,50\nFilet de lieu jaune, beurre blanc, poireaux ........ 23\nRisotto aux cèpes, parmesan ........ 19\nBurger du marché, cheddar affiné, frites ........ 18\n\nDESSERTS\nMousse au chocolat noir ........ 7\nTarte fine aux pommes, glace vanille ........ 8\nCafé gourmand ........ 9\n\nVINS\nCôtes-du-Rhône, Domaine des Sarments ........ 6 / 29\nMâcon-Villages blanc ........ 7 / 32\n\nPrix nets, service compris.`;
  const fr = (v) => (Math.round(v * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const sel = () => (CI.res ? CI.res.items.filter((x) => x.on) : []);
  const alT = (id) => ((typeof allergenOf === "function" && allergenOf(id)) || { t: id }).t;

  function paint() {
    if (CI.step === "read") return openSheet(`<div class="cm-ed ci"><div class="cm-edh"><span class="h2">Lecture de votre carte</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <div class="ci-scan">${CI.thumb ? `<img src="${esc(CI.thumb)}" alt="">` : `<div class="ci-glob">${ico("cmGlobe")}<b>${esc(CI.src)}</b></div>`}<i class="ci-beam"></i></div>
      <div class="ci-prog"><div class="ci-bar"><i style="width:${Math.max(6, Math.min(100, CI.pct))}%"></i></div><b id="ciSt">${esc(CI.st || "On commence…")}</b>
      <ol class="ci-steps">${[["Lecture du texte", 10], ["Repérage des rubriques", 70], ["Prix, descriptions, allergènes", 88]].map(([t, p]) => `<li class="${CI.pct >= p ? "on" : ""}">${ico("check")}${t}</li>`).join("")}</ol>
      <p class="note">${CI.thumb ? "Tout est lu sur cet appareil. Une carte en photo prend 20 à 40 secondes." : "On récupère votre carte sur votre site."}</p></div></div>`);
    if (CI.step === "rev") return paintRev();
    openSheet(`<div class="cm-ed ci"><div class="cm-edh"><span class="h2">Importer votre carte</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <p class="sub">On lit votre carte et on la remet en forme dans le style de votre choix. Vous vérifiez tout avant que ce soit en ligne.</p>
      ${CI.err ? `<div class="ci-err">${ico("alert")}<span>${esc(CI.err)}</span></div>` : ""}
      <label class="ci-drop"><span class="ci-dic">${ico("cmDoc")}</span><span><b>Choisir un PDF ou des photos</b><em>Votre carte, une ardoise, le menu du jour… jusqu'à 4 pages.</em></span><input type="file" accept="application/pdf,image/*" multiple data-ci-file="1" hidden></label>
      <label class="ci-drop cam"><span class="ci-dic">${ico("camera")}</span><span><b>Prendre la carte en photo</b><em>Bien à plat, toute la page dans le cadre.</em></span><input type="file" accept="image/*" capture="environment" data-ci-file="1" hidden></label>
      <div class="ci-or"><span>ou depuis votre site</span></div>
      <form class="ci-site" data-ci-form="1"><span class="ci-sic">${ico("cmGlobe")}</span><input class="input" id="ciUrl" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="www.votre-restaurant.fr" value="${esc(CI.url || "")}"><button class="btn acc" type="submit">Lire</button></form>
      <p class="note ci-free">${ico("lock")}Gratuit. Un PDF ou une photo est lu sur cet appareil, rien n'est envoyé.</p>
      ${DB.mode === "demo" ? `<button class="btn soft block" data-act="ciSample">${ico("cmSpark")}Essayer avec une carte d'exemple</button>` : ""}</div>`);
  }
  function paintRev() {
    const R = CI.res, n = sel().length;
    const rows = (s) => R.items.map((x, i) => [x, i]).filter(([x]) => x.sec === s.id).map(([x, i]) => `<div class="ci-it${x.on ? " on" : ""}${x.dup ? " dup" : ""}" data-i="${i}">
        <button class="ci-ck" data-act="ciTog" data-v="${i}" aria-pressed="${x.on}" aria-label="Importer ${esc(x.t)}">${ico("check")}</button>
        ${x.img ? `<img class="ci-im" src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
        <div class="ci-f"><textarea class="ci-n" data-ci-n="${i}" rows="1" maxlength="80" aria-label="Nom">${esc(x.t)}</textarea>
          <textarea class="ci-d" data-ci-d="${i}" rows="1" maxlength="220" placeholder="Ajouter une description" aria-label="Description">${esc(x.d)}</textarea>
          ${x.dup ? `<em class="ci-dup">Déjà sur votre carte${x.on ? " : le prix et la description seront mis à jour" : ""}</em>` : x.al.length ? `<em class="ci-al">${ico("alert")}Allergènes devinés : ${esc(x.al.map(alT).join(", ").toLowerCase())}</em>` : ""}</div>
        <label class="ci-p"><input class="mono" data-ci-p="${i}" value="${esc(fr(x.p))}" inputmode="decimal" aria-label="Prix"><span>€</span></label></div>`).join("");
    openSheet(`<div class="cm-ed ci ci-rev"><div class="cm-edh"><span class="h2">Votre carte, à vérifier</span><button class="iconbtn" data-act="sheetClose" aria-label="Fermer">${ico("x")}</button></div>
      <div class="ci-sum">${CI.thumb ? `<img src="${esc(CI.thumb)}" alt="">` : `<span class="ci-sic">${ico("cmGlobe")}</span>`}<div><b>${R.items.length} article${R.items.length > 1 ? "s" : ""} dans ${R.secs.length} rubrique${R.secs.length > 1 ? "s" : ""}</b><em>${esc(CI.src)}</em></div><button class="btn soft sm" data-act="ciAgain">Autre source</button></div>
      <p class="note">Touchez un nom, un prix ou une rubrique pour le corriger. Les allergènes sont devinés : vous les confirmerez ensuite, plat par plat.</p>
      ${CI.cover ? `<button class="cm-tog${CI.useCover ? " on" : ""}" data-act="ciCover" aria-pressed="${CI.useCover}"><img class="ci-cov" src="${esc(CI.cover)}" alt="" referrerpolicy="no-referrer"><span class="cm-tt"><b>Photo de couverture</b><em>Reprise de votre site, en haut de la carte.</em></span><span class="cm-sw${CI.useCover ? " on" : ""}"><i></i></span></button>` : ""}
      <div class="ci-list">${R.secs.map((s) => `<div class="ci-sec"><input class="ci-sect" data-ci-sec="${esc(s.id)}" value="${esc(s.t)}" maxlength="40" aria-label="Rubrique"><select class="ci-seck" data-ci-seck="${esc(s.id)}" aria-label="Type de rubrique">${CM_CATS.map(([k, t]) => `<option value="${k}"${s.k === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>${rows(s)}`).join("")}</div>
      <div class="ci-foot"><button class="btn acc block" data-act="ciGo" id="ciGo" ${n ? "" : "disabled"}>${ico("cmSpark")}<span id="ciGoT">${n ? `Mettre ${n} article${n > 1 ? "s" : ""} sur ma carte` : "Rien de coché"}</span></button></div></div>`);
    requestAnimationFrame(() => $$(".ci-n,.ci-d").forEach(fit));
  }
  /* names and descriptions wrap: the field grows with its text */
  function fit(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  const goT = () => { const n = sel().length, b = document.getElementById("ciGo"), t = document.getElementById("ciGoT"); if (b) b.disabled = !n; if (t) t.textContent = n ? `Mettre ${n} article${n > 1 ? "s" : ""} sur ma carte` : "Rien de coché"; };
  function progress(st, pct) { CI.st = st; CI.pct = Math.max(CI.pct, pct); const e = document.getElementById("ciSt"); if (e && CI.step === "read") { e.textContent = st; const b = document.querySelector(".ci-bar i"); if (b) b.style.width = Math.max(6, Math.min(100, CI.pct)) + "%"; $$(".ci-steps li").forEach((li, i) => li.classList.toggle("on", CI.pct >= [10, 70, 88][i])); } }
  const ocrOn = (m) => { if (!m) return; if (m.status === "recognizing text") progress("Lecture des lignes…", 12 + Math.round((m.progress || 0) * 56)); else progress("Préparation du lecteur…", 8); };
  /* results → review: existing dishes are spotted (unticked, « déjà sur votre carte ») */
  function review(res, label) {
    if (!res || !res.items.length) { CI.step = "src"; CI.err = "Aucun prix trouvé. Essayez une photo nette et bien droite, ou le PDF de votre carte."; SFX.err(); return paint(); }
    const k2 = (t) => ciNorm(String(t || "").replace(/\([^)]*\)/g, " "));
    const mine = new Map(cmDishes().map((n) => [k2(n.title), n]));
    res.items.forEach((x) => { const d = mine.get(k2(x.t)); x.on = !d; x.dup = d ? d.id : ""; });
    progress("C'est lu !", 100); CI.res = res; CI.src = label || CI.src; CI.err = "";
    setTimeout(() => { if (CI.step !== "read") return; CI.step = "rev"; SFX.done ? SFX.done() : SFX.ok(); buzz([10, 30, 10]); paint(); }, 450);
  }
  async function readFiles(files) {
    const F = [...files].slice(0, 4); if (!F.length) return;
    CI.step = "read"; CI.pct = 0; CI.st = ""; CI.err = ""; CI.thumb = ""; CI.cover = ""; CI.src = F.map((f) => f.name || "Photo").join(", "); paint();
    try {
      let text = "";
      for (let i = 0; i < F.length; i++) {
        const f = F[i];
        if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name || "")) { progress("Ouverture du PDF…", 6); const r = await mgReadPdf(f, ocrOn); if (r.thumb && !CI.thumb) setThumb(r.thumb); text += r.text + "\n\n"; }
        else { progress("Préparation de la photo…", 5); const P = await mgPrepImage(f); if (!CI.thumb) { CI.thumb = P.url; const im = document.querySelector(".ci-scan"); if (im) paint(); } const r = await MGOCR.read(P.canvas, ocrOn); text += r.text + "\n\n"; }
      }
      progress("Repérage des rubriques…", 74); await new Promise((r) => setTimeout(r, 250));
      progress("Prix, descriptions, allergènes…", 90); review(ciParse(text), CI.src);
    } catch (e) { console.warn("ci", e); CI.step = "src"; CI.err = "Ce fichier n'a pas pu être lu. Essayez une photo ou un autre PDF."; SFX.err(); paint(); }
  }
  function setThumb(canvas) { try { const k = Math.min(1, 520 / canvas.width); const c = document.createElement("canvas"); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); CI.thumb = c.toDataURL("image/jpeg", 0.75); paint(); } catch (e) {} }
  const b64File = (b64, type, name) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type }); };
  async function readSite(url) {
    url = String(url || "").trim(); if (!/\.[a-z]{2,}/i.test(url)) { SFX.err(); toast("Indiquez l'adresse de votre site.", "err"); return; }
    CI.url = url; CI.step = "read"; CI.pct = 0; CI.thumb = ""; CI.cover = ""; CI.src = url.replace(/^https?:\/\//i, "").replace(/\/$/, ""); paint();
    if (DB.mode !== "db") { await new Promise((r) => setTimeout(r, 900)); CI.step = "src"; CI.err = "Dans la démo, le site ne peut pas être lu. Essayez la carte d'exemple, ou un PDF ou une photo."; SFX.err(); return paint(); }
    try {
      progress("Visite de votre site…", 18); const tick = setInterval(() => progress(CI.st, Math.min(60, CI.pct + 4)), 900);
      let r; try { r = await cmCall("site", { url }); } finally { clearInterval(tick); }
      if (r.cover) CI.cover = r.cover;
      if (r.kind === "ld") { progress("Carte trouvée sur votre site", 80); return review(ciFromLd(r.items), "Votre site · " + CI.src); }
      if (r.kind === "pdf") { progress("Carte PDF trouvée sur votre site", 30); const keep = CI.cover; const f = b64File(r.b64, "application/pdf", "carte.pdf"); const rr = await mgReadPdf(f, ocrOn); if (rr.thumb) setThumb(rr.thumb); CI.cover = keep; progress("Repérage des rubriques…", 76); return review(ciParse(rr.text), "Carte PDF de votre site"); }
      if (r.kind === "img") { progress("Carte en image trouvée sur votre site", 20); const f = b64File(r.b64, r.mime || "image/jpeg", "carte.jpg"); const P = await mgPrepImage(f); CI.thumb = P.url; paint(); const rr = await MGOCR.read(P.canvas, ocrOn); progress("Repérage des rubriques…", 76); return review(ciParse(rr.text), "Carte en image de votre site"); }
      progress("Repérage des rubriques…", 76); const res = ciParse(r.text || ""); ciMatchImgs(res, r.imgs); review(res, "Votre site · " + CI.src);
    } catch (e) {
      console.warn("ci site", e); const m = String((e && e.message) || "");
      CI.step = "src"; CI.err = m === "trop" ? "Trop de lectures aujourd'hui. Réessayez demain, ou envoyez le PDF de votre carte." : m === "url" ? "Cette adresse n'est pas valide." : m === "lourd" ? "Cette page est trop lourde à lire. Envoyez plutôt le PDF de votre carte." : "Votre site n'a pas pu être lu. Envoyez plutôt le PDF ou une photo de votre carte."; SFX.err(); paint();
    }
  }
  async function doImport() {
    if (CI.busy) return; const R = CI.res, pick = sel(); if (!pick.length) return; CI.busy = true;
    const b = document.getElementById("ciGo"); if (b) { b.disabled = true; b.classList.add("busy"); }
    try {
      /* sections: reuse one with the same name (or the base kind with its default name), else create it right after its kind */
      const L = cmSecs(), map = {};
      R.secs.forEach((s) => {
        if (!pick.some((x) => x.sec === s.id)) return; const nt = ciNorm(s.t);
        let t = L.find((x) => ciNorm(x.t) === nt) || L.find((x) => x.id === s.k && ciNorm((CM_CATS.find((c) => c[0] === s.k) || [])[1]) === nt.replace(/^(les|nos|des) /, ""));
        if (!t) { t = { id: "s" + Math.random().toString(36).slice(2, 8), t: ciCap(s.t), k: s.k }; let at = -1; L.forEach((x, i) => { if (x.k === s.k) at = i; }); L.splice(at >= 0 ? at + 1 : L.length, 0, t); }
        map[s.id] = t;
      });
      const c = cmCfg(), desc = { ...c.desc }, now = Date.now(); let i = 0;
      const one = async (x) => {
        const sec = map[x.sec] || L[0]; const place = { carteCat: sec.k, carteSec: sec.id === sec.k ? "" : sec.id };
        let id = x.dup;
        if (id) await DB.update("notes", id, { price: x.p, carte: true, ...place, updatedAt: now });
        else id = await DB.add("notes", { title: x.t, cat: "Recettes", body: "", ingredients: [], steps: [], portions: 1, allergens: x.al, alNo: [], alCheck: true, carte: true, ...place, carteOrd: i++, price: x.p, photo: x.img || "", photoId: "", uid: S.me.id, at: now, updatedAt: now, src: "import-carte" });
        if (x.d) desc[id] = x.d.slice(0, 220);
      };
      for (let k = 0; k < pick.length; k += 8) await Promise.all(pick.slice(k, k + 8).map(one));
      const patch = { desc, secs: L.map(({ id, t, k }) => ({ id, t, k })) }; if (CI.cover && CI.useCover && !c.look.cover) patch.look = { ...c.look, cover: CI.cover };
      await cmSaveCfg(patch);
      closeSheet(); SFX.done ? SFX.done() : SFX.ok(); buzz([12, 40, 12, 40, 20]); try { typeof burst === "function" && burst(); } catch (e) {}
      const chk = pick.filter((x) => !x.dup).length;
      toast(`${pick.length} article${pick.length > 1 ? "s" : ""} sur votre carte${chk ? " · allergènes à vérifier" : ""}`);
      CM.tab = "carte"; CI.res = null; CI.step = "src"; rerender();
    } catch (e) { console.warn("ci import", e); SFX.err(); toast("L'import n'a pas abouti. Réessayez.", "err"); if (b) { b.disabled = false; b.classList.remove("busy"); } }
    CI.busy = false;
  }

  Object.assign(ACT, {
    ciOpen: (a, id, v) => { SFX.tap(); if (CI.step !== "rev" || !CI.res) { CI.step = "src"; CI.err = ""; } paint(); if (v === "file") setTimeout(() => { const i = document.querySelector('.ci [data-ci-file]'); i && i.click(); }, 350); if (v === "site") setTimeout(() => { const i = document.getElementById("ciUrl"); i && i.focus(); }, 380); },
    ciSite: (a) => { const i = document.getElementById("ciUrl"); readSite(i ? i.value : ""); },
    ciSample: async () => { CI.step = "read"; CI.pct = 0; CI.thumb = ""; CI.cover = ""; CI.src = "Carte d'exemple"; paint(); for (const [t, p] of [["Lecture du texte…", 30], ["Lecture des lignes…", 62], ["Repérage des rubriques…", 78], ["Prix, descriptions, allergènes…", 92]]) { await new Promise((r) => setTimeout(r, 420)); progress(t, p); } review(ciParse(SAMPLE), "Carte d'exemple"); },
    ciAgain: () => { CI.step = "src"; CI.res = null; SFX.tap(); paint(); },
    ciTog: (a, id, v) => { const x = CI.res && CI.res.items[+v]; if (!x) return; x.on = !x.on; const row = a.closest(".ci-it"); row.classList.toggle("on", x.on); a.setAttribute("aria-pressed", x.on); x.on ? SFX.tick() : SFX.tap(); buzz(4); if (x.dup) { const e = row.querySelector(".ci-dup"); if (e) e.textContent = "Déjà sur votre carte" + (x.on ? " : le prix et la description seront mis à jour" : ""); } goT(); },
    ciCover: (a) => { CI.useCover = !CI.useCover; a.classList.toggle("on", CI.useCover); a.querySelector(".cm-sw").classList.toggle("on", CI.useCover); SFX.tick(); },
    ciGo: () => doImport(),
  });
  document.addEventListener("change", (e) => { const el = e.target; if (!el || !el.dataset) return; if (el.dataset.ciFile && el.files && el.files.length) readFiles(el.files);
    if (el.dataset.ciSeck && CI.res) { const s = CI.res.secs.find((x) => x.id === el.dataset.ciSeck); if (s) { s.k = el.value; SFX.tick(); } } });
  document.addEventListener("input", (e) => {
    const el = e.target; if (!el || !el.dataset || !CI.res) return; const d = el.dataset;
    if (d.ciN != null || d.ciD != null) fit(el);
    if (d.ciN != null) { const x = CI.res.items[+d.ciN]; if (x) x.t = el.value.replace(/\s+/g, " ").trim().slice(0, 80) || x.t; }
    if (d.ciD != null) { const x = CI.res.items[+d.ciD]; if (x) x.d = el.value.replace(/\s+/g, " ").trim().slice(0, 220); }
    if (d.ciP != null) { const x = CI.res.items[+d.ciP]; const v = parseFloat(el.value.replace(/\s|€/g, "").replace(",", ".")); if (x) { if (v > 0 && v < 1000) { x.p = Math.round(v * 100) / 100; el.classList.remove("bad"); } else el.classList.add("bad"); } }
    if (d.ciSec != null) { const s = CI.res.secs.find((x) => x.id === d.ciSec); if (s && el.value.trim()) { s.t = el.value.trim().slice(0, 40); const k = ciKind(s.t); if (k && k !== s.k) { s.k = k; const sl = el.parentNode.querySelector("select"); if (sl) sl.value = k; } } }
  });
  document.addEventListener("submit", (e) => { if (e.target && e.target.dataset && e.target.dataset.ciForm) { e.preventDefault(); ACT.ciSite(); } });
})();
