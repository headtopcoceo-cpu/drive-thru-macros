// Menu math: item lookup, prices, order totals, the cheat-meal score and meal ideas.
const Engine = (() => {
  const CHAINS = ["McDonald's", "Wendy's", "Harvey's", 'A&W', 'Burger King'];
  const CATS = ['Burgers', 'Chicken', 'Breakfast', 'Sides', 'Salads', 'Desserts', 'More'];
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
  function setOverrides(o) { overrides = o || {}; }
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
      const isMain = MAIN_CATS.has(it.cat) || it.cat === 'Salads' || (includeBreakfast && it.cat === 'Breakfast' && it.p >= 10);
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
      const salads = mainsAll.filter((m) => m.cat === 'Salads');
      const sorted = mainsAll.filter((m) => m.cat !== 'Salads').sort((a, b) => macros(a, mode).cal - macros(b, mode).cal);
      const withFry = (parts) => { for (const fr of fryOpts) push([grp(chain, fr ? [...parts, fr] : parts)]); };
      for (const sl of salads) withFry([sl]); // a salad is a meal on its own
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
      if (!okChain(d.chain) || d.once || (d.expires && d.expires < todayStr())) continue; // one-time offers (welcome deals) aren't repeat meals
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
            if (sx[i].parts[0].cat === 'Salads' || sx[j].parts[0].cat === 'Salads') continue; // a salad stays a meal on its own
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
      x.combo = comboOf(x);
      x.rank = priority === 'lean' ? x.p100 + x.combo.score / 1000 : priority === 'value' ? (x.pd || 0) + x.combo.score / 1000 : x.combo.score + x.p / 1000;
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

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  return {
    CHAINS, CATS, MAIN_CATS, GRADES, load, setOverrides, setCustomDeals, allDeals,
    get items() { return items; }, get sauces() { return sauces; }, get curve() { return curve; },
    byId: (id) => byId.get(id), sauceByKey: (k) => sauceByKey.get(k), dealById: (id) => dealById.get(id),
    STOP_PENALTY, macros, hasNs, priceOf, isMine, isApprox, isPlainFries, scoreOf, gradeOf, itemKey, dealKey, dealPicks, resolve, totals, ideas, todayStr, r1,
  };
})();
