// Menu math: item lookup, prices, order totals, the cheat-meal score and meal ideas.
const Engine = (() => {
  const CHAINS = ["McDonald's", "Wendy's", "Harvey's", 'A&W', 'Burger King'];
  const CATS = ['Burgers', 'Chicken', 'Breakfast', 'Sides', 'Desserts', 'More'];
  const MAIN_CATS = new Set(['Burgers', 'Chicken', 'More']);
  const GRADES = [[85, 'A', 'Top of the fast-food pack'], [70, 'B', 'Solid for fast food'], [50, 'C', 'About average for fast food'], [30, 'D', 'Heavy on the bun and fries'], [0, 'E', 'Mostly carbs and fat']];
  const PLAIN_FRIES = /^(kids|small|medium|large|regular|mini) fries$/i;
  const STOP_PENALTY = 6; // combo-score points a second stop has to make up

  let items = [], byId = new Map(), sauces = [], sauceByKey = new Map(), deals = [], dealById = new Map(), curve = [];
  let overrides = {}; // user prices by item id
  let customDeals = [];

  const r1 = (x) => Math.round(x * 10) / 10;
  const isPlainFries = (it) => it.cat === 'Sides' && PLAIN_FRIES.test(it.name);
  const hasNs = (it) => !!it.ns;
  const macros = (it, mode) => (mode === 'ns' && it.ns ? it.ns : it);
  const priceOf = (it) => (overrides[it.id] != null ? overrides[it.id] : it.price ?? null);
  const isMine = (it) => overrides[it.id] != null;
  const isApprox = (it) => !isMine(it) && it.psrc === 'approx' && it.price != null;

  function load(menu, dealsFile) {
    items = menu.items; byId = new Map(items.map((i) => [i.id, i]));
    sauces = menu.sauces || []; sauceByKey = new Map(sauces.map((s) => [s.key, s]));
    deals = (dealsFile && dealsFile.deals) || [];
    rebuildDeals();
    // the fast-food curve: one main ordered without sauce, alone or with a plain fries size from the same chain
    const mains = items.filter((i) => MAIN_CATS.has(i.cat) && i.cal > 0);
    const fries = items.filter(isPlainFries);
    const out = [];
    for (const m of mains) {
      const mm = macros(m, 'ns');
      for (const f of [null, ...fries.filter((x) => x.chain === m.chain)]) {
        const cal = mm.cal + (f ? f.cal : 0), p = mm.p + (f ? f.p : 0);
        out.push(Math.round((p / cal) * 1000) / 10);
      }
    }
    curve = out.sort((a, b) => a - b);
  }
  let overridesKey = '{}';
  function setOverrides(o) { overrides = o || {}; overridesKey = JSON.stringify(overrides); }
  function setCustomDeals(list) { customDeals = list || []; rebuildDeals(); }
  function rebuildDeals() { dealById = new Map([...deals, ...customDeals].map((d) => [d.id, d])); }
  const allDeals = () => [...deals, ...customDeals];

  const scoreOf = (p100) => { if (!curve.length) return 0; const v = Math.round(p100 * 10) / 10; let below = 0, tie = 0; for (const c of curve) { if (c < v) below++; else if (c === v) tie++; } return Math.round((100 * (below + tie / 2)) / curve.length); };
  const gradeOf = (s) => GRADES.find(([min]) => s >= min);

  // ---- cart lines. Item key: "i|<id>|<ns|full>". Deal key: "d|<dealId>|<ns|full>|<id,id,...>"
  const itemKey = (id, mode) => { const it = byId.get(id); return `i|${id}|${it && hasNs(it) && mode === 'ns' ? 'ns' : 'full'}`; };
  const dealKey = (dealId, mode, picks) => `d|${dealId}|${mode === 'ns' ? 'ns' : 'full'}|${picks.join(',')}`;
  function dealPicks(deal, choiceIdx) { // expand slots into a flat list of item ids (with repeats for qty)
    const out = [];
    deal.slots.forEach((s, i) => { const id = s.choices[(choiceIdx && choiceIdx[i]) || 0]; for (let q = 0; q < (s.qty || 1); q++) out.push(id); });
    return out;
  }
  function resolve(key) {
    const [t, a, mode, rest] = key.split('|');
    if (t === 'i') {
      const it = byId.get(a); if (!it) return null;
      const m = macros(it, mode);
      return { kind: 'item', key, item: it, mode, name: it.name, chain: it.chain, cal: m.cal, p: m.p, f: m.f, c: m.c, price: priceOf(it), approx: isApprox(it), noSauce: mode === 'ns' && hasNs(it), removed: mode === 'ns' && it.ns ? it.ns.removed : '' };
    }
    if (t === 'd') {
      const deal = dealById.get(a); if (!deal) return null;
      const ids = (rest || '').split(',').filter(Boolean); const parts = ids.map((id) => byId.get(id)).filter(Boolean);
      if (!parts.length) return null;
      const tot = { cal: 0, p: 0, f: 0, c: 0 }; let regular = 0, regularKnown = true;
      for (const it of parts) { const m = macros(it, mode); tot.cal += m.cal; tot.p += m.p; tot.f += m.f; tot.c += m.c; const pr = priceOf(it); if (pr == null) regularKnown = false; else regular += pr; }
      return { kind: 'deal', key, deal, mode, parts, name: deal.title, chain: deal.chain, ...tot, price: deal.price, approx: !!deal.approx, regular: regularKnown ? regular : null, noSauce: mode === 'ns' && parts.some(hasNs) };
    }
    return null;
  }
  function totals(cart, sauceQty) {
    const t = { cal: 0, p: 0, f: 0, c: 0, n: 0, price: 0, pricedP: 0, pricedCal: 0, unpriced: [], approx: new Set(), lines: [] };
    for (const [k, q] of cart) {
      const L = resolve(k); if (!L) continue; t.lines.push([L, q]);
      t.cal += L.cal * q; t.p += L.p * q; t.f += L.f * q; t.c += L.c * q; t.n += q;
      if (L.price != null) { t.price += L.price * q; t.pricedP += L.p * q; t.pricedCal += L.cal * q; if (L.approx) t.approx.add(L.chain); }
      else t.unpriced.push(L);
    }
    for (const s of sauces) { const q = (sauceQty && sauceQty[s.key]) || 0; t.cal += s.cal * q; t.p += s.p * q; t.f += s.f * q; t.c += s.c * q; }
    t.p100 = t.cal > 0 ? (t.p / t.cal) * 100 : 0;
    return t;
  }

  // ---- meal ideas
  function ideas(opts) {
    const { budget, minCal, priority, chains, mode, includeDeals, includeBreakfast, withFries, stops = 1, maxPerChain = 3, limit = 12 } = opts;
    const okChain = (c) => !chains || !chains.length || chains.includes(c);
    const mainsBy = new Map(), friesBy = new Map();
    for (const it of items) {
      if (!okChain(it.chain) || priceOf(it) == null) continue;
      const isMain = MAIN_CATS.has(it.cat) || (includeBreakfast && it.cat === 'Breakfast' && it.p >= 10);
      if (isMain) { if (!mainsBy.has(it.chain)) mainsBy.set(it.chain, []); mainsBy.get(it.chain).push(it); }
      if (isPlainFries(it)) { if (!friesBy.has(it.chain)) friesBy.set(it.chain, []); friesBy.get(it.chain).push(it); }
    }
    const cands = [];
    // ---- groups: what you order at one restaurant (items, or one deal)
    const sumMac = (parts) => { let cal = 0, p = 0, f = 0, c = 0; for (const it of parts) { const m = macros(it, mode); cal += m.cal; p += m.p; f += m.f; c += m.c; } return { cal, p, f, c }; };
    const grp = (chain, parts, deal, dealRegular) => {
      const reg = parts.reduce((t, x) => t + (priceOf(x) ?? 0), 0);
      return { chain, parts, deal: deal || null, price: deal ? deal.price : reg, regular: deal ? dealRegular : reg, cal: sumMac(parts).cal };
    };
    const make = (groups) => {
      const parts = groups.flatMap((g) => g.parts); const m = sumMac(parts);
      const price = groups.reduce((t, g) => t + g.price, 0);
      const chainsIn = [...new Set(groups.map((g) => g.chain))];
      const hasDeal = groups.some((g) => g.deal);
      const regular = hasDeal && groups.every((g) => g.regular != null) ? groups.reduce((t, g) => t + g.regular, 0) : null;
      return { chain: chainsIn.join(' + '), chains: chainsIn, stops: chainsIn.length, groups, parts, price, deal: groups.length === 1 ? groups[0].deal : null, regular, ...m, p100: m.cal > 0 ? (m.p / m.cal) * 100 : 0, pd: price > 0 ? m.p / price : null };
    };
    const push = (groups) => { const cal = groups.reduce((t, g) => t + g.cal, 0); if (cal > budget || cal < minCal || cal <= 0) return; cands.push(make(groups)); };

    // ---- the combo score (0-100): 40% leanness, 40% value, 20% protein, minus a few points for a second stop.
    // Leanness scales protein per 100 cal from 3 g (0) to the 10 g golden ratio (100); value scales protein per dollar
    // from 2 g (0) to 7 g (100, the best on these menus); protein is the share of the meal target reached.
    const pTarget = opts.pTarget || 50;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const comboOf = (x) => {
      const lean = Math.round(clamp01((x.p100 - 3) / 7) * 100), value = Math.round(clamp01(((x.pd || 0) - 2) / 5) * 100), prot = Math.round(clamp01(x.p / pTarget) * 100);
      const score = Math.max(0, Math.round(0.4 * lean + 0.4 * value + 0.2 * prot - (x.stops > 1 ? STOP_PENALTY : 0)));
      return { score, lean, value, prot };
    };

    // ---- one stop
    const singlesBy = new Map(), dealUnitsBy = new Map(), friesUnitsBy = new Map();
    for (const [chain, mainsAll] of mainsBy) {
      const fryOpts = withFries ? (friesBy.get(chain) || []) : [null];
      friesUnitsBy.set(chain, (friesBy.get(chain) || []).map((fr) => grp(chain, [fr])));
      singlesBy.set(chain, mainsAll.filter((m) => macros(m, mode).cal <= budget).map((m) => grp(chain, [m])));
      if (!fryOpts.length) continue;
      const sorted = mainsAll.slice().sort((a, b) => macros(a, mode).cal - macros(b, mode).cal);
      const withFry = (parts) => { for (const fr of fryOpts) push([grp(chain, fr ? [...parts, fr] : parts)]); };
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i]; const ca = macros(a, mode).cal; if (ca > budget) break;
        withFry([a]);
        for (let j = i; j < sorted.length; j++) {
          const b = sorted[j]; const cb = macros(b, mode).cal; if (ca + cb > budget) break;
          withFry([a, b]);
          if (withFries || ca > 450 || cb > 450) continue;
          for (let k = j; k < sorted.length; k++) {
            const cc = sorted[k]; const c3 = macros(cc, mode).cal; if (ca + cb + c3 > budget || c3 > 450) break;
            if (i === j && j === k) continue; // not three of the same thing
            push([grp(chain, [a, b, cc])]);
          }
        }
      }
    }
    if (includeDeals) for (const d of allDeals()) {
      if (!okChain(d.chain) || d.once || d.unconfirmed || (d.expires && d.expires < todayStr())) continue; // one-time offers (welcome deals) aren't repeat meals; coupons not yet seen locally aren't suggested
      const combos = [[]];
      for (const s of d.slots) { const next = []; for (const pre of combos) for (let ci = 0; ci < s.choices.length; ci++) next.push([...pre, ci]); combos.length = 0; combos.push(...next.slice(0, 60)); }
      const seen = new Set();
      for (const idx of combos) {
        const ids = dealPicks(d, idx); const sig = ids.slice().sort().join(','); if (seen.has(sig)) continue; seen.add(sig);
        const parts = ids.map((id) => byId.get(id)).filter(Boolean); if (parts.length !== ids.length) continue;
        let regular = 0, known = true; for (const it of parts) { const pr = priceOf(it); if (pr == null) known = false; else regular += pr; }
        const g = grp(d.chain, parts, d, known ? regular : null);
        if (!withFries) push([g]);
        if (!dealUnitsBy.has(d.chain)) dealUnitsBy.set(d.chain, []); dealUnitsBy.get(d.chain).push(g);
      }
    }

    // ---- two stops: the strongest orders from one restaurant paired with the strongest from another
    if (stops !== 1) {
      const unitScore = (g) => comboOf({ ...make([g]), stops: 1 }).score;
      const top = (list, k) => list.map((g) => [g, unitScore(g)]).sort((a, b) => b[1] - a[1]).slice(0, k).map((x) => x[0]);
      const unitsBy = new Map(), singleTop = new Map();
      for (const chain of CHAINS) {
        const singles = top(singlesBy.get(chain) || [], 14);
        singleTop.set(chain, singles);
        unitsBy.set(chain, [...singles, ...top(dealUnitsBy.get(chain) || [], 8)]);
      }
      const fit = (...gs) => gs.reduce((t, g) => t + g.cal, 0) <= budget;
      const chainsHere = CHAINS.filter((c) => okChain(c) && (unitsBy.get(c) || []).length);
      for (let a = 0; a < chainsHere.length; a++) for (let b = a + 1; b < chainsHere.length; b++) {
        const A = chainsHere[a], B = chainsHere[b];
        for (const u of unitsBy.get(A)) for (const v of unitsBy.get(B)) {
          if (!fit(u, v)) continue;
          if (withFries) { for (const fr of [...(friesUnitsBy.get(A) || []), ...(friesUnitsBy.get(B) || [])]) if (fit(u, v, fr)) push([u, v, fr]); }
          else push([u, v]);
        }
        if (withFries) continue;
        for (const [X, Y] of [[A, B], [B, A]]) {
          const sx = singleTop.get(X) || [];
          for (let i = 0; i < sx.length; i++) for (let j = i; j < sx.length; j++) {
            const pair = grp(X, [...sx[i].parts, ...sx[j].parts]);
            if (pair.cal > budget) continue;
            for (const v of unitsBy.get(Y)) if (fit(pair, v)) push(X === A ? [pair, v] : [v, pair]);
          }
        }
      }
    }
    if (stops === 2) for (let i = cands.length - 1; i >= 0; i--) if (cands[i].stops < 2) cands.splice(i, 1);
    if (!cands.length) return [];
    for (const x of cands) {
      x.combo = comboOf(x); x.bob = bobScore({ cal: x.cal, p: x.p, price: x.price });
      x.rank = priority === 'lean' ? x.p100 + x.bob.score / 1000 : priority === 'value' ? (x.pd || 0) + x.bob.score / 1000 : x.bob.score + x.p / 1000;
    }
    cands.sort((a, b) => b.rank - a.rank);
    const out = [], perKey = {}, seenSig = new Set();
    for (const x of cands) {
      const sig = x.groups.map((g) => g.chain + ':' + g.parts.map((p) => p.id).sort().join(',') + ':' + (g.deal ? g.deal.id : '')).sort().join('|');
      const msig = x.chain + '|' + Math.round(x.cal / 10) + '|' + Math.round(x.p);
      if (seenSig.has(sig) || seenSig.has(msig)) continue;
      seenSig.add(msig);
      if ((perKey[x.chain] || 0) >= maxPerChain) continue;
      seenSig.add(sig); perKey[x.chain] = (perKey[x.chain] || 0) + 1; out.push(x);
      if (out.length >= limit) break;
    }
    return out;
  }

  // ---- Bob's Top 5s: satisfying fast-food meals that are good value and still light. Ranked on value (protein per
  // dollar), protein per 100 cal and keeping calories low. One restaurant: two or more different items. Two
  // restaurants: a chicken item from one and a beef burger from the other. Only burgers, chicken sandwiches (no
  // grilled), strips and nuggets; no triple-patty burgers, veggie patties, wraps, fish or sides.
  // The Bob score is relative to fast food, not to ideal macros. A reference set of every realistic one-restaurant
  // cheat meal on these menus (one or two mains, with or without a side, no sauce, 300-1,600 cal; grilled chicken and
  // salads were never in) sets the scale: 0 = the worst 1% of those orders, 50 = a typical one (the median),
  // 100 = the best on these menus. Calories are judged against a generic 2,000-cal day, not personal targets.
  const BOB_W = { value: 0.5, lean: 0.3, light: 0.2 }; // protein per dollar, protein per 100 cal, calories
  const GENERIC_DAY = 2000;
  const BOB_CAL = { min: 450, max: 1100 }; // ranked Top 5 orders: up to 55% of a generic day
  const BOB_MIN_P = 30; // grams of protein for it to count as a proper meal
  const REF_NO = /grill/i;
  let refMemo = null;
  function reference(mode = 'ns') {
    const key = mode + '|' + items.length + '|' + overridesKey;
    if (refMemo && refMemo.key === key) return refMemo;
    const by = new Map();
    for (const it of items) {
      if (priceOf(it) == null || REF_NO.test(it.name)) continue; const m = macros(it, mode); if (!(m.cal > 0)) continue;
      const kind = MAIN_CATS.has(it.cat) ? 'm' : it.cat === 'Sides' ? 's' : null; if (!kind) continue;
      if (!by.has(it.chain)) by.set(it.chain, { m: [], s: [] }); by.get(it.chain)[kind].push([m.cal, m.p, m.f, m.c, priceOf(it)]);
    }
    const pd = [], p100 = [], f100 = [], c100 = [], kcal = [];
    const add = (a, b, c) => {
      let cal = a[0], p = a[1], f = a[2], cc = a[3], pr = a[4];
      if (b) { cal += b[0]; p += b[1]; f += b[2]; cc += b[3]; pr += b[4]; } if (c) { cal += c[0]; p += c[1]; f += c[2]; cc += c[3]; pr += c[4]; }
      if (cal < 300 || cal > 1600) return; pd.push(p / pr); p100.push((p * 100) / cal); f100.push((f * 100) / cal); c100.push((cc * 100) / cal); kcal.push(cal);
    };
    for (const { m, s: sd } of by.values()) for (let i = 0; i < m.length; i++) {
      add(m[i]); for (const x of sd) add(m[i], x);
      for (let j = i; j < m.length; j++) { add(m[i], m[j]); for (const x of sd) add(m[i], m[j], x); }
    }
    const anchors = (arr, up) => { arr.sort((a, b) => a - b); const at = (q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))]; return up ? { lo: at(0.01), mid: at(0.5), hi: arr[arr.length - 1] } : { lo: at(0.99), mid: at(0.5), hi: arr[0] }; };
    kcal.sort((a, b) => a - b);
    refMemo = { key, n: pd.length, pd: anchors(pd, true), p100: anchors(p100, true), f100: anchors(f100, false), c100: anchors(c100, false), medianCal: kcal[Math.floor(kcal.length / 2)] };
    return refMemo;
  }
  // 0 = worst 1% of fast-food orders, 50 = typical (median), 100 = best on these menus; works for lower-is-better too
  function relScore(v, a) {
    if (v == null || !isFinite(v) || !a) return 0;
    const up = a.hi >= a.lo; const t = up ? v : -v, lo = up ? a.lo : -a.lo, mid = up ? a.mid : -a.mid, hi = up ? a.hi : -a.hi;
    if (t <= lo) return 0; if (t >= hi) return 100;
    return t <= mid ? (50 * (t - lo)) / (mid - lo) : 50 + (50 * (t - mid)) / (hi - mid);
  }
  const rel = (metric, v, mode = 'ns') => relScore(v, reference(mode)[metric]);
  // calories against a generic 2,000-cal day: 30% of the day (600) or less = 100, half (1,000) = 50, 70% (1,400) or more = 0
  const calScore = (cal) => { const sh = cal / GENERIC_DAY; return sh <= 0.3 ? 100 : sh <= 0.5 ? 100 - 250 * (sh - 0.3) : sh <= 0.7 ? 50 - 250 * (sh - 0.5) : 0; };
  const BOB_NO = /grill|wrap|salad|poutine|bowl|snack box|veggie|plant|impossible|beyond|triple|grandpa/i;
  const BOB_CHICKEN = /sandwich|burger|mcchicken|mccrispy|junior chicken|chicken jr|cruncher|club|buddy|strip|nugget|tender|chicken fries/i;
  const BOB_SIDEKICK = /strip|nugget|tender|chicken fries/i; // fine in an order, but not on their own
  const bobEligible = (it) => (it.cat === 'Burgers' || (it.cat === 'Chicken' && BOB_CHICKEN.test(it.name))) && !BOB_NO.test(it.name);
  const bobAnchor = (it) => it.cat === 'Burgers' || !BOB_SIDEKICK.test(it.name);
  const bobParts = (cal, p, price, ref = reference('ns')) => ({
    value: price > 0 ? relScore(p / price, ref.pd) / 100 : 0,
    lean: cal > 0 ? relScore((p * 100) / cal, ref.p100) / 100 : 0,
    light: calScore(cal) / 100,
  });
  const bobRaw = (b) => BOB_W.value * b.value + BOB_W.lean * b.lean + BOB_W.light * b.light;
  function bobScore(t) {
    const b = bobParts(t.cal, t.p, t.price);
    return { score: Math.round(100 * bobRaw(b)), value: Math.round(b.value * 100), lean: Math.round(b.lean * 100), light: Math.round(b.light * 100), p100: (t.p / t.cal) * 100, perG: t.price > 0 && t.p > 0 ? t.price / t.p : null };
  }
  // build a scored order from stops: [{ chain, units: [{ deal?, parts: [items] }] }] or [{ chain, ids: [...] }]
  function bobOrder(stops, mode = 'ns') {
    const groups = stops.map((s) => {
      const units = s.units || s.ids.map((id) => ({ parts: [byId.get(id)].filter(Boolean) }));
      const parts = units.flatMap((u) => u.parts);
      let price = 0; const unpriced = [];
      for (const u of units) { if (u.deal) price += u.deal.price; else for (const it of u.parts) { const pr = priceOf(it); if (pr == null) unpriced.push(it); else price += pr; } }
      return { chain: s.chain, units, parts, deals: units.filter((u) => u.deal).map((u) => u.deal), price, unpriced };
    });
    const parts = groups.flatMap((g) => g.parts); const t = { cal: 0, p: 0, f: 0, c: 0 };
    for (const it of parts) { const m = macros(it, mode); t.cal += m.cal; t.p += m.p; t.f += m.f; t.c += m.c; }
    const unpriced = groups.flatMap((g) => g.unpriced);
    const price = unpriced.length ? null : groups.reduce((a, g) => a + g.price, 0);
    const approx = parts.some((it) => isApprox(it)) || groups.some((g) => g.deals.some((d) => d.approx));
    const chainsIn = groups.map((g) => g.chain);
    return { chain: chainsIn.join(' + '), chains: chainsIn, stops: groups.length, groups, parts, ...t, price, approx, unpriced, p100: (t.p / t.cal) * 100, bob: bobScore({ ...t, price: price || 0 }) };
  }
  // ---- colour bands: 3 = great (green), 2 = good (yellow), 1 = fair (orange), 0 = poor (red)
  // Relative numbers (value, macros, fat, carbs, calories, Bob score) are banded on their 0-100 score:
  // 80+ great, 60+ good, 40+ fair (a typical fast-food order scores about 50), under 40 poor.
  const RATE_LABEL = ['Poor', 'Fair', 'Good', 'Great'];
  const band = (score) => (score == null || !isFinite(score) ? null : score >= 80 ? 3 : score >= 60 ? 2 : score >= 40 ? 1 : 0);
  function rate(metric, v) {
    if (v == null || !isFinite(v)) return null;
    if (metric === 'bob') return band(v);
    if (metric === 'cal') return band(calScore(v));
    if (metric === 'protein') return v >= 45 ? 3 : v >= 35 ? 2 : v >= 25 ? 1 : 0; // grams in the order
    return band(rel(metric, v)); // pd, p100, f100, c100
  }
  // one item (or deal) on its own: half protein per dollar, half protein per 100 cal, both relative to fast food
  function itemRating(cal, p, price) {
    if (!(cal > 0)) return null; const ref = reference('ns');
    const l = relScore((p * 100) / cal, ref.p100); const sc = price > 0 ? (relScore(p / price, ref.pd) + l) / 2 : l;
    return { score: Math.round(sc), level: band(sc), priced: price > 0 };
  }

  const topMemo = new Map();
  function topFives(opts) {
    const { mode = 'ns', n = 5 } = opts || {};
    const memoKey = [mode, n, items.length, JSON.stringify(overrides), allDeals().map((d) => d.id + d.price + (d.expires || '')).join()].join('|');
    if (topMemo.has(memoKey)) return topMemo.get(memoKey);
    const today = todayStr();
    const ok = (cal, p) => cal >= BOB_CAL.min && cal <= BOB_CAL.max && p >= BOB_MIN_P;
    const ref = reference(mode); const sc = (cal, p, price) => bobRaw(bobParts(cal, p, price, ref));
    // units a stop can be built from: single priced items, or a current deal whose food all qualifies
    const unitsBy = new Map(); const addUnit = (chain, u) => { if (!unitsBy.has(chain)) unitsBy.set(chain, []); unitsBy.get(chain).push(u); };
    const mk = (parts, deal) => { let cal = 0, p = 0; for (const it of parts) { const m = macros(it, mode); cal += m.cal; p += m.p; } return { parts, deal: deal || null, cal, p, price: deal ? deal.price : parts.reduce((a, it) => a + priceOf(it), 0), anchor: parts.some(bobAnchor), ids: parts.map((x) => x.id) }; };
    for (const it of items) if (bobEligible(it) && priceOf(it) != null && macros(it, mode).cal > 0) addUnit(it.chain, mk([it]));
    for (const d of allDeals()) {
      if (d.once || d.unconfirmed || (d.expires && d.expires < today) || !(d.price > 0)) continue;
      const combos = [[]];
      for (const s of d.slots) { const next = []; for (const pre of combos) s.choices.forEach((_, ci) => next.push([...pre, ci])); combos.length = 0; combos.push(...next.slice(0, 40)); }
      const seen = new Set();
      for (const idx of combos) {
        const parts = dealPicks(d, idx).map((id) => byId.get(id)); if (parts.some((x) => !x || !bobEligible(x))) continue;
        const sig = parts.map((x) => x.id).sort().join(); if (seen.has(sig)) continue; seen.add(sig);
        addUnit(d.chain, mk(parts, d));
      }
    }
    // one restaurant: two or three items, at least two different ones, with a burger or sandwich
    const oneRaw = [];
    for (const [chain, U] of unitsBy) {
      const m = U.length;
      const push = (us) => {
        let cal = 0, p = 0, price = 0, anchor = false; const ids = [];
        for (const u of us) { cal += u.cal; p += u.p; price += u.price; anchor = anchor || u.anchor; ids.push(...u.ids); }
        if (ids.length < 2 || ids.length > 3 || new Set(ids).size < 2 || !anchor || !ok(cal, p)) return;
        oneRaw.push([sc(cal, p, price), cal, chain, us]);
      };
      for (let i = 0; i < m; i++) {
        push([U[i]]); // a two-item deal on its own
        for (let j = i; j < m; j++) {
          if (i === j && U[i].deal) continue;
          push([U[i], U[j]]);
          for (let k = j; k < m; k++) { if ((i === j && j === k) || (j === k && U[k].deal)) continue; push([U[i], U[j], U[k]]); }
        }
      }
    }
    oneRaw.sort((x, y) => y[0] - x[0] || x[1] - y[1]); // ties go to the lighter order
    const one = oneRaw.slice(0, 800).map((r) => bobOrder([{ chain: r[2], units: r[3] }], mode));
    // two restaurants: a chicken item at one stop and a beef burger at the other
    const twoRaw = [];
    const singles = (chain, cat) => (unitsBy.get(chain) || []).filter((u) => !u.deal && u.parts[0].cat === cat);
    for (const A of CHAINS) for (const B of CHAINS) {
      if (A === B) continue;
      for (const c of singles(A, 'Chicken').filter((u) => u.p >= 15)) for (const b of singles(B, 'Burgers')) { // a real chicken portion, not a snack-size nugget box
        const cal = c.cal + b.cal, p = c.p + b.p; if (!ok(cal, p)) continue;
        twoRaw.push([sc(cal, p, c.price + b.price), cal, A, [c], B, [b]]);
      }
    }
    twoRaw.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    const two = twoRaw.slice(0, 1000).map((r) => bobOrder([{ chain: r[2], units: r[3] }, { chain: r[4], units: r[5] }], mode));
    // keep the list varied: no near-copies of an order already picked, and a cap per restaurant (or pair)
    const base = (it) => it.name.replace(/\bspicy\s+/i, '').trim().toLowerCase();
    const pick = (list, capKey, cap, chainCap) => {
      const out = [], perKey = {}, perChain = {};
      for (const x of list) {
        const key = capKey(x); if ((perKey[key] || 0) >= cap) continue;
        if (chainCap && x.chains.some((c) => (perChain[c] || 0) >= chainCap)) continue;
        const set = new Set(x.parts.map(base)); const mac = Math.round(x.cal / 10) + '|' + Math.round(x.p) + '|' + Math.round((x.price || 0) * 10);
        const dup = out.some((o) => o.mac === mac || (capKey(o.x) === key && ([...set].every((q) => o.set.has(q)) || [...o.set].every((q) => set.has(q)))));
        if (dup) continue;
        out.push({ x, set, mac }); perKey[key] = (perKey[key] || 0) + 1; for (const c of x.chains) perChain[c] = (perChain[c] || 0) + 1;
        if (out.length >= n) break;
      }
      return out.map((o) => o.x);
    };
    const pairKey = (x) => [...x.chains].sort().join(' + ');
    const res = { one: pick(one, (x) => x.chain, 2), two: pick(two, pairKey, 1, 3), cal: BOB_CAL, minP: BOB_MIN_P };
    topMemo.set(memoKey, res);
    return res;
  }

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  return {
    CHAINS, CATS, MAIN_CATS, GRADES, load, setOverrides, setCustomDeals, allDeals,
    get items() { return items; }, get sauces() { return sauces; }, get curve() { return curve; },
    byId: (id) => byId.get(id), sauceByKey: (k) => sauceByKey.get(k), dealById: (id) => dealById.get(id),
    STOP_PENALTY, macros, hasNs, priceOf, isMine, isApprox, isPlainFries, scoreOf, gradeOf, itemKey, dealKey, dealPicks, resolve, totals, ideas, topFives, bobScore, bobOrder, BOB_W, BOB_CAL, BOB_MIN_P, GENERIC_DAY, RATE_LABEL, rate, rel, calScore, band, reference, itemRating, todayStr, r1,
  };
})();
