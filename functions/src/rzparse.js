/* Growth Gusto — reading a booking out of a booking tool's e-mail (Zenchef, TheFork Manager, or any tool that e-mails the restaurant).
   Same file in two places, keep them identical (tools/rz.test.js checks): js/rzparse.js (the app: pasted e-mails) and
   functions/src/rzparse.js (the server: e-mails forwarded to the restaurant's own address, see functions/src/resaimport.js).
   No dependency, no network: plain text in, a booking out.
     rzParse({ subject, text, html, from, sentAt }) → { ok, kind: "new"|"modify"|"cancel", provider, date, time, covers, name, phone, email, notes, ref, why? }
       ok is true when date, time and covers were all found. kind comes from the subject first (annulation, modification).
     rzText(html) → readable text (tags out, one line per cell / paragraph). */
(function (root) {
  "use strict";
  const MON = [["janv", 1], ["jan", 1], ["fevr", 2], ["fev", 2], ["feb", 2], ["mars", 3], ["mar", 3], ["avr", 4], ["apr", 4], ["mai", 5], ["may", 5], ["juin", 6], ["jun", 6], ["juil", 7], ["jul", 7], ["aout", 8], ["aug", 8], ["sept", 9], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12]];
  const pad = (n) => String(n).padStart(2, "0");
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const clean = (s) => String(s == null ? "" : s).replace(/[   ]/g, " ").replace(/[ \t]+/g, " ").trim();

  function rzText(html) {
    let s = String(html || "");
    s = s.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, "\n").replace(/<\/(td|th)>/gi, "\n").replace(/<[^>]+>/g, " ");
    const ent = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", euro: "€", rsquo: "’", laquo: "«", raquo: "»" };
    s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => { if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n ? String.fromCodePoint(n) : ""; } return ent[e.toLowerCase()] != null ? ent[e.toLowerCase()] : m; });
    return s.split(/\r?\n/).map(clean).filter(Boolean).join("\n");
  }

  /* the header block of a forwarded e-mail (De :, Envoyé :, Objet :) would bring its own date and time: out */
  const HDR = /^(de|from|envoye|sent|date|objet|subject|a|to|cc|reply-to|repondre a)\s*:/;
  /* field labels, normalized */
  const LAB = {
    name: /^(nom( complet| du client)?|client|nom et prenom|prenom et nom|name|guest( name)?|full name|reserve par|au nom de|contact)$/,
    first: /^(prenom|first name|firstname)$/,
    last: /^(nom de famille|last name|lastname|surname)$/,
    date: /^(date( de (la )?reservation| du repas| de visite)?|jour|day|le)$/,
    time: /^(heure( d arrivee| de (la )?reservation)?|horaire|creneau|time|hour|arrivee|a)$/,
    when: /^(date et heure|quand|date & heure|date and time|when)$/,
    covers: /^((nombre|nb|nbre) (de )?(personnes|couverts|convives|pers|invites)|couverts|personnes|convives|pax|guests|party( size)?|number of (guests|people)|people|adultes|taille du groupe|pour)$/,
    phone: /^(telephone|tel|tel\.|portable|mobile|phone|phone number|numero( de telephone)?|gsm)$/,
    email: /^(e ?mail|mail|courriel|adresse (e ?mail|mail|electronique)|email address)$/,
    notes: /^(commentaires?|message|remarques?|notes?|demandes? (speciales?|particulieres?)|precisions?|informations? complementaires?|comment|special requests?|allergies?|occasion)$/,
    ref: /^(reference|ref|ref\.|n ?o?|numero( de reservation)?|n ?de reservation|id( de reservation)?|booking (id|reference|number|ref)|reservation (id|number|n))$/,
    status: /^(statut|status|etat)$/,
  };
  function labelOf(s) { const n = norm(s).replace(/[*#°º]/g, "").replace(/[^a-z0-9 &.]/g, " ").replace(/\s+/g, " ").trim(); for (const k in LAB) if (LAB[k].test(n)) return k; return ""; }

  function dateOf(s, base) {
    const n = norm(s); let m;
    const by = base ? new Date(base) : new Date(); const baseY = by.getFullYear();
    const ok = (y, mo, d) => (y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : "");
    const guessY = (mo, d) => { /* no year written: the next such day from the e-mail's date */ const k = ok(baseY, mo, d); if (!k) return ""; const t = Date.UTC(baseY, mo - 1, d), b = Date.UTC(baseY, by.getMonth(), by.getDate()); return t < b - 7 * 864e5 ? ok(baseY + 1, mo, d) : k; };
    if ((m = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(n))) return ok(+m[1], +m[2], +m[3]);
    if ((m = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/.exec(n))) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return ok(y, +m[2], +m[1]); }
    if ((m = /\b(\d{1,2})(?:er|st|nd|rd|th)? ([a-z]{3,9})\.?,? (20\d{2})\b/.exec(n))) { const mo = MON.find(([p]) => m[2].startsWith(p)); if (mo) return ok(+m[3], mo[1], +m[1]); }
    if ((m = /\b([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (20\d{2})\b/.exec(n))) { const mo = MON.find(([p]) => m[1].startsWith(p)); if (mo) return ok(+m[3], mo[1], +m[2]); }
    if ((m = /\b(\d{1,2})(?:er)? (janv|jan|fevr|fev|feb|mars|mar|avr|apr|mai|may|juin|jun|juil|jul|aout|aug|sept|sep|oct|nov|dec)[a-z]*\.?(?![a-z])/.exec(n))) { const mo = MON.find(([p]) => m[2].startsWith(p)); if (mo) return guessY(mo[1], +m[1]); }
    if ((m = /\b(\d{1,2})[/.](\d{1,2})\b(?![/.]\d)/.exec(n)) && +m[2] <= 12) return guessY(+m[2], +m[1]);
    if (/\b(aujourd ?hui|ce soir|ce midi|today|tonight)\b/.test(n)) return ok(by.getFullYear(), by.getMonth() + 1, by.getDate());
    if (/\b(demain|tomorrow)\b/.test(n)) { const t = new Date(by.getTime() + 864e5); return ok(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
    return "";
  }
  function timeOf(s) {
    const n = norm(s); let m;
    if ((m = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))? ?(am|pm)\b/.exec(n))) { let h = +m[1] % 12; if (m[3] === "pm") h += 12; return `${pad(h)}:${m[2] || "00"}`; }
    if ((m = /\b([01]?\d|2[0-3]) ?(?:h|:) ?([0-5]\d)\b/.exec(n))) return `${pad(+m[1])}:${m[2]}`;
    if ((m = /\b([01]?\d|2[0-3]) ?h(?![a-z0-9])/.exec(n))) return `${pad(+m[1])}:00`;
    return "";
  }
  function coversOf(s, labelled) {
    const n = norm(s); let m;
    if ((m = /\b(\d{1,3}) ?(personnes?|pers\b\.?|couverts?|cvts?|convives?|invites?|guests?|people|persons?|pax|adultes?|adults?)/.exec(n))) return +m[1];
    if ((m = /\b(?:table|reservation|resa) (?:pour|de|for) (\d{1,3})\b/.exec(n))) return +m[1];
    if ((m = /\bpour (\d{1,3})(?! ?(h|:|\/|€|eur|\d))\b/.exec(n))) return +m[1];
    if (labelled && (m = /^\D*(\d{1,3})\b/.exec(n))) return +m[1];
    return 0;
  }
  const PHONE = /(?:\+|00)\s?\d{2,3}[\s.\-]?\(?0?\)?\s?\d(?:[\s.\-]?\d{2}){4}|\b0[1-9](?:[\s.\-]?\d{2}){4}\b|\+\d[\d\s.\-]{7,16}\d/;
  const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
  const NOT_CLIENT = /zenchef|thefork|lafourchette|growthgusto|noreply|no-reply|ne-pas-repondre|notification|mailer|bounce|support@|contact@|google\.com|gmail-noreply|sevenrooms|resy|opentable|guestonline|formitable/i;
  const civ = (s) => clean(s).replace(/^(m\.|mr\.?|mme\.?|mlle\.?|monsieur|madame|mademoiselle|mrs\.?|ms\.?|dr\.?)\s+/i, "").replace(/[,;|·•–—-]+$/, "").trim();
  const nameOk = (s) => { const t = civ(s); return t.length >= 2 && t.length <= 60 && /[A-Za-zÀ-ÿ]/.test(t) && !/@|https?:|\d{3,}/.test(t) && !labelOf(t) && !/^(nouvelle|new|reservation|booking|bonjour|hello|confirm|annul|modifi)/i.test(norm(t)); };

  function provOf(from, text) {
    const s = norm(from + " " + text.slice(0, 4000));
    if (/zenchef/.test(s)) return "zenchef";
    if (/thefork|lafourchette|the fork/.test(s)) return "thefork";
    if (/sevenrooms/.test(s)) return "sevenrooms";
    if (/guestonline/.test(s)) return "guestonline";
    if (/formitable/.test(s)) return "formitable";
    if (/opentable/.test(s)) return "opentable";
    return "mail";
  }
  function kindOf(subject, text) {
    const s = norm(subject), t = norm(text.split("\n").slice(0, 6).join(" "));
    if (/annul|cancel|desist/.test(s)) return "cancel";
    if (/modifi|changement|change|updated|mise a jour|deplac/.test(s)) return "modify";
    if (/nouvelle|new|confirm|recue|demande|request/.test(s)) return "new";
    if (/a ete annulee|annulation|cancell?ed/.test(t)) return "cancel";
    if (/a ete modifiee|modification/.test(t)) return "modify";
    return "new";
  }

  function rzParse(mail) {
    mail = mail || {};
    const subject = clean(mail.subject || "");
    let body = mail.text && String(mail.text).trim() ? String(mail.text) : rzText(mail.html || "");
    if (mail.text && mail.html && !/\d/.test(mail.text)) body = rzText(mail.html);
    const base = mail.sentAt ? Date.parse(mail.sentAt) || Date.now() : Date.now();
    const raw = body.split(/\r?\n/).map(clean).filter(Boolean).filter((l) => !/^>+\s*$/.test(l)).map((l) => l.replace(/^>+\s?/, ""));
    /* a forwarded header block: « De : » followed within a few lines by « Objet : » (a lone « Date : » line is the booking's) */
    const drop = new Set();
    raw.forEach((l, i) => { if (!/^(de|from)\s*:/.test(norm(l))) return; for (let j = i + 1; j < Math.min(raw.length, i + 7); j++) if (/^(objet|subject)\s*:/.test(norm(raw[j]))) { for (let k = i; k <= j; k++) if (HDR.test(norm(raw[k]))) drop.add(k); break; } });
    const lines = raw.filter((l, i) => !drop.has(i) && !/^-{3,}.*(forward|transf[eé]r|original).*-{3,}$/i.test(l));
    const F = {};
    /* « Label : valeur » on one line, or the label alone and its value on the next line (HTML tables) */
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; const m = /^([^:：]{2,40})\s*[:：]\s*(.*)$/.exec(l);
      if (m) { const k = labelOf(m[1]); if (k && !F[k]) { const v = m[2].trim() || (lines[i + 1] && !labelOf(lines[i + 1].replace(/[:：].*$/, "")) ? lines[i + 1] : ""); if (v) F[k] = v; continue; } }
      const k = labelOf(l.replace(/[:：]\s*$/, ""));
      if (k && !F[k] && lines[i + 1] && !labelOf(lines[i + 1].replace(/[:：].*$/, ""))) F[k] = lines[i + 1];
    }
    const all = subject + "\n" + lines.join("\n");
    const out = { ok: false, kind: kindOf(subject, lines.join("\n")), provider: provOf(mail.from || "", subject + "\n" + raw.join("\n")), date: "", time: "", covers: 0, name: "", phone: "", email: "", notes: "", ref: "" };
    /* date and time: the labelled fields, then the first line holding a date (and its time), then anywhere */
    out.date = dateOf(F.date || F.when || "", base);
    out.time = timeOf(F.time || "") || timeOf(F.when || "") || (F.date ? timeOf(F.date) : "");
    if (!out.date || !out.time) {
      for (const l of [subject, ...lines]) { const d = dateOf(l, base); if (!d) continue; if (!out.date) out.date = d; if (!out.time) { const t = timeOf(l.replace(/\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/g, " ")); if (t) out.time = t; } if (out.time) break; }
    }
    if (!out.time) { for (const l of [subject, ...lines]) { if (/envoy|recu le|sent|received|il y a/.test(norm(l))) continue; const t = timeOf(l.replace(/\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/g, " ")); if (t) { out.time = t; break; } } }
    out.covers = (F.covers ? coversOf(F.covers, true) : 0) || coversOf(subject) || coversOf(lines.join("\n"));
    if (out.covers > 300) out.covers = 0;
    /* name */
    let nm = F.name || "";
    if (F.first || F.last) nm = [F.first, F.last].filter(Boolean).join(" ") || nm;
    if (!nameOk(nm)) {
      nm = "";
      const sm = /(?:reservation|r[ée]servation|booking|demande|annulation|modification)\s*(?:de|pour|par|from|for|by|:|-|–|—)\s*(?:m\.|mr|mme|mlle|monsieur|madame)?\s*([A-Za-zÀ-ÿ'’\- ]{2,50}?)(?=\s*(?:[,\-–—|(·•]|\d|\bpour\b|\ble\b|\bfor\b|\bon\b|$))/i.exec(subject);
      if (sm && nameOk(sm[1])) nm = sm[1];
    }
    if (!nm) { const cm = lines.find((l) => /^(m\.|mr\.?|mme\.?|mlle\.?|monsieur|madame|mrs\.?|ms\.?)\s+[A-Za-zÀ-ÿ]/i.test(l) && l.length < 60); if (cm && nameOk(cm)) nm = cm; }
    out.name = nm ? civ(nm).replace(/\s+/g, " ").slice(0, 60) : "";
    /* contact */
    const ph = PHONE.exec(F.phone || "") || PHONE.exec(lines.join("\n"));
    if (ph) out.phone = clean(ph[0]).slice(0, 25);
    const em = String(F.email || "").match(EMAIL) || [];
    const ems = (em.length ? em : lines.join("\n").match(EMAIL) || []).filter((e) => !NOT_CLIENT.test(e) && (!mail.from || norm(mail.from).indexOf(norm(e)) < 0));
    if (ems.length) out.email = ems[0].slice(0, 100);
    out.notes = clean(F.notes || "").replace(/^(aucun|aucune|none|n\/a|-|néant|neant|rien)\.?$/i, "").slice(0, 300);
    const rf = /([A-Z0-9][A-Z0-9\-_]{3,30})/i.exec(F.ref || "") || /(?:r[ée]f[ée]rence|r[ée]f\.?|n[°ºo]\s?de r[ée]servation|booking (?:id|reference|ref))\s*[:#]?\s*([A-Z0-9][A-Z0-9\-_]{3,30})/i.exec(all);
    if (rf && /\d/.test(rf[1])) out.ref = rf[1];
    if (F.status && /annul|cancel/.test(norm(F.status))) out.kind = "cancel";
    out.ok = !!(out.date && out.time && out.covers >= 1);
    if (!out.ok) out.why = !out.date ? "date" : !out.time ? "heure" : "couverts";
    return out;
  }

  const api = { rzParse, rzText, rzDate: dateOf, rzTime: timeOf, rzCovers: coversOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : this);
