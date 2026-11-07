/* Growth Gusto — mode sombre : traduction des couleurs claires écrites en dur (voir js/theme.js et css/sombre.css).
   Utilisé par le navigateur (window.THMAP, secours quand les feuilles n'ont pas été préparées) et par tools/sombre.js
   (préparation des feuilles css/*.css à la mise en ligne : chaque règle qui écrit une couleur claire reçoit, juste après elle,
   une règle jumelle limitée à :where(html[data-theme=dark]) ; même spécificité, même ordre : la cascade ne bouge pas). */
(function (root) {
  /* ───────────── colour maths (sRGB ⇄ OKLab) ───────────── */
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  function toLch(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, Bb), ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360];
  }
  function fromLch(L, C, h) {
    /* reduce chroma until the colour fits in sRGB */
    for (let k = 0; k < 24; k++) {
      const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
      const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
      if ((R >= -0.001 && R <= 1.001 && G >= -0.001 && G <= 1.001 && B >= -0.001 && B <= 1.001) || C < 0.002) return [gam(R), gam(G), gam(B)];
      C *= 0.86;
    }
    return [gam(L), gam(L), gam(L)];
  }
  const SURF_H = 292, SURF_C = 0.034; /* night surfaces: deep aubergine, the violet of the brand at night */
  /* kind: bg (fills), bd (borders), fg (text, icons), sh (shadows). Returns null to keep the colour. */
  function mapColor(kind, r, g, b, a, keepFg) {
    const [L, C, h] = toLch(r, g, b);
    let out = null;
    if (kind === "bg" || kind === "bd") {
      if (L >= 0.72) {
        if (C < 0.035) out = [Math.min(0.44, (kind === "bd" ? 0.245 : 0.205) + (1 - L) * (kind === "bd" ? 0.95 : 1.0)), SURF_C, SURF_H]; /* white, cream → prune surfaces */
        else if (C >= 0.105 && L < 0.93) return null; /* vivid (saffron, mint…): it glows on the night background */
        else out = [kind === "bd" ? 0.36 : 0.28, Math.min(C * 1.5, 0.08), h]; /* pastel tint → deep tinted well */
      } else if (L < 0.34 && L > 0.07 && C < 0.07) out = [0.34, 0.04, SURF_H]; /* ink pills → raised plum, white text still reads */
      else return null;
    } else if (kind === "cp") {
      return L >= 0.8 && C < 0.105 && a > 0.5 ? mapColor("bg", r, g, b, a) : null;
    } else if (kind === "svg") {
      /* SVG shapes: light cream/pastel planes are surfaces (floor plans, charts), pure white stays white (icons on colour), dark ink lights up */
      if (L > 0.985 && C < 0.02) return null;
      if (L >= 0.72) return C < 0.105 ? mapColor("bg", r, g, b, a) : null;
      return mapColor("fg", r, g, b, a, keepFg);
    } else if (kind === "fg") {
      if (keepFg || L >= 0.64) return null;
      out = C < 0.075 ? [1 - L * 0.5, 0.016, 80] : [Math.max(0.74, 1 - L * 0.5), Math.min(C, 0.17), h]; /* ink → cream, coloured ink → its light twin */
    } else if (kind === "sh") {
      if (L > 0.97 && C < 0.02) return [255, 255, 255, Math.round(a * 0.14 * 1000) / 1000]; /* white inner highlight → faint */
      if (L > 0.7) out = [0.11, 0.03, SURF_H]; /* cream bottom edge → dark edge */
      else if (L < 0.45 && a < 1) return [0, 0, 0, Math.min(0.85, Math.round((a * 1.9 + 0.08) * 1000) / 1000)]; /* soft shadows: deeper on night */
      else return null;
    }
    if (!out) return null;
    const c = fromLch(out[0], out[1], out[2]);
    return [c[0], c[1], c[2], a];
  }
  const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };
  function parseColor(s) {
    s = s.trim().toLowerCase();
    if (s[0] === "#") {
      let x = s.slice(1); if (x.length === 3 || x.length === 4) x = x.split("").map((c) => c + c).join("");
      if (x.length !== 6 && x.length !== 8) return null;
      return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1];
    }
    if (NAMED[s]) return [...NAMED[s], 1];
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (!m) return null;
    let a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  const fmt = (c) => (c[3] >= 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`);
  const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|(?<![\w-])(?:white|black)(?![\w-])/g;
  const kindOf = (p) => {
    /* component variables: well/tint fills (--wb, --wf, --tb…) are surfaces, --wc/--pzc are ink; others: a light pastel is a surface */
    if (p.startsWith("--")) return /^--(wc|pzc)$/.test(p) ? "fg" : "cp";
    if (/^(fill|stroke)$/.test(p)) return "svg";
    if (/^(color|caret-color|outline-color|accent-color|column-rule-color|text-decoration-color|text-emphasis-color|-webkit-text-fill-color|-webkit-text-stroke-color|-webkit-tap-highlight-color)$/.test(p)) return "fg";
    if (/^(box-shadow|text-shadow|-webkit-box-shadow)$/.test(p)) return "sh";
    if (/^border|^outline$/.test(p)) return "bd";
    if (/^background|^mask$|^-webkit-mask$/.test(p)) return /^-webkit-mask$|^mask$/.test(p) ? null : "bg";
    if (/^(stop-color|flood-color|lighting-color)$/.test(p)) return "bg";
    return null;
  };
  /* swap the colour literals of one value; url(...) and var(...) fallbacks to tokens are kept as they are */
  function mapValue(kind, val, keepFg) {
    const urls = []; let v = val.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, (u) => { urls.push(u); return `\u0001${urls.length - 1}\u0001`; });
    let changed = false;
    v = v.replace(COLOR_RE, (s) => { const c = parseColor(s); if (!c || c[3] === 0) return s; const o = mapColor(kind, c[0], c[1], c[2], c[3], keepFg); if (!o) return s; changed = true; return fmt(o); });
    /* dark ink used as a FILL (buttons, pills): a raised plum surface at night instead of a cream slab */
    if (kind === "bg") v = v.replace(/var\(--ink(-2)?\)/g, () => { changed = true; return "var(--th-inkfill)"; });
    if (!changed) return null;
    return v.replace(/\u0001(\d+)\u0001/g, (_, i) => urls[+i]);
  }
  function splitTop(s, sep) {
    const out = []; let depth = 0, q = null, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { cur += ch; if (ch === q && s[i - 1] !== "\\") q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  const SCOPE = ":where(html[data-theme=dark])";
  function scopeSel(sel) {
    return splitTop(sel, ",").map((x) => {
      x = x.trim();
      const m = /^(html|:root)(?![\w-])/.exec(x);
      if (m) { /* the root itself: add the condition to its own compound */
        let i = 0, depth = 0;
        for (; i < x.length; i++) { const ch = x[i]; if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth--; else if (depth === 0 && /[\s>+~]/.test(ch)) break; }
        return x.slice(0, i) + ":where([data-theme=dark])" + x.slice(i);
      }
      return SCOPE + " " + x;
    }).join(", ");
  }
  const SKIP_SEL = /\.th-keep|::view-transition|\[data-theme/;
  /* the dark twin of one rule (selector + declarations text), or null when it has no light colour to translate */
  function twin(sel, txt) {
    if (!sel || SKIP_SEL.test(sel)) return null;
    if (!txt || !/#|rgb|white|black|--ink/.test(txt)) return null;
    const decls = splitTop(txt, ";").map((d) => { const i = d.indexOf(":"); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]; }).filter(Boolean);
    /* keep a dark text when the same rule keeps a vivid light fill (a saffron pill keeps its ink) */
    let keepFg = false;
    decls.forEach(([p, v]) => {
      if (kindOf(p) !== "bg") return;
      const vv = v.replace(/url\([^)]*\)/g, ""); (vv.match(COLOR_RE) || []).forEach((s) => { const c = parseColor(s); if (!c || c[3] < 0.6) return; const [L, C] = toLch(c[0], c[1], c[2]); if (L >= 0.72 && C >= 0.105 && L < 0.93) keepFg = true; });
    });
    const out = [];
    decls.forEach(([p, v]) => {
      const k = kindOf(p); if (!k) return;
      const imp = /!\s*important\s*$/i.test(v); const raw = v.replace(/!\s*important\s*$/i, "").trim();
      const nv = mapValue(k, raw, keepFg); if (nv == null) return;
      out.push(`${p}:${nv}${imp ? " !important" : ""}`);
    });
    if (!out.length) return null;
    return `${scopeSel(sel)}{${out.join(";")}}`;
  }
  const api = { twin, mapColor, parseColor, toLch, fromLch, scopeSel, splitTop };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.THMAP = api;
})(typeof window !== "undefined" ? window : globalThis);
