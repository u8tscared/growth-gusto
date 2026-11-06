// Menu import parser (js/cmimport.js). Usage: node tools/cmimport.test.js
const assert = require("assert");
const { ciParse, ciFromLd, ciPrice } = require("../js/cmimport.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const flat = (r) => r.items.map((x) => [(r.secs.find((s) => s.id === x.sec) || {}).t, x.t, x.p, x.d]);

t("prices", () => {
  assert.deepStrictEqual(["Bœuf 19,50", "Tartare 18 €", "Saumon 21€50", "Œuf mayo ....... 6.5", "Soupe 8e", "Coca 33cl 3,5"].map((l) => ciPrice(l).v), [19.5, 18, 21.5, 6.5, 8, 3.5]);
  ["Pizza 4 fromages", "Château X 2019", "Planche pour 2", "Nuggets x6", "Huîtres n°3"].forEach((l) => assert.strictEqual(ciPrice(l), null, l));
});
t("bistrot PDF text: sections, dotted leaders, description on the next line, glass / bottle", () => {
  const r = ciParse(`LE PETIT ZINC\n12 rue des Lilas, Lyon - 04 78 00 00 00\n\nENTRÉES\nŒuf mayonnaise ........ 6,50\nVelouté de potimarron\ncrème fouettée, graines de courge    7\n\nPLATS\nBœuf bourguignon, purée maison      19,50\n\nVINS\nCôtes du Rhône    6 / 28\n\nPrix nets, service compris.`);
  assert.deepStrictEqual(r.secs.map((s) => [s.t, s.k]), [["Entrées", "entree"], ["Plats", "plat"], ["Vins", "boisson"]]);
  assert.deepStrictEqual(flat(r), [["Entrées", "Œuf mayonnaise", 6.5, ""], ["Entrées", "Velouté de potimarron", 7, "Crème fouettée, graines de courge"], ["Plats", "Bœuf bourguignon, purée maison", 19.5, ""], ["Vins", "Côtes du Rhône", 6, "Aussi 28 €"]]);
  assert.ok(r.items[0].al.includes("oeufs") && !r.items[2].al.includes("oeufs"), "« Bœuf » is not an egg");
  assert.ok(r.items[3].al.includes("sulfites"), "the « Vins » section gives sulfites");
});
t("photo OCR text: two columns on one line, price alone on its line, letter-spaced titles", () => {
  const r = ciParse(`E N T R É E S\nSalade César 12   Tarte Tatin 7\nP l at s\nMargherita\ntomate, mozzarella, basilic\n10\nÀ  P A R T A G E R\nFrites maison 4`);
  assert.deepStrictEqual(r.secs.map((s) => s.t), ["Entrées", "Plats", "À partager"]);
  assert.deepStrictEqual(flat(r).map((x) => x.slice(1, 3)), [["Salade César", 12], ["Tarte Tatin", 7], ["Margherita", 10], ["Frites maison", 4]]);
  assert.strictEqual(r.items[2].d, "Tomate, mozzarella, basilic");
});
t("schema.org items from a website", () => {
  const r = ciFromLd([{ s: "Desserts", t: "Tiramisu", d: "mascarpone", p: 7 }, { s: "Desserts", t: "Sans prix", p: 0 }]);
  assert.deepStrictEqual(r.secs.map((s) => s.k), ["dessert"]); assert.strictEqual(r.items.length, 1); assert.ok(r.items[0].al.includes("lait"));
});
console.log(`\n${n}/${n} OK`);
