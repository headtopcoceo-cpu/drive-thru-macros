(() => {
  const E = Engine;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtC = (x) => Math.round(x).toLocaleString('en-CA');
  const fmtN = (x) => String(Math.round(x * 10) / 10);
  const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const fmt$ = (x) => '$' + (Math.round(x * 100) / 100).toFixed(2);
  const CHAIN_VAR = { "McDonald's": '--c-mcd', "Wendy's": '--c-wen', "Harvey's": '--c-har', 'A&W': '--c-aw', 'Burger King': '--c-bk' };
  const cvar = (c) => `var(${CHAIN_VAR[c] || '--ink-2'})`;
  const today = () => E.todayStr();
  const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const niceDay = (s, opts) => parseDay(s).toLocaleDateString('en-CA', opts || { weekday: 'short', month: 'short', day: 'numeric' });
  const p100 = (m) => (m.cal > 0 ? (m.p / m.cal) * 100 : 0);
  const uid = () => (self.crypto && crypto.randomUUID ? crypto.randomUUID() : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const PAGE = 48;

  const S = {
    tab: 'order', chain: 'All', cat: 'All', mode: 'ns', sort: 'p100', q: '', xAxis: 'cal', page: PAGE,
    cart: new Map(), sauce: {}, meals: [], span: 'week', anchor: new Date(), cal: 1900, pro: 160,
    prices: {}, customDeals: [], dealChain: 'All', dealPick: {}, confirmDel: null, pChain: "McDonald's", pq: '',
    ideas: { budget: null, priority: 'balanced', chains: [], deals: true, breakfast: false, ns: true, fries: false, stops: 1 },
    dfItems: [], menu: null, dealsFile: null, memoryOnly: false, saveTimer: null, priceTimer: null,
  };

  // ---------- persistence ----------
  function saveCartSoon() {
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(() => { Store.set('cart', { items: [...S.cart], sauces: { ...S.sauce } }).catch(() => {}); }, 400);
  }
  const saveSettings = () => Store.set('settings', { cal: S.cal, pro: S.pro, ideas: S.ideas, mode: S.mode }).catch(() => {});
  const saveCustomDeals = () => Store.set('customDeals', S.customDeals);
  async function reloadMeals() { S.meals = (await Store.meals()).map(normalizeMeal).sort((a, b) => (b.date + (b.loggedAt || '')).localeCompare(a.date + (a.loggedAt || ''))); }

  // ---------- order helpers ----------
  const mealsOn = (d) => S.meals.filter((m) => m.date === d);
  function addKey(key, qty = 1, label) {
    if (!E.resolve(key)) return;
    S.cart.set(key, (S.cart.get(key) || 0) + qty);
    saveCartSoon(); flash(`Added ${label || E.resolve(key).name}`);
    renderOrderBits();
  }
  const addItem = (id, mode) => { const it = E.byId(id); addKey(E.itemKey(id, mode || S.mode), 1, `${it.chain} ${it.name}`); };
  let flashTimer;
  function flash(msg, err, action) {
    const f = $('flash'); f.replaceChildren(msg); f.classList.toggle('err', !!err);
    if (action) { const b = el('button', 'linkish', action.label); b.type = 'button'; b.style.marginLeft = '10px'; b.addEventListener('click', () => { clearTimeout(flashTimer); f.textContent = ''; action.fn(); }); f.append(b); }
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { f.textContent = ''; }, err ? 6000 : action ? 9000 : 2600);
    const cb = $('cartbar-sum'); if (cb && S.tab !== 'order') cb.dataset.flash = msg;
  }
  function renderOrderBits() { renderGrid(); renderTicket(); renderScatter(); renderCartbar(); }

  // ---------- chips ----------
  function chainChips(box, value, allLabel, multi) {
    box.replaceChildren();
    for (const c of ['All', ...E.CHAINS]) {
      const b = el('button', 'chip'); b.type = 'button'; b.dataset.v = c;
      const on = multi ? (c === 'All' ? !value.length : value.includes(c)) : value === c;
      b.setAttribute('aria-pressed', String(on));
      if (c !== 'All') { const d = el('i', 'dot'); d.style.setProperty('--cc', cvar(c)); b.append(d); }
      b.append(c === 'All' ? allLabel : c); box.append(b);
    }
  }
  const sync = (id, v) => $(id).querySelectorAll('button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  function catChips() {
    const box = $('f-cat'); box.replaceChildren();
    const labels = { All: 'All types', More: 'Fish, veggie & more' };
    for (const c of ['All', ...E.CATS]) { const b = el('button', 'chip', labels[c] || c); b.type = 'button'; b.dataset.v = c; b.setAttribute('aria-pressed', String(S.cat === c)); box.append(b); }
  }

  // ---------- browse ----------
  const view = (it) => E.macros(it, S.mode);
  const pd = (it) => { const pr = E.priceOf(it); return pr ? view(it).p / pr : null; };
  function visibleItems() {
    const q = S.q.trim().toLowerCase();
    const rows = E.items.filter((r) => (S.chain === 'All' || r.chain === S.chain) && (S.cat === 'All' || r.cat === S.cat) && (!q || (r.name + ' ' + r.chain + ' ' + r.cat).toLowerCase().includes(q)));
    const cmp = {
      p100: (a, b) => p100(view(b)) - p100(view(a)) || view(a).cal - view(b).cal,
      pd: (a, b) => (pd(b) ?? -1) - (pd(a) ?? -1) || view(a).cal - view(b).cal,
      p: (a, b) => view(b).p - view(a).p || view(a).cal - view(b).cal,
      cal: (a, b) => view(a).cal - view(b).cal || view(b).p - view(a).p,
      price: (a, b) => (E.priceOf(a) ?? 1e9) - (E.priceOf(b) ?? 1e9) || view(b).p - view(a).p,
      name: (a, b) => a.name.localeCompare(b.name) || E.CHAINS.indexOf(a.chain) - E.CHAINS.indexOf(b.chain),
    }[S.sort];
    return rows.sort(cmp);
  }
  const inCart = (it) => { let n = 0; for (const [k, q] of S.cart) if (k.startsWith(`i|${it.id}|`)) n += q; return n; };
  function priceRow(it) {
    const box = el('div', 'price'); const pr = E.priceOf(it);
    if (pr != null) {
      box.append(el('b', '', fmt$(pr)));
      if (E.isMine(it)) box.append(el('span', 'tag mine', 'your price'));
      else if (E.isApprox(it)) { const t = el('span', 'tag', 'approx.'); t.title = 'App-only chain: price from third-party menu guides'; box.append(t); }
      const v = view(it).p / pr; box.append(el('span', 'pv' + (v >= 4.5 ? ' hi' : ''), `${fmt1(v)} g P/$`), el('span', 'pv', `${fmtC(view(it).cal / pr)} cal/$`));
    } else {
      box.append(el('span', '', 'No price yet'));
      const lk = el('button', 'linkish', 'Add yours'); lk.type = 'button'; lk.dataset.pid = it.id; lk.setAttribute('aria-label', `Add a price for ${it.chain} ${it.name}`); box.append(lk);
    }
    return box;
  }
  function renderGrid() {
    const rows = visibleItems();
    const box = $('items'); box.replaceChildren();
    const take = $('takeaway'); take.replaceChildren();
    const mains = rows.filter((r) => E.MAIN_CATS.has(r.cat) || r.cat === 'Salads');
    if (mains.length) {
      const best = mains.slice().sort((a, b) => p100(view(b)) - p100(view(a)))[0];
      take.append(S.mode === 'ns' ? 'Ordered without sauce, the ' : 'As served, the ', el('b', '', `${best.chain} ${best.name}`), ` gives the most protein for the calories here: ${fmt1(p100(view(best)))} g per 100 cal.`);
      const priced = mains.filter((r) => pd(r) != null);
      if (priced.length) { const bv = priced.slice().sort((a, b) => pd(b) - pd(a))[0]; if (bv.id === best.id) take.append(` It's also the best protein for your money: ${fmt1(pd(bv))} g per dollar.`); else take.append(' For your money it’s the ', el('b', '', `${bv.chain} ${bv.name}`), `: ${fmt1(pd(bv))} g protein per dollar at ${fmt$(E.priceOf(bv))}.`); }
    }
    take.append(el('span', '', ` ${rows.length} item${rows.length === 1 ? '' : 's'}.`));
    if (!rows.length) { box.append(el('p', 'empty-note', 'Nothing on the menu matches these filters.')); $('more-items').hidden = true; return; }
    for (const r of rows.slice(0, S.page)) {
      const q = inCart(r); const m = view(r);
      const card = el('article', 'item' + (q ? ' in' : ''));
      const pic = el('div', 'pic'); pic.innerHTML = PIC(r.pic, cvar(r.chain), `${r.chain} ${r.name}`);
      const head = el('div'); const who = el('div', 'who'); const d = el('i', 'dot'); d.style.setProperty('--cc', cvar(r.chain)); who.append(d, r.chain + ' · ' + r.cat); head.append(who, el('h3', '', r.name));
      const mid = el('div');
      let off = '';
      if (S.mode === 'ns' && r.ns) off = 'Off: ' + r.ns.removed + (r.ns.basis === 'Estimate' ? ' · estimate' : '');
      else if (r.basis === 'Calculated') off = 'Calculated from the chain’s own values';
      if (off || r.note) mid.append(el('div', 'off' + (S.mode === 'ns' && r.ns && r.ns.basis === 'Estimate' ? ' est' : ''), off || r.note));
      const nums = el('div', 'nums'); nums.append(el('span', 'cal', fmtC(m.cal)), 'cal', el('span', 'p', `${fmtN(m.p)} g protein`), `${fmtN(m.f)} F · ${fmtN(m.c)} C`);
      mid.append(nums, priceRow(r));
      const foot = el('div', 'foot');
      foot.append(el('span', 'ratio' + (p100(m) >= 6 ? ' hi' : ''), `${fmt1(p100(m))} P/100 cal`));
      const add = el('button', 'add'); add.type = 'button'; add.dataset.id = r.id; add.setAttribute('aria-label', `Add ${r.chain} ${r.name} to your order`);
      if (q) add.append('+ Add ', el('span', 'n', `(${q})`)); else add.textContent = '+ Add';
      foot.append(add);
      card.append(pic, head, mid, foot); box.append(card);
    }
    const more = $('more-items'); more.hidden = rows.length <= S.page; more.textContent = `Show more (${rows.length - S.page} left)`;
  }

  // ---------- scatter ----------
  const tip = el('div', 'tip'); tip.hidden = true;
  function renderScatter() {
    const box = $('scatter'); box.replaceChildren();
    const lg = $('legend'); lg.replaceChildren();
    const byPrice = S.xAxis === 'price'; sync('f-x', S.xAxis);
    $('cmp-title').textContent = byPrice ? 'Price vs protein' : 'Calories vs protein';
    const all = visibleItems().filter((r) => E.MAIN_CATS.has(r.cat) || r.cat === 'Salads' || r.cat === 'Breakfast');
    const rows = byPrice ? all.filter((r) => E.priceOf(r) != null) : all;
    const skipped = all.length - rows.length;
    $('cmp-sub').textContent = (byPrice ? 'Higher and further left gives more protein for less money. Prices are before tax.' : 'Higher and further left gives more protein for fewer calories.') + ' Hover or tap a dot for details; click it, or tap it twice, to add it.' + (byPrice && skipped ? ` ${skipped} item${skipped > 1 ? 's' : ''} with no price ${skipped > 1 ? 'are' : 'is'} left off.` : '');
    const SHAPE = { "McDonald's": d3.symbolCircle, "Wendy's": d3.symbolSquare, "Harvey's": d3.symbolTriangle, 'A&W': d3.symbolDiamond, 'Burger King': d3.symbolWye };
    for (const c of (S.chain === 'All' ? E.CHAINS : [S.chain])) { const s = el('span'); const k = d3.create('svg').attr('viewBox', '-7 -7 14 14').attr('aria-hidden', 'true'); k.append('path').attr('d', d3.symbol().type(SHAPE[c]).size(70)()).style('fill', cvar(c)); s.append(k.node(), c); lg.append(s); }
    if (!rows.length) { box.append(el('p', 'empty-note', 'Nothing to plot for these filters.')); return; }
    const xv = (d) => (byPrice ? E.priceOf(d) : view(d).cal);
    const W = Math.max(300, box.clientWidth || 600), H = 280;
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', byPrice ? 'Price against protein' : 'Calories against protein');
    box.append(svg.node());
    const y = d3.scaleLinear([0, d3.max(rows, (d) => view(d).p) * 1.12], [H - 30, 12]).nice(); const yt = y.ticks(5);
    const meas = svg.append('g').style('font', '12px var(--body)'); let wMax = 0; for (const t of yt) wMax = Math.max(wMax, meas.append('text').text(t).node().getComputedTextLength()); meas.remove();
    const left = Math.ceil(wMax) + 12;
    const x = d3.scaleLinear([0, d3.max(rows, xv) * 1.06], [left, W - 12]).nice();
    const g = svg.append('g').style('font', '12px var(--body)');
    g.selectAll('.gl').data(yt).join('line').attr('x1', left).attr('x2', W - 12).attr('y1', (d) => y(d)).attr('y2', (d) => y(d)).style('stroke', 'var(--line)');
    g.selectAll('.yl').data(yt).join('text').attr('x', left - 7).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text((d) => d);
    g.selectAll('.xl').data(x.ticks(W < 460 ? 4 : 6)).join('text').attr('x', (d) => x(d)).attr('y', H - 10).attr('text-anchor', 'middle').style('fill', 'var(--ink-2)').text((d) => (byPrice ? '$' + d : d3.format(',')(d)));
    g.append('text').attr('x', W - 12).attr('y', H - 24).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text(byPrice ? 'price before tax' : 'calories');
    g.append('text').attr('x', left + 6).attr('y', 14).style('fill', 'var(--ink-2)').text('protein (g)');
    const ins = (d) => inCart(d) > 0;
    g.selectAll('path.pt').data(rows).join('path').attr('class', 'pt').attr('transform', (d) => `translate(${x(xv(d))},${y(view(d).p)})`)
      .attr('d', (d) => d3.symbol().type(SHAPE[d.chain]).size(ins(d) ? 170 : 80)()).style('fill', (d) => cvar(d.chain)).attr('fill-opacity', 0.85)
      .style('stroke', (d) => (ins(d) ? 'var(--ink)' : 'var(--surface)')).attr('stroke-width', (d) => (ins(d) ? 2 : 1));
    box.append(tip);
    const pts = rows.map((d) => [x(xv(d)), y(view(d).p)]); const del = d3.Delaunay.from(pts);
    const near = (ev) => { const [mx, my] = d3.pointer(ev); const i = del.find(mx, my); return Math.hypot(pts[i][0] - mx, pts[i][1] - my) < 36 ? i : -1; };
    const showTip = (i, hint) => {
      const d = rows[i]; const m = view(d); const pr = E.priceOf(d);
      tip.replaceChildren(el('div', 't', d.chain), el('div', '', d.name), el('div', '', `${fmtC(m.cal)} cal · ${fmtN(m.p)} P · ${fmtN(m.f)} F · ${fmtN(m.c)} C`), el('div', 't', pr != null ? `${fmt$(pr)}${E.isApprox(d) ? ' approx.' : ''} · ${fmt1(m.p / pr)} g protein per $` : 'No price yet'));
      if (hint) tip.append(el('div', '', 'Tap it again to add it'));
      tip.hidden = false;
      const sc = box.clientWidth / W; let lx = pts[i][0] * sc + 12; if (lx + tip.offsetWidth > box.clientWidth) lx = pts[i][0] * sc - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, lx) + 'px'; tip.style.top = Math.max(0, pts[i][1] * sc - 12) + 'px';
    };
    let lastType = 'mouse', armed = -1;
    svg.on('pointerdown', (ev) => { lastType = ev.pointerType || 'mouse'; });
    svg.on('pointermove', (ev) => { if (ev.pointerType && ev.pointerType !== 'mouse') return; const i = near(ev); if (i < 0) { tip.hidden = true; return; } showTip(i, false); });
    svg.on('pointerleave', (ev) => { if (!ev.pointerType || ev.pointerType === 'mouse') tip.hidden = true; });
    svg.on('click', (ev) => { const i = near(ev); if (i < 0) { armed = -1; tip.hidden = true; return; } if (lastType === 'mouse' || armed === i) { armed = -1; addItem(rows[i].id); return; } armed = i; showTip(i, true); });
  }

  // ---------- ticket ----------
  function stepper(kind, key, label, value, unit) {
    const s = el('span', 'stepper');
    const dec = el('button', '', '−'); dec.type = 'button'; dec.dataset.act = 'dec'; dec.dataset.kind = kind; dec.dataset.key = key; dec.setAttribute('aria-label', `One less ${label}`);
    const inc = el('button', '', '+'); inc.type = 'button'; inc.dataset.act = 'inc'; inc.dataset.kind = kind; inc.dataset.key = key; inc.setAttribute('aria-label', `One more ${label}`);
    s.append(dec, el('span', '', unit ? `${value} ${unit}` : String(value)), inc); return s;
  }
  function partsSummary(parts) {
    const n = new Map(); for (const p of parts) n.set(p.name, (n.get(p.name) || 0) + 1);
    return [...n].map(([nm, q]) => (q > 1 ? `${q}× ${nm}` : nm)).join(' + ');
  }
  function renderTicket() {
    const logDate = $('log-date'); if (!logDate.value) logDate.value = today();
    $('t-date').textContent = niceDay(logDate.value);
    const lines = $('lines'); lines.replaceChildren();
    for (const [k, q] of S.cart) {
      const L = E.resolve(k); if (!L) continue;
      const row = el('div', 'line');
      const pic = el('div', 'pic'); const pics = L.kind === 'deal' ? L.parts[0] : L.item; pic.innerHTML = PIC(pics.pic, cvar(L.chain), L.name);
      const nm = el('div', 'nm'); const sub = el('span'); const d = el('i', 'dot'); d.style.setProperty('--cc', cvar(L.chain));
      if (L.kind === 'deal') { nm.append(el('b', '', `${L.deal.title}`)); sub.append(d, `${L.chain} deal · ${partsSummary(L.parts)}${L.noSauce ? ' · no sauce' : ''}`); }
      else { nm.append(el('b', '', L.name)); sub.append(d, L.chain + (L.noSauce ? ' · no sauce' : '')); }
      nm.append(sub);
      const amt = el('div', 'amt'); amt.append(el('b', '', fmtC(L.cal * q)), ' cal', el('br'), `${fmtN(L.p * q)} g P`, el('br'), L.price != null ? `${L.approx ? '≈' : ''}${fmt$(L.price * q)}` : 'no price');
      row.append(pic, nm, stepper('line', k, L.name, q), amt); lines.append(row);
    }
    if (!S.cart.size) lines.append(el('p', 'empty', 'Your order is empty. Tap + Add on anything, or add a deal or a meal idea.'));
    const sb = $('sauces'); sb.replaceChildren();
    for (const s of E.sauces) {
      const row = el('div', 'sauce-row'); const pic = el('div', 'pic'); pic.innerHTML = PIC(s.pic, 'var(--ink-2)', s.name);
      const nm = el('div', 'nm', s.name); nm.append(el('small', '', `${s.cal} cal per tbsp`));
      row.append(pic, nm, stepper('sauce', s.key, s.name, S.sauce[s.key] || 0, 'tbsp')); sb.append(row);
    }
    const t = E.totals(S.cart, S.sauce); const has = t.cal > 0;
    $('tt-cal').textContent = fmtC(t.cal); $('tt-p').textContent = fmtN(t.p); $('tt-f').textContent = fmtN(t.f); $('tt-c').textContent = fmtN(t.c);
    const e = 4 * t.p + 9 * t.f + 4 * t.c;
    const pp = has ? Math.round((400 * t.p) / e) : 0, fp = has ? Math.round((900 * t.f) / e) : 0, cp = has ? 100 - pp - fp : 0;
    const seg = $('split').children; seg[0].style.width = pp + '%'; seg[1].style.width = fp + '%'; seg[2].style.width = cp + '%';
    const sl = $('split-legend'); sl.replaceChildren();
    [['Protein', pp, '--m-pro'], ['Fat', fp, '--m-fat'], ['Carbs', cp, '--m-carb']].forEach(([n, v, c]) => { const s = el('span'); const i = el('i'); i.style.background = `var(${c})`; s.append(i, has ? `${v}% ${n.toLowerCase()}` : n); sl.append(s); });
    sl.append(el('span', '', 'of calories'));
    renderMoney(t, has);
    const gradeEl = $('grade'); const st = $('scoretext'); const drag = $('drag');
    gradeEl.className = 'grade'; drag.replaceChildren(); st.replaceChildren();
    if (has) {
      const sc = E.scoreOf(t.p100); const [, L, label] = E.gradeOf(sc);
      gradeEl.textContent = L; gradeEl.classList.add('g' + L);
      st.append(el('b', '', String(sc)), ' / 100 · ', el('span', 'lbl', label), el('br'), `${fmt1(t.p100)} g protein per 100 cal. Better than ${sc}% of ${fmtC(E.curve.length)} one-item fast-food orders.`);
      if (S.cart.size > 1 || (S.cart.size === 1 && E.sauces.some((s) => S.sauce[s.key]))) {
        let best = null;
        for (const [k] of S.cart) { const c2 = new Map(S.cart); c2.delete(k); const t2 = E.totals(c2, S.sauce); if (t2.cal <= 0) continue; const s2 = E.scoreOf(t2.p100); if (s2 > sc && (!best || s2 > best.s2)) best = { k, s2, cal: t.cal - t2.cal }; }
        if (best) { const L2 = E.resolve(best.k); drag.append('Biggest drag: ', el('b', '', `${L2.chain} ${L2.name}`), `. Without it the score goes to ${best.s2} and the order drops ${fmtC(best.cal)} cal.`); }
      }
    } else { gradeEl.textContent = '–'; st.textContent = 'Add items to see the cheat-meal score.'; }
    renderCurve(has ? t.p100 : null);
    renderDay(t, has);
    $('log-btn').disabled = !has; $('clear-btn').disabled = !has;
  }
  function renderMoney(t, has) {
    const box = $('money'); box.replaceChildren();
    const row = (label, val, big) => { const r = el('div', 'mrow' + (big ? ' big' : '')); r.append(el('span', '', label), el('b', '', val)); return r; };
    if (!has || (t.price <= 0 && !t.unpriced.length)) { box.append(row('Order total, before tax', '$0.00', true)); return; }
    box.append(row('Order total, before tax', t.price > 0 ? `${t.approx.size ? '≈ ' : ''}${fmt$(t.price)}` : '—', true));
    if (t.price > 0) box.append(row('Protein per dollar', `${fmt1(t.pricedP / t.price)} g`), row('Calories per dollar', fmtC(t.pricedCal / t.price)), row('Cost per 10 g protein', t.pricedP > 0 ? fmt$((t.price / t.pricedP) * 10) : '—'));
    const deals = t.lines.filter(([L]) => L.kind === 'deal' && L.regular != null && L.regular > L.price);
    if (deals.length) { const saved = deals.reduce((a, [L, q]) => a + (L.regular - L.price) * q, 0); box.append(el('p', 'mnote save', `Deals save you ${fmt$(saved)} against regular prices.`)); }
    if (t.approx.size) box.append(el('p', 'mnote', `${[...t.approx].join(' and ')} price${t.approx.size > 1 ? 's are' : ' is'} approximate (app-only chain).`));
    if (t.unpriced.length) {
      const names = [...new Set(t.unpriced.map((L) => L.name))]; const p = el('p', 'mnote');
      p.append(`No price yet for ${names.join(', ')}, so ${names.length > 1 ? 'they’re' : 'it’s'} left out of the total. `);
      const first = t.unpriced.find((L) => L.kind === 'item');
      if (first) { const lk = el('button', 'linkish', 'Add a price'); lk.type = 'button'; lk.dataset.pid = first.item.id; p.append(lk); }
      box.append(p);
    }
  }
  function renderCurve(v) {
    const box = $('curve'); box.replaceChildren(); const C = E.curve; if (!C.length) return;
    const W = Math.max(260, box.clientWidth || 340), H = 74; const maxV = Math.ceil(d3.max(C)) + 0.5;
    const x = d3.scaleLinear([0, maxV], [4, W - 4]); const bins = d3.bin().domain([0, maxV]).thresholds(d3.range(0, maxV, 0.5))(C);
    const y = d3.scaleLinear([0, d3.max(bins, (b) => b.length)], [H - 18, 14]);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Where this order lands among fast-food orders'); box.append(svg.node());
    const inBin = (b) => v != null && v >= b.x0 && v < b.x1;
    svg.selectAll('rect').data(bins).join('rect').attr('x', (b) => x(b.x0) + 1).attr('width', (b) => Math.max(1, x(b.x1) - x(b.x0) - 2)).attr('y', (b) => y(b.length)).attr('height', (b) => y(0) - y(b.length)).attr('rx', 2).style('fill', (b) => (inBin(b) ? 'var(--accent)' : 'var(--line)'));
    svg.selectAll('text.t').data(d3.range(0, maxV, 2)).join('text').attr('x', (d) => x(d)).attr('y', H - 4).attr('text-anchor', 'middle').style('fill', 'var(--ink-2)').style('font', '11px var(--mono)').text((d) => d);
    svg.append('text').attr('x', W - 4).attr('y', H - 4).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').style('font', '11px var(--mono)').text('g P / 100 cal');
    if (v != null) { const cx = x(Math.min(v, maxV)); svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', 12).attr('y2', y(0)).style('stroke', 'var(--ink)').attr('stroke-width', 2).attr('stroke-linecap', 'round'); const lab = svg.append('text').attr('y', 9).style('fill', 'var(--ink)').style('font', '11px var(--mono)').text('this order'); const lw = lab.node().getComputedTextLength(); lab.attr('x', Math.min(Math.max(cx - lw / 2, 0), W - lw)); }
  }
  function renderDay(t, has) {
    const box = $('day'); box.replaceChildren();
    const day = $('log-date').value || today(); const logged = mealsOn(day);
    const lc = logged.reduce((a, m) => a + (m.totals?.cal || 0), 0), lp = logged.reduce((a, m) => a + (m.totals?.p || 0), 0);
    box.append(el('h3', '', `Against your day · ${niceDay(day)}`));
    if (logged.length) box.append(el('div', 'scoretext', `Already logged that day: ${logged.length} meal${logged.length > 1 ? 's' : ''}, ${fmtC(lc)} cal, ${fmtN(lp)} g protein.`));
    const bar = (label, a, b, target, unit, overBad) => {
      const r = el('div', 'bar-row'); r.append(el('div', 'lb', label));
      const tr = el('div', 'track'); const total = a + b; const scale = Math.max(target, total) || 1;
      const i1 = el('i'); i1.style.width = (a / scale) * 100 + '%'; i1.style.background = 'var(--ink-2)';
      const i2 = el('i'); i2.style.width = (b / scale) * 100 + '%'; i2.style.background = overBad && total > target ? 'var(--bad)' : unit === 'g' ? 'var(--m-pro)' : 'var(--accent)';
      tr.append(i1, i2); r.append(tr);
      const tx = el('div', 'tx'); tx.append(`${Math.round((total / target) * 100)}% of ${fmtC(target)}${unit === 'g' ? ' g' : ''} · `);
      if (overBad && total > target) tx.append(el('span', 'bad', `${fmtC(total - target)} cal over`));
      else if (!overBad && total >= target) tx.append(el('span', 'ok', 'target hit'));
      else tx.append(unit === 'g' ? `${fmtN(target - total)} g still to get` : `${fmtC(target - total)} cal left`);
      r.append(tx); return r;
    };
    box.append(bar('Calories', lc, has ? t.cal : 0, S.cal, 'cal', true), bar('Protein', lp, has ? t.p : 0, S.pro, 'g', false));
  }
  function renderCartbar() {
    const bar = $('cartbar'); const t = E.totals(S.cart, S.sauce); const has = t.cal > 0;
    const show = has && ['order', 'deals', 'ideas'].includes(S.tab);
    bar.hidden = !show; bar.classList.toggle('order-only', S.tab === 'order');
    if (!show) return;
    const s = $('cartbar-sum'); s.replaceChildren();
    s.append(el('b', '', `${t.n} item${t.n === 1 ? '' : 's'}`), ` · ${fmtC(t.cal)} cal · ${fmtN(t.p)} g P${t.price > 0 ? ` · ${t.approx.size ? '≈' : ''}${fmt$(t.price)}` : ''} · score `, el('b', '', String(E.scoreOf(t.p100))));
  }

  // ---------- deals ----------
  function dealCard(d, mine) {
    const picks = S.dealPick[d.id] || d.slots.map(() => 0);
    const ids = E.dealPicks(d, picks); const parts = ids.map((id) => E.byId(id)).filter(Boolean);
    const mode = S.mode; const L = E.resolve(E.dealKey(d.id, mode, ids));
    const card = el('article', 'card'); const expired = d.expires && d.expires < today();
    if (expired) card.style.opacity = '.6';
    const head = el('header'); const t = el('div'); const who = el('div', 'who'); const dot = el('i', 'dot'); dot.style.setProperty('--cc', cvar(d.chain)); who.append(dot, d.chain + ' ');
    const kinds = { app: ['app', 'App offer'], mailer: ['mailer', 'Mailer coupon'], limited: ['deal', 'Limited time'], everyday: ['deal', 'Everyday deal'] };
    const [bc, bl] = mine ? ['deal', 'Your deal'] : (kinds[d.kind] || kinds.everyday);
    who.append(el('span', 'badge ' + bc, bl));
    if (d.unconfirmed) { const ck = el('span', 'badge verify', 'Check your mailer'); ck.title = 'Seen in another region’s mailer. Niagara’s copy may differ, so it stays out of meal ideas.'; who.append(' ', ck); }
    t.append(who, el('h3', '', d.title)); head.append(t);
    const pr = el('div', 'big-price', d.price === 0 ? 'Free' : fmt$(d.price)); if (d.approx) pr.append(el('small', '', 'approx.'));
    if (L && L.regular != null && L.regular > d.price) pr.append(el('small', 'save', `save ${fmt$(L.regular - d.price)}`));
    head.append(pr); card.append(head);
    if (d.desc) card.append(el('p', 'desc', d.desc));
    const pics = el('div', 'pics'); for (const it of parts.slice(0, 5)) { const sp = el('span'); sp.innerHTML = PIC(it.pic, cvar(it.chain), it.name); pics.append(sp); } card.append(pics);
    const multi = d.slots.some((s) => s.choices.length > 1);
    if (multi) {
      const sp = el('div', 'slot-pick');
      d.slots.forEach((s, i) => { if (s.choices.length < 2) return; const sel = el('select'); sel.dataset.deal = d.id; sel.dataset.slot = i; sel.setAttribute('aria-label', `Choice ${i + 1} for ${d.title}`);
        s.choices.forEach((cid, ci) => { const it = E.byId(cid); if (!it) return; const o = el('option', '', `${s.qty > 1 ? s.qty + '× ' : ''}${it.name} · ${fmtC(E.macros(it, mode).cal * (s.qty || 1))} cal, ${fmtN(E.macros(it, mode).p * (s.qty || 1))} g P`); o.value = ci; if (ci === (picks[i] || 0)) o.selected = true; sel.append(o); });
        sp.append(sel); });
      card.append(sp);
    } else if (parts.length) card.append(el('p', 'desc', partsSummary(parts)));
    if (L) {
      const kv = el('div', 'kv'); const sc = E.scoreOf(p100(L)); const g = E.gradeOf(sc);
      kv.append(el('b', '', `${fmtC(L.cal)} cal`), el('span', '', `${fmtN(L.p)} g protein`), el('span', '', `${fmt1(p100(L))} P/100 cal`));
      if (d.price > 0) kv.append(el('span', '', `${fmt1(L.p / d.price)} g P/$`));
      const pill = el('span', 'pill g' + g[1], `${g[1]} · ${sc}`); kv.append(pill);
      card.append(kv);
    }
    if (d.extras) card.append(el('p', 'meta', d.extras));
    const meta = el('p', 'meta'); meta.append(d.how ? d.how + ' ' : '');
    if (d.expires) meta.append(expired ? `Ended ${niceDay(d.expires)}. ` : `Ends ${niceDay(d.expires)}. `);
    if (d.url) { const a = el('a', '', d.source || 'Source'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; meta.append(a); } else if (d.source) meta.append(d.source);
    if (d.verified) meta.append(` · checked ${niceDay(d.verified)}`);
    card.append(meta);
    const acts = el('div', 'acts');
    const add = el('button', 'btn accent', 'Add to order'); add.type = 'button'; add.dataset.adddeal = d.id; add.disabled = !L || expired; acts.append(add);
    if (mine) { const del = el('button', 'btn ghost', 'Delete'); del.type = 'button'; del.dataset.deldeal = d.id; acts.append(del); }
    card.append(acts);
    return card;
  }
  function renderDeals() {
    const df = S.dealsFile || {};
    const info = $('deals-info'); info.replaceChildren();
    info.append(el('b', '', `Updated ${df.updated ? niceDay(df.updated, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}`), ` · ${df.region || 'Ontario'}. `, df.note || '');
    chainChips($('d-chain'), S.dealChain, 'All restaurants');
    const box = $('deal-cards'); box.replaceChildren();
    const list = (df.deals || []).filter((d) => S.dealChain === 'All' || d.chain === S.dealChain);
    if (!list.length) box.append(el('p', 'empty-note', 'No listed deals for this restaurant right now. Check its app and add what you find below.'));
    for (const d of list) box.append(dealCard(d, false));
    const mine = $('my-deals'); mine.replaceChildren();
    const myList = S.customDeals.filter((d) => S.dealChain === 'All' || d.chain === S.dealChain);
    if (!myList.length) mine.append(el('p', 'empty-note', 'No deals added yet.'));
    for (const d of myList) mine.append(dealCard(d, true));
  }
  function renderDealForm() {
    const cs = $('df-chain'); if (!cs.options.length) for (const c of E.CHAINS) { const o = el('option', '', c); o.value = c; cs.append(o); }
    const chain = cs.value || E.CHAINS[0]; const is = $('df-item'); is.replaceChildren();
    for (const cat of E.CATS) { const grp = el('optgroup'); grp.label = cat; for (const it of E.items.filter((i) => i.chain === chain && i.cat === cat).sort((a, b) => a.name.localeCompare(b.name))) { const o = el('option', '', it.name); o.value = it.id; grp.append(o); } if (grp.children.length) is.append(grp); }
    const ul = $('df-picked'); ul.replaceChildren();
    S.dfItems.forEach((x, i) => { const it = E.byId(x.id); const li = el('li'); li.append(`${x.qty}× ${it.name}`); const b = el('button', 'linkish', 'Remove'); b.type = 'button'; b.dataset.rm = i; li.append(b); ul.append(li); });
  }

  // ---------- ideas ----------
  function leftToday() { const lc = mealsOn(today()).reduce((a, m) => a + (m.totals?.cal || 0), 0); return Math.round((S.cal - lc) / 10) * 10; }
  // ---------- Bob's Top 5s and Big Back Bob ----------
  const BIG_BACK_BOB = [
    [{ chain: "Wendy's", ids: ['wen-strips3', 'wen-dave2', 'wen-fries-s'] }],
    [{ chain: "McDonald's", ids: ['mcd-mcdouble-xp', 'mcd-fries-s'] }, { chain: "Wendy's", ids: ['wen-spicy', 'wen-nug6'] }],
    [{ chain: "Harvey's", ids: ['har-crispy', 'har-rings-r'] }, { chain: "Wendy's", ids: ['wen-dave2-nc', 'wen-nug6'] }],
  ];
  const perG = (x) => (x.price != null && x.p > 0 ? x.price / x.p : null);
  const cents = (v) => `${(v * 100).toFixed(1)}¢`;
  function bobRow(x, i, list) {
    const li = el('li', 't5'); li.append(el('div', 't5-rank', String(i + 1)));
    const body = el('div'); const who = el('div', 'who');
    for (const c of x.chains) { const dot = el('i', 'dot'); dot.style.setProperty('--cc', cvar(c)); who.append(dot); }
    who.append(x.chains.join(' + ')); body.append(who);
    x.groups.forEach((g, gi) => {
      const it = el('div', 't5-items'); if (x.stops > 1) it.append(el('span', 'stop-label', `Stop ${gi + 1} · ${g.chain}`));
      it.append(partsSummary(g.parts));
      for (const d of g.deals) { it.append(' '); it.append(el('span', 'badge ' + (d.kind === 'app' ? 'app' : 'deal'), `${d.title} ${fmt$(d.price)}`)); }
      body.append(it);
    });
    const mac = el('div', 't5-mac'); mac.append(el('b', '', `${fmtC(x.cal)} cal`), ` · ${fmtN(x.p)} g protein · ${fmtN(x.f)} g fat · ${fmtN(x.c)} g carbs`); body.append(mac);
    const key = el('div', 't5-key'); const g = perG(x);
    key.append(el('b', '', x.price == null ? 'price not listed' : `${x.approx ? '≈' : ''}${fmt$(x.price)}`), ' · ', el('b', '', g == null ? '— per g protein' : `${cents(g)} per g protein`), ' · ', el('b', '', `${fmt1(x.p100)} g protein per 100 cal`));
    body.append(key);
    const b = x.bob;
    if (x.price != null) body.append(el('div', 't5-why', `value ${b.value} · protein/cal ${b.lean} · lightness ${b.light}`));
    else { const un = [...new Set(x.unpriced.map((p) => p.name))]; body.append(el('div', 't5-why', `No price yet for ${un.join(', ')}. Add what you pay under More → Prices to score this order.`)); }
    li.append(body);
    const side = el('div', 't5-side'); const sc = el('div', 't5-score', x.price == null ? '–' : String(b.score)); sc.prepend(el('small', '', 'Bob score')); side.append(sc);
    const add = el('button', 'add', 'Add'); add.type = 'button'; add.dataset.t5 = `${list}:${i}`; add.setAttribute('aria-label', `Add ${x.groups.map((gr) => gr.chain + ' ' + partsSummary(gr.parts)).join(' and ')} to your order`); side.append(add);
    li.append(side); return li;
  }
  function renderTop5() {
    const r = E.topFives({ mode: 'ns' });
    const bbb = BIG_BACK_BOB.map((o) => E.bobOrder(o, 'ns'));
    S.lastTop5 = { one: r.one, two: r.two, bbb };
    const sub = $('top5-sub'); sub.replaceChildren();
    sub.append('Fast-food meals that hit the craving without blowing the day: ', el('b', '', 'two or more items from one restaurant'), ', or ', el('b', '', 'a chicken item from one place and a burger from another'), `. Ranked on value (price per gram of protein) and health (protein per 100 cal, and lighter orders score higher). Orders run ${fmtC(r.cal.min)} to ${fmtC(r.cal.max)} cal with at least ${r.minP} g protein, ordered without sauce, with current deals counted. No triple-patty burgers, grilled chicken, lettuce wraps, veggie burgers, chili, sides or salads.`);
    for (const k of ['one', 'two']) { const ol = $('t5-' + k); ol.replaceChildren(); r[k].forEach((x, i) => ol.append(bobRow(x, i, k))); if (!r[k].length) ol.append(el('li', 'empty-note', 'Nothing fits right now.')); }
    const take = $('t5-take'); take.replaceChildren();
    const o = r.one[0], t = r.two[0];
    if (o && t) {
      const d = t.bob.score - o.bob.score;
      take.append(el('b', '', d > 0 ? `Two stops wins by ${d} point${d === 1 ? '' : 's'}. ` : d === 0 ? 'Two stops ties one stop. ' : `One stop wins by ${-d} point${d === -1 ? '' : 's'}. `),
        d > 0 ? 'Splitting the order gets you a better deal on protein than any single counter.' : 'A second stop doesn’t get you cheaper or leaner protein, so stick to one counter unless you’re passing both anyway.');
    }
    if ([...r.one, ...r.two].some((x) => x.parts.some((p) => p.ns && p.ns.basis === 'Estimate'))) take.append(' A&W’s no-sauce numbers are estimates.');
    const how = $('t5-how'); how.replaceChildren();
    for (const line of [
      ['Value (40%)', ': price per gram of protein for the whole order. 50\u00a2 a gram scores 0, 14\u00a2 a gram scores 100.'],
      ['Protein per 100 cal (35%)', ': total protein over total calories. 3 g scores 0, 10 g scores 100.'],
      ['Lightness (25%)', `: ${fmtC(r.cal.full)} cal or less scores 100, sliding to 0 at ${fmtC(r.cal.max)} cal.`],
      ['One restaurant', ': two or three items, at least two of them different, with a burger or chicken sandwich in the mix.'],
      ['Two restaurants', ': one chicken item (a sandwich, strips or nuggets with at least 15 g protein) from one place and one beef burger from another.'],
      ['What counts', `: burgers, chicken sandwiches (not grilled), strips and nuggets; ${fmtC(r.cal.min)}\u2013${fmtC(r.cal.max)} cal and ${r.minP} g protein or more. Triple-patty burgers are out, and items without a listed price, like McNuggets, can\u2019t be ranked until you add a price.`],
      ['Variety', ': at most two orders per restaurant (one per pair of restaurants), with near-copies skipped. Ties go to the lighter order.'],
    ]) { const li = el('li'); li.append(el('b', '', line[0]), line[1]); how.append(li); }
    // Big Back Bob
    const bl = $('bbb-list'); bl.replaceChildren(); bbb.forEach((x, i) => bl.append(bobRow(x, i, 'bbb')));
    const bt = $('bbb-take'); bt.replaceChildren();
    const priced = bbb.filter((x) => x.price != null);
    if (priced.length && o) {
      const gs = priced.map(perG), ps = bbb.map((x) => x.p100);
      const rng = (a, f) => { const lo2 = Math.min(...a), hi2 = Math.max(...a); return lo2 === hi2 ? f(lo2) : `${f(lo2)}–${f(hi2)}`; };
      const cs = bbb.map((x) => x.cal);
      bt.append(`These run ${rng(cs, fmtC)} cal at ${rng(gs, cents)} per gram of protein and ${rng(ps, fmt1)} g protein per 100 cal, against `, el('b', '', `${fmtC(o.cal)} cal at ${cents(perG(o))} and ${fmt1(o.p100)}`), ` for the top pick (${o.chain} ${partsSummary(o.parts)}).`);
    }
  }

  function renderIdeas() {
    renderTop5();
    const I = S.ideas; const left = leftToday();
    if (I.budget == null) I.budget = 1000;
    if (!I.stops) I.stops = 1;
    const box = $('i-budget'); box.replaceChildren();
    const opts = [];
    if (left >= 300) opts.push(['left', `Left today · ${fmtC(left)} cal`]);
    for (const v of [700, 1000, 1300]) opts.push([v, `${v} cal`]);
    for (const [v, lab] of opts) { const b = el('button', 'chip', lab); b.type = 'button'; b.dataset.v = String(v); b.setAttribute('aria-pressed', String(String(I.budget) === String(v))); box.append(b); }
    const custom = el('input', 'inp'); custom.type = 'number'; custom.inputMode = 'numeric'; custom.min = '200'; custom.max = '3000'; custom.step = '50'; custom.placeholder = 'Custom'; custom.id = 'i-custom'; custom.setAttribute('aria-label', 'Custom calorie budget');
    if (typeof I.budget === 'number' && ![700, 1000, 1300].includes(I.budget)) custom.value = I.budget;
    box.append(custom);
    sync('i-priority', I.priority); sync('i-stops', String(I.stops));
    chainChips($('i-chain'), I.chains, 'All restaurants', true);
    $('i-deals').checked = I.deals; $('i-breakfast').checked = I.breakfast; $('i-ns').checked = I.ns; $('i-fries').checked = !!I.fries;
    const budget = I.budget === 'left' ? left : I.budget;
    const mode = I.ns ? 'ns' : 'full';
    const base = { budget, minCal: Math.max(250, budget * 0.45), priority: I.priority, chains: I.chains, mode, includeDeals: I.deals && !I.fries, includeBreakfast: I.breakfast, withFries: !!I.fries, pTarget: Math.round(S.pro / 3) };
    const res = E.ideas({ ...base, stops: I.stops, limit: 10 });
    const take = $('ideas-take'); take.replaceChildren();
    const cards = $('idea-cards'); cards.replaceChildren();
    if (!res.length) { take.textContent = `Nothing fits in ${fmtC(budget)} cal with these filters. Try a bigger budget or more restaurants.`; return; }
    const lbl = { balanced: 'combo score', lean: 'most protein per calorie', value: 'most protein per dollar' }[I.priority];
    take.append(`The best ${res.length} meals that fit in `, el('b', '', `${fmtC(budget)} cal`), `, ranked by ${lbl}${I.fries ? ', each with fries' : ''}${I.ns ? ', ordered without sauce' : ''}. Prices are before tax.`);
    { const old = $('stops-insight'); if (old) old.remove(); }
    if (I.stops !== 1) {
      const one = E.ideas({ ...base, priority: 'balanced', stops: 1, limit: 1 })[0];
      const two = E.ideas({ ...base, priority: 'balanced', stops: 2, limit: 1 })[0];
      if (one && two) {
        const p = el('p', 'info'); const d = two.combo.score - one.combo.score;
        p.append(el('b', '', d > 0 ? `Two stops wins by ${d} point${d === 1 ? '' : 's'}. ` : `One stop still wins${d < 0 ? ` by ${-d} point${d === -1 ? '' : 's'}` : ''}. `),
          `Best single stop: ${one.chain} ${partsSummary(one.parts)} (${fmtC(one.cal)} cal, ${fmtN(one.p)} g protein, ${fmt$(one.price)}, score ${one.combo.score}). `,
          `Best two stops: ${two.groups.map((g) => g.chain + ' ' + partsSummary(g.parts)).join(' + ')} (${fmtC(two.cal)} cal, ${fmtN(two.p)} g protein, ${fmt$(two.price)}, score ${two.combo.score}). `,
          d > 0 ? 'The second stop earns its spot here.' : two.combo.lean > one.combo.lean + 10 ? 'Splitting gets you a leaner meal, but at a higher price per gram of protein.' : 'Splitting doesn’t get you anything you can’t get at one counter.');
        take.after(p); p.id = 'stops-insight';
      }
    }
    res.forEach((x, i) => cards.append(ideaCard(x, i, mode)));
    S.lastIdeas = { res, mode };
  }
  function ideaCard(x, i, mode) {
    const card = el('article', 'card');
    const head = el('header'); const t = el('div'); const who = el('div', 'who');
    for (const c of x.chains) { const dot = el('i', 'dot'); dot.style.setProperty('--cc', cvar(c)); who.append(dot); }
    who.append(`${x.chain} `);
    if (x.stops > 1) who.append(el('span', 'badge app', `${x.stops} stops`));
    for (const g of x.groups) if (g.deal) who.append(el('span', 'badge deal', g.deal.title));
    t.append(who);
    if (x.stops > 1) {
      const stopOf = new Map(); x.groups.forEach((g) => { if (!stopOf.has(g.chain)) stopOf.set(g.chain, stopOf.size + 1); });
      for (const g of x.groups) { const lab = el('span', 'stop-label', `Stop ${stopOf.get(g.chain)} · ${g.chain} · ${g.price === 0 ? 'free' : fmt$(g.price)}`); const line = el('h3', ''); line.style.fontSize = '15px'; line.append(lab, partsSummary(g.parts)); t.append(line); }
    }
    else t.append(el('h3', '', partsSummary(x.parts)));
    head.append(t);
    const pr = el('div', 'big-price', x.price === 0 ? 'Free' : fmt$(x.price));
    if (x.regular != null && x.regular > x.price) pr.append(el('small', 'save', `save ${fmt$(x.regular - x.price)}`));
    else if (x.parts.some((p) => E.isApprox(p)) || x.groups.some((g) => g.deal && g.deal.approx)) pr.append(el('small', '', 'approx.'));
    head.append(pr); card.append(head);
    const pics = el('div', 'pics'); for (const it of x.parts.slice(0, 6)) { const sp = el('span'); sp.innerHTML = PIC(it.pic, cvar(it.chain), it.name); pics.append(sp); } card.append(pics);
    const sc = E.scoreOf(x.p100); const g = E.gradeOf(sc);
    const kv = el('div', 'kv'); kv.append(el('b', '', `${fmtC(x.cal)} cal`), el('span', '', `${fmtN(x.p)} g protein`), el('span', '', `${fmtN(x.f)} F · ${fmtN(x.c)} C`), el('span', '', `${fmt1(x.p100)} P/100 cal`));
    if (x.pd) kv.append(el('span', '', `${fmt1(x.pd)} g P/$`));
    kv.append(el('span', 'pill g' + g[1], `${g[1]} · ${sc}`)); card.append(kv);
    const cs = el('p', 'meta'); cs.append(el('b', '', `Combo score ${x.combo.score}`), ` · leanness ${x.combo.lean} · value ${x.combo.value} · protein ${x.combo.prot}${x.stops > 1 ? ` · −${E.STOP_PENALTY} for the second stop` : ''}`); card.append(cs);
    for (const gr of x.groups) if (gr.deal && gr.deal.extras) card.append(el('p', 'meta', gr.deal.extras));
    if (mode === 'ns' && x.parts.some((p) => p.ns && p.ns.basis === 'Estimate')) card.append(el('p', 'meta', 'No-sauce numbers for A&W are estimates.'));
    const acts = el('div', 'acts'); const b = el('button', 'btn accent', 'Add to order'); b.type = 'button'; b.dataset.idea = i; acts.append(b); card.append(acts);
    return card;
  }

  // ---------- history ----------
  function periodRange() {
    const a = new Date(S.anchor);
    if (S.span === 'week') { const dow = (a.getDay() + 6) % 7; const start = new Date(a.getFullYear(), a.getMonth(), a.getDate() - dow); return [start, new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)]; }
    if (S.span === 'month') return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)];
    if (!S.meals.length) { const t = new Date(); return [t, t]; }
    const ds = S.meals.map((m) => m.date).sort(); return [parseDay(ds[0]), parseDay(ds[ds.length - 1])];
  }
  const periodLabel = ([s, e]) => (S.span === 'week' ? `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : S.span === 'month' ? s.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) : 'All time');
  function topChain(meals) { const n = {}; for (const m of meals) for (const it of (m.items || [])) n[it.chain] = (n[it.chain] || 0) + (it.qty || 1); const b = Object.entries(n).sort((a, c) => c[1] - a[1])[0]; return b ? b[0] : '—'; }
  function renderHistory() {
    const body = $('h-body'); body.replaceChildren();
    sync('h-span', S.span); $('h-prev').disabled = S.span === 'all'; $('h-next').disabled = S.span === 'all';
    const [start, end] = periodRange(); $('h-label').textContent = periodLabel([start, end]);
    if (!S.meals.length) { const d = el('div', 'hist-empty'); d.append(el('b', '', 'No meals logged yet'), 'Build an order, pick the date you ate it and tap Log this meal. If you logged meals in the Claude version, restore them under More.'); body.append(d); return; }
    const s0 = dayStr(start), e0 = dayStr(end);
    const meals = S.meals.filter((m) => S.span === 'all' || (m.date >= s0 && m.date <= e0));
    const tiles = el('div', 'tiles');
    const tile = (k, v, small, s, pill) => { const t = el('div', 'tile'); t.append(el('div', 'k', k)); const vv = el('div', 'v'); vv.append(v); if (pill) vv.append(pill); if (small) vv.append(el('small', '', small)); t.append(vv); if (s) t.append(el('div', 's', s)); return t; };
    const n = meals.length; const avgScore = n ? Math.round(meals.reduce((a, m) => a + (m.score || 0), 0) / n) : null;
    const avgCal = n ? meals.reduce((a, m) => a + (m.totals?.cal || 0), 0) / n : 0, avgP = n ? meals.reduce((a, m) => a + (m.totals?.p || 0), 0) / n : 0;
    const totCal = meals.reduce((a, m) => a + (m.totals?.cal || 0), 0); const best = meals.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const g = avgScore != null ? E.gradeOf(avgScore) : null;
    const priced = meals.filter((m) => m.totals?.price > 0); const spent = priced.reduce((a, m) => a + m.totals.price, 0); const spentP = priced.reduce((a, m) => a + (m.totals.pricedP || 0), 0);
    tiles.append(
      tile('Meals logged', String(n), n === 1 ? 'meal' : 'meals', S.span === 'all' ? 'since you started' : 'in this period'),
      tile('Avg cheat-meal score', avgScore != null ? String(avgScore) : '—', null, g ? g[2] : '', g ? el('span', 'pill g' + g[1], g[1]) : null),
      tile('Avg per meal', n ? fmtC(avgCal) : '—', n ? 'cal' : null, n ? `${fmtN(avgP)} g protein · ${fmtC(totCal)} cal total` : ''),
      tile('Spent', priced.length ? fmt$(spent) : '—', priced.length ? 'before tax' : null, priced.length ? `${fmt$(spent / priced.length)} per meal${spentP > 0 ? ` · ${fmt1(spentP / spent)} g P per $` : ''}` : (n ? 'Meals logged before prices were added have no total' : '')),
      tile('Best meal', best ? String(best.score) : '—', null, best ? `${best.name || 'Meal'} · ${niceDay(best.date)}` : ''),
      tile('Go-to chain', n ? topChain(meals) : '—', null, n ? 'most items ordered' : ''),
    );
    body.append(tiles);
    const grid = el('div', 'hist-grid'); const left = el('div'); const right = el('div');
    const cp = el('div', 'panel'); cp.append(el('h2', '', 'Score by meal'), el('p', 'sub', 'Each dot is a logged meal. The shaded bands are the grades.'));
    const chart = el('div', 'chart'); cp.append(chart); left.append(cp);
    const mp = el('div', 'panel section-gap'); mp.append(el('h2', '', 'By month'), el('p', 'sub', 'Every month you’ve logged a meal.'));
    const tw = el('div', 'tablewrap'); const tb = el('table', 't');
    tb.innerHTML = '<thead><tr><th>Month</th><th>Meals</th><th>Avg score</th><th>Avg cal</th><th>Avg protein</th><th>Spent</th><th>Go-to chain</th></tr></thead>';
    const tbody = el('tbody'); const byMonth = new Map(); for (const m of S.meals) { const k = m.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(m); }
    for (const [mk, ms] of [...byMonth].sort((a, b) => b[0].localeCompare(a[0]))) {
      const tr = el('tr'); const [yy, mm] = mk.split('-').map(Number); const sc = Math.round(ms.reduce((a, m) => a + (m.score || 0), 0) / ms.length); const gg = E.gradeOf(sc);
      const tdS = el('td'); tdS.append(String(sc), ' ', el('span', 'pill g' + gg[1], gg[1]));
      const pm = ms.filter((m) => m.totals?.price > 0);
      tr.append(el('td', '', new Date(yy, mm - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })), el('td', '', String(ms.length)), tdS, el('td', '', fmtC(ms.reduce((a, m) => a + (m.totals?.cal || 0), 0) / ms.length)), el('td', '', fmtN(ms.reduce((a, m) => a + (m.totals?.p || 0), 0) / ms.length) + ' g'), el('td', '', pm.length ? fmt$(pm.reduce((a, m) => a + m.totals.price, 0)) : '—'), el('td', '', topChain(ms)));
      tbody.append(tr);
    }
    tb.append(tbody); tw.append(tb); mp.append(tw); left.append(mp);
    const list = el('div', 'receipts'); if (!meals.length) list.append(el('div', 'hist-empty', 'No meals logged in this period.'));
    for (const m of meals) list.append(receipt(m));
    right.append(list); grid.append(left, right); body.append(grid);
    drawHistChart(chart, meals, start, end);
  }
  function receipt(m) {
    const r = el('article', 'receipt'); const head = el('header');
    const t = el('div', 't'); t.append(el('b', '', m.name || 'Meal'), el('span', '', niceDay(m.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })));
    const g = E.gradeOf(m.score || 0); const sc = el('div'); sc.append(el('span', 'pill g' + g[1], `${g[1]} · ${m.score}`)); head.append(t, sc); r.append(head);
    const ul = el('ul');
    for (const it of (m.items || [])) { const li = el('li'); li.append(el('span', '', `${it.qty}× ${it.deal ? it.deal.title + ' (' + it.name + ')' : it.chain + ' ' + it.name}${(it.mode === 'ns' || it.mode === 'No sauce') && it.removed ? ' (no sauce)' : ''}`), el('span', '', `${fmtC(it.cal * it.qty)} cal${it.price != null ? ' · ' + fmt$(it.price * it.qty) : ''}`)); ul.append(li); }
    for (const s of (m.sauces || [])) { const li = el('li'); li.append(el('span', '', `${s.tbsp} tbsp ${s.name}`), el('span', '', `${fmtC(s.cal * s.tbsp)} cal`)); ul.append(li); }
    r.append(ul);
    const sum = el('div', 'sum'); sum.append(el('b', '', `${fmtC(m.totals.cal)} cal`), `${fmtN(m.totals.p)} g P`, `${fmtN(m.totals.f)} g F`, `${fmtN(m.totals.c)} g C`, `${fmt1(m.p100)} P/100`);
    if (m.totals.price > 0) { sum.append(el('b', '', `${(m.items || []).some((it) => it.approx) ? '≈' : ''}${fmt$(m.totals.price)}`)); if (m.totals.pricedP > 0) sum.append(`${fmt1(m.totals.pricedP / m.totals.price)} g P per $`); }
    r.append(sum);
    const acts = el('div', 'acts');
    if (S.confirmDel === m.id) { const yes = el('button', 'danger', 'Yes, delete'); yes.type = 'button'; yes.dataset.delyes = m.id; const no = el('button', '', 'Keep it'); no.type = 'button'; no.dataset.delno = m.id; acts.append(el('span', 'scoretext', 'Delete this meal?'), yes, no); }
    else { const again = el('button', '', 'Order again'); again.type = 'button'; again.dataset.again = m.id; const del = el('button', 'danger', 'Delete'); del.type = 'button'; del.dataset.del = m.id; acts.append(again, del); }
    r.append(acts); return r;
  }
  function drawHistChart(box, meals, start, end) {
    box.replaceChildren(); if (!meals.length) { box.append(el('p', 'empty-note', 'No meals in this period yet.')); return; }
    const W = Math.max(300, box.clientWidth || 600), H = 260;
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Cheat-meal score of each logged meal'); box.append(svg.node());
    const left = 30, right = W - 14, top = 12, bottom = H - 28; const s = new Date(start), e = new Date(end); if (+s === +e) { s.setDate(s.getDate() - 3); e.setDate(e.getDate() + 3); }
    const x = d3.scaleTime([s, new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23)], [left + 8, right - 8]); const y = d3.scaleLinear([0, 100], [bottom, top]);
    const g = svg.append('g').style('font', '12px var(--body)');
    for (const [lo, hi, c, L] of [[85, 100, 'var(--good)', 'A'], [70, 85, 'var(--good)', 'B'], [50, 70, 'var(--line)', 'C'], [30, 50, 'var(--warn)', 'D'], [0, 30, 'var(--bad)', 'E']]) {
      g.append('rect').attr('x', left).attr('width', right - left).attr('y', y(hi)).attr('height', y(lo) - y(hi)).style('fill', c).attr('fill-opacity', L === 'C' ? 0.35 : 0.08);
      g.append('text').attr('x', left - 6).attr('y', (y(lo) + y(hi)) / 2).attr('dy', '0.32em').attr('text-anchor', 'end').style('fill', 'var(--ink-2)').style('font', '700 12px var(--display)').text(L);
    }
    const ticks = S.span === 'week' ? d3.timeDay.range(s, d3.timeDay.offset(e, 1)) : x.ticks(W < 460 ? 4 : 7); const fmt = S.span === 'week' ? d3.timeFormat('%a %-d') : d3.timeFormat('%b %-d');
    g.selectAll('.xt').data(ticks).join('text').attr('x', (d) => x(S.span === 'week' ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : d)).attr('y', H - 8).attr('text-anchor', 'middle').style('fill', 'var(--ink-2)').text((d) => fmt(d));
    const pts = meals.map((m) => { const d = parseDay(m.date); d.setHours(12); return { m, x: x(d), y: y(m.score || 0) }; }); const seen = {}; for (const p of pts) { const k = p.m.date; seen[k] = (seen[k] || 0) + 1; p.x += (seen[k] - 1) * 7; }
    const avg = d3.mean(meals, (m) => m.score || 0);
    g.append('line').attr('x1', left).attr('x2', right).attr('y1', y(avg)).attr('y2', y(avg)).style('stroke', 'var(--ink-2)').attr('stroke-dasharray', '4 4');
    g.append('text').attr('x', right).attr('y', y(avg) - 5).attr('text-anchor', 'end').style('fill', 'var(--ink-2)').text(`average ${Math.round(avg)}`);
    g.selectAll('circle').data(pts).join('circle').attr('cx', (p) => p.x).attr('cy', (p) => p.y).attr('r', 6).style('fill', 'var(--accent)').style('stroke', 'var(--ink)').attr('stroke-width', 1.5);
    const ht = el('div', 'tip'); ht.hidden = true; box.append(ht);
    svg.on('pointermove', (ev) => { const [mx, my] = d3.pointer(ev); let bi = -1, bd = 30; pts.forEach((p, i) => { const dd = Math.hypot(p.x - mx, p.y - my); if (dd < bd) { bd = dd; bi = i; } }); if (bi < 0) { ht.hidden = true; return; } const p = pts[bi], m = p.m; ht.replaceChildren(el('div', 't', niceDay(m.date)), el('div', '', `${m.name || 'Meal'} · score ${m.score}`), el('div', '', `${fmtC(m.totals.cal)} cal · ${fmtN(m.totals.p)} g protein`)); ht.hidden = false; const sc = box.clientWidth / W; let lx = p.x * sc + 12; if (lx + ht.offsetWidth > box.clientWidth) lx = p.x * sc - ht.offsetWidth - 12; ht.style.left = Math.max(0, lx) + 'px'; ht.style.top = Math.max(0, p.y * sc - 12) + 'px'; });
    svg.on('pointerleave', () => { ht.hidden = true; });
  }

  // ---------- more ----------
  function renderMore() {
    $('tg-cal').value = S.cal; $('tg-pro').value = S.pro;
    const tb = $('sauce-table').querySelector('tbody'); tb.replaceChildren();
    for (const s of E.sauces) { const tr = el('tr'); tr.append(el('td', '', s.name), el('td', '', String(s.cal)), el('td', '', fmtN(s.p) + ' g'), el('td', '', fmtN(s.f) + ' g'), el('td', '', fmtN(s.c) + ' g')); tb.append(tr); }
    const info = (S.menu && S.menu.priceInfo) || { chains: {} };
    const src = $('price-src'); src.replaceChildren();
    for (const c of E.CHAINS) { const i = info.chains[c]; if (!i) continue; const li = el('li'); const d = el('i', 'dot'); d.style.setProperty('--cc', cvar(c)); const b = el('div'); b.append(el('b', '', c), el('span', 'kind ' + i.kind, i.kind === 'store' ? 'Store price' : 'Approximate'), el('br'), i.text); li.append(d, b); src.append(li); }
    $('data-dates').textContent = `Menu data from ${S.menu ? niceDay(S.menu.version, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} · deals updated ${S.dealsFile && S.dealsFile.updated ? niceDay(S.dealsFile.updated, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}.`;
    if (S.memoryOnly) $('store-note').textContent = 'This browser won’t let the app save anything (private browsing?), so your log only lasts until you close it. Open it normally, or from your home screen, to keep it.';
    if (S.backend === 'cloud') {
      $('store-note').textContent = 'Your log, prices and deals are saved to your Claude account, so they follow you between your phone and computer. A backup file lets you move them into the home-screen app later.';
      const steps = $('install-panel').querySelector('.steps'); steps.replaceChildren();
      for (const t of ['Open this page in Safari on your iPhone (signed in to Claude).', 'Tap Share, then Add to Home Screen, for one-tap access.', 'The stand-alone app that works offline comes next. Save a backup here, then restore it there.']) steps.append(el('li', '', t));
    }
    renderPriceTable();
  }
  function renderPriceTable() {
    chainChips($('p-chain'), S.pChain, 'All restaurants');
    const tb = $('price-table').querySelector('tbody'); tb.replaceChildren(); const q = S.pq.trim().toLowerCase();
    for (const c of E.CHAINS) {
      if (S.pChain !== 'All' && S.pChain !== c) continue;
      const list = E.items.filter((i) => i.chain === c && (!q || i.name.toLowerCase().includes(q))); if (!list.length) continue;
      const hr = el('tr', 'chain-row'); const td = el('td'); td.colSpan = 3; td.textContent = c; hr.append(td); tb.append(hr);
      for (const r of list) {
        const tr = el('tr'); const t1 = el('td'); t1.append(el('span', 'nm', r.name)); if (r.pnote) t1.append(el('small', '', r.pnote));
        const t2 = el('td', 'listed'); if (r.price != null) { t2.append(fmt$(r.price)); if (r.psrc === 'approx') t2.append(el('small', '', 'approx.')); } else t2.append('—');
        const t3 = el('td'); const inp = el('input'); inp.type = 'number'; inp.inputMode = 'decimal'; inp.min = '0'; inp.max = '99'; inp.step = '0.01'; inp.dataset.pid = r.id; inp.placeholder = r.price != null ? '' : 'Add'; inp.setAttribute('aria-label', `Your price for ${c} ${r.name}`);
        if (S.prices[r.id] != null) { inp.value = S.prices[r.id].toFixed(2); inp.classList.add('set'); }
        t3.append(inp); tr.append(t1, t2, t3); tb.append(tr);
      }
    }
    $('price-reset').disabled = !Object.keys(S.prices).length;
  }
  function goToPrice(pid) {
    const it = E.byId(pid); if (it) { S.pChain = it.chain; S.pq = ''; $('p-q').value = ''; }
    setTab('more'); renderPriceTable();
    const inp = document.querySelector(`#price-table input[data-pid="${CSS.escape(pid)}"]`);
    if (inp) { inp.scrollIntoView({ block: 'center' }); inp.focus({ preventScroll: true }); }
  }
  function savePricesSoon() {
    const st = $('price-status'); clearTimeout(S.priceTimer); st.classList.remove('err'); st.textContent = 'Saving…';
    S.priceTimer = setTimeout(() => { Store.set('prices', { ...S.prices }).then(() => { st.textContent = 'Saved on this device.'; }).catch(() => { st.classList.add('err'); st.textContent = 'Your prices didn’t save. Try again.'; }); }, 500);
  }

  // ---------- backup ----------
  function legacyKey(k) {
    if (!k) return null; if (k.startsWith('i|') || k.startsWith('d|')) return k;
    if (k.endsWith('|served')) return `i|${k.slice(0, -7)}|full`; if (k.endsWith('|nosauce')) return `i|${k.slice(0, -8)}|ns`; return `i|${k}|full`;
  }
  function normalizeMeal(m) {
    const out = { ...m, id: m.id || uid() };
    out.items = (m.items || []).map((it) => ({ ...it, key: legacyKey(it.key), mode: it.mode === 'No sauce' ? 'ns' : it.mode === 'As served' || it.mode === 'Plain' ? 'full' : it.mode }));
    return out;
  }
  async function exportBackup() {
    const body = { app: 'drive-thru-macros', version: 2, exported: new Date().toISOString(), settings: { cal: S.cal, pro: S.pro }, prices: S.prices, customDeals: S.customDeals, meals: S.meals };
    const blob = new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' });
    const name = `drive-thru-macros-backup-${today()}.json`;
    try { const file = new File([blob], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Drive-Thru Macros backup' }); $('bk-flash').textContent = 'Backup shared.'; return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    $('bk-flash').textContent = `Saved ${name}.`;
  }
  async function importBackup(file) {
    const f = $('bk-flash'); f.classList.remove('err');
    try {
      const data = JSON.parse(await file.text());
      const meals = (data.meals || []).map(normalizeMeal).filter((m) => m.date && m.totals);
      const have = new Set(S.meals.map((m) => m.id)); const fresh = meals.filter((m) => !have.has(m.id));
      if (fresh.length) await Store.putMeals(fresh);
      if (data.settings) { if (data.settings.cal) S.cal = data.settings.cal; if (data.settings.pro) S.pro = data.settings.pro; saveSettings(); }
      if (data.prices && typeof data.prices === 'object') { S.prices = { ...data.prices, ...S.prices }; E.setOverrides(S.prices); await Store.set('prices', S.prices); }
      if (Array.isArray(data.customDeals)) { const ids = new Set(S.customDeals.map((d) => d.id)); S.customDeals = [...S.customDeals, ...data.customDeals.filter((d) => !ids.has(d.id))]; E.setCustomDeals(S.customDeals); await saveCustomDeals(); }
      await reloadMeals();
      f.textContent = `Restored ${fresh.length} meal${fresh.length === 1 ? '' : 's'}${meals.length - fresh.length ? ` (${meals.length - fresh.length} already here)` : ''}.`;
      renderAllViews();
    } catch (e) { f.classList.add('err'); f.textContent = 'That file couldn’t be read. Pick a Drive-Thru Macros backup (.json).'; }
  }

  // ---------- tabs ----------
  const TABS = ['order', 'deals', 'ideas', 'history', 'more'];
  function setTab(tab) {
    S.tab = TABS.includes(tab) ? tab : 'order';
    for (const t of TABS) $('view-' + t).hidden = t !== S.tab;
    document.querySelectorAll('.tabs a').forEach((a) => { if (a.dataset.tab === S.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (S.tab === 'order') { renderGrid(); renderTicket(); renderScatter(); }
    if (S.tab === 'deals') renderDeals();
    if (S.tab === 'ideas') renderIdeas();
    if (S.tab === 'history') renderHistory();
    if (S.tab === 'more') renderMore();
    renderCartbar();
    if (history.replaceState) history.replaceState(null, '', '#' + S.tab);
  }
  function renderAllViews() { chainChips($('f-chain'), S.chain, 'All restaurants'); catChips(); sync('f-mode', S.mode); setTab(S.tab); }

  // ---------- events ----------
  document.querySelectorAll('.tabs a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setTab(a.dataset.tab); window.scrollTo({ top: 0 }); }));
  $('f-chain').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.chain = b.dataset.v; S.page = PAGE; chainChips($('f-chain'), S.chain, 'All restaurants'); renderGrid(); renderScatter(); });
  $('f-cat').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.cat = b.dataset.v; S.page = PAGE; catChips(); renderGrid(); renderScatter(); });
  $('f-mode').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.mode = b.dataset.v; sync('f-mode', S.mode); saveSettings(); renderGrid(); renderScatter(); });
  $('f-sort').addEventListener('change', (e) => { S.sort = e.target.value; S.page = PAGE; renderGrid(); });
  let qt; $('f-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; S.page = PAGE; renderGrid(); renderScatter(); }, 150); });
  $('f-x').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.xAxis = b.dataset.v; renderScatter(); });
  $('more-items').addEventListener('click', () => { S.page += PAGE; renderGrid(); });
  $('items').addEventListener('click', (e) => { const lk = e.target.closest('button[data-pid]'); if (lk) { goToPrice(lk.dataset.pid); return; } const b = e.target.closest('button.add'); if (b) addItem(b.dataset.id); });
  $('ticket').addEventListener('click', (e) => {
    const lk = e.target.closest('button[data-pid]'); if (lk) { goToPrice(lk.dataset.pid); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const { act, kind, key } = b.dataset;
    if (kind === 'sauce') S.sauce[key] = Math.max(0, Math.min(6, (S.sauce[key] || 0) + (act === 'inc' ? 1 : -1)));
    else { const v = (S.cart.get(key) || 0) + (act === 'inc' ? 1 : -1); if (v <= 0) S.cart.delete(key); else S.cart.set(key, v); }
    saveCartSoon(); renderOrderBits();
  });
  $('log-date').addEventListener('change', () => renderTicket());
  $('clear-btn').addEventListener('click', () => {
    const prev = { cart: new Map(S.cart), sauce: { ...S.sauce } };
    S.cart.clear(); S.sauce = {}; saveCartSoon(); renderOrderBits();
    flash('Order cleared.', false, { label: 'Undo', fn: () => { S.cart = prev.cart; S.sauce = prev.sauce; saveCartSoon(); renderOrderBits(); flash('Order restored.'); } });
  });
  $('logform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = E.totals(S.cart, S.sauce); if (t.cal <= 0) return;
    const date = $('log-date').value || today(); const name = $('log-name').value.trim() || 'Cheat meal'; const score = E.scoreOf(t.p100); const r1 = E.r1;
    const items = t.lines.map(([L, q]) => L.kind === 'deal'
      ? { key: L.key, name: partsSummary(L.parts), chain: L.chain, cat: 'Deal', mode: L.mode, removed: '', qty: q, cal: Math.round(L.cal), p: r1(L.p), f: r1(L.f), c: r1(L.c), price: L.price, approx: L.approx, deal: { id: L.deal.id, title: L.deal.title } }
      : { key: L.key, name: L.name, chain: L.chain, cat: L.item.cat, mode: L.mode, removed: L.removed || '', qty: q, cal: L.cal, p: L.p, f: L.f, c: L.c, price: L.price, approx: L.approx });
    const sauces = E.sauces.filter((s) => S.sauce[s.key]).map((s) => ({ key: s.key, name: s.name, tbsp: S.sauce[s.key], cal: s.cal, p: s.p, f: s.f, c: s.c }));
    const totals = { cal: Math.round(t.cal), p: r1(t.p), f: r1(t.f), c: r1(t.c), unpriced: t.unpriced.length }; if (t.price > 0) { totals.price = Math.round(t.price * 100) / 100; totals.pricedP = r1(t.pricedP); }
    const meal = { id: uid(), date, name, items, sauces, totals, p100: r1(t.p100), score, grade: E.gradeOf(score)[1], loggedAt: new Date().toISOString() };
    const btn = $('log-btn'); btn.disabled = true; btn.textContent = 'Logging…';
    try {
      await Store.putMeal(meal); await reloadMeals();
      S.cart.clear(); S.sauce = {}; saveCartSoon(); $('log-name').value = '';
      renderOrderBits(); flash(`Logged ${name} for ${niceDay(date)}: ${fmtC(totals.cal)} cal, score ${score}.`);
    } catch (err) { flash('That meal didn’t save. Try Log this meal again.', true); }
    finally { btn.textContent = 'Log this meal'; renderTicket(); }
  });
  $('cartbar-go').addEventListener('click', () => { if (S.tab !== 'order') setTab('order'); $('ticket').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // deals
  $('d-chain').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.dealChain = b.dataset.v; renderDeals(); });
  $('view-deals').addEventListener('change', (e) => { const s = e.target.closest('select[data-deal]'); if (!s) return; const d = E.dealById(s.dataset.deal); const picks = S.dealPick[d.id] || d.slots.map(() => 0); picks[+s.dataset.slot] = +s.value; S.dealPick[d.id] = picks; renderDeals(); });
  $('view-deals').addEventListener('click', async (e) => {
    const a = e.target.closest('button[data-adddeal]');
    if (a) { const d = E.dealById(a.dataset.adddeal); const ids = E.dealPicks(d, S.dealPick[d.id]); addKey(E.dealKey(d.id, S.mode, ids), 1, `${d.chain} ${d.title}`); a.textContent = 'Added ✓'; setTimeout(() => renderDeals(), 1200); return; }
    const del = e.target.closest('button[data-deldeal]');
    if (del) { S.customDeals = S.customDeals.filter((d) => d.id !== del.dataset.deldeal); E.setCustomDeals(S.customDeals); await saveCustomDeals(); renderDeals(); return; }
    const rm = e.target.closest('button[data-rm]'); if (rm) { S.dfItems.splice(+rm.dataset.rm, 1); renderDealForm(); }
  });
  $('df-chain').addEventListener('change', () => { S.dfItems = []; renderDealForm(); });
  $('df-add-item').addEventListener('click', () => { const id = $('df-item').value; const qty = Math.max(1, Math.min(10, +$('df-qty').value || 1)); if (!id) return; S.dfItems.push({ id, qty }); $('df-qty').value = 1; renderDealForm(); });
  $('deal-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const fl = $('df-flash'); fl.classList.remove('err');
    const price = Number($('df-price').value); const title = $('df-title').value.trim();
    if (!S.dfItems.length) { fl.classList.add('err'); fl.textContent = 'Add at least one item to the deal.'; return; }
    if (!(price >= 0) || !title) return;
    const chain = $('df-chain').value;
    const d = { id: 'my-' + uid().slice(0, 12), chain, title, price: Math.round(price * 100) / 100, kind: 'mine', desc: S.dfItems.map((x) => `${x.qty}× ${E.byId(x.id).name}`).join(' + '), slots: S.dfItems.map((x) => ({ qty: x.qty, choices: [x.id] })), source: 'Added by you', verified: today(), expires: $('df-expires').value || null };
    S.customDeals.push(d); E.setCustomDeals(S.customDeals);
    try { await saveCustomDeals(); fl.textContent = 'Saved. It’s in your deals and in Ideas.'; } catch (err) { fl.classList.add('err'); fl.textContent = 'That deal didn’t save on this device.'; }
    S.dfItems = []; $('df-title').value = ''; $('df-price').value = ''; $('df-expires').value = ''; renderDealForm(); renderDeals();
  });
  $('add-deal').addEventListener('toggle', () => renderDealForm());

  // ideas
  $('i-budget').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.ideas.budget = b.dataset.v === 'left' ? 'left' : +b.dataset.v; saveSettings(); renderIdeas(); });
  $('i-budget').addEventListener('change', (e) => { if (e.target.id !== 'i-custom') return; const v = Math.round(+e.target.value); if (v >= 200 && v <= 3000) { S.ideas.budget = v; saveSettings(); renderIdeas(); } });
  $('i-stops').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.ideas.stops = b.dataset.v === 'any' ? 'any' : +b.dataset.v; saveSettings(); renderIdeas(); });
  $('i-priority').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.ideas.priority = b.dataset.v; saveSettings(); renderIdeas(); });
  $('i-chain').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; const c = b.dataset.v; const I = S.ideas; if (c === 'All') I.chains = []; else I.chains = I.chains.includes(c) ? I.chains.filter((x) => x !== c) : [...I.chains, c]; saveSettings(); renderIdeas(); });
  for (const [id, k] of [['i-deals', 'deals'], ['i-breakfast', 'breakfast'], ['i-ns', 'ns'], ['i-fries', 'fries']]) $(id).addEventListener('change', (e) => { S.ideas[k] = e.target.checked; saveSettings(); renderIdeas(); });
  $('view-ideas').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t5]'); if (!b || !S.lastTop5) return;
    const [list, i] = b.dataset.t5.split(':'); const x = (S.lastTop5[list] || [])[+i]; if (!x) return;
    for (const g of x.groups) for (const u of g.units) {
      if (u.deal) { const k = E.dealKey(u.deal.id, 'ns', u.parts.map((p) => p.id)); S.cart.set(k, (S.cart.get(k) || 0) + 1); }
      else for (const p of u.parts) { const k = E.itemKey(p.id, 'ns'); S.cart.set(k, (S.cart.get(k) || 0) + 1); }
    }
    saveCartSoon(); renderOrderBits(); flash(`Added ${x.groups.map((g) => g.chain + ' ' + partsSummary(g.parts)).join(' + ')}`);
    b.textContent = 'Added ✓'; b.disabled = true; renderCartbar();
  });
  $('idea-cards').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idea]'); if (!b || !S.lastIdeas) return; const x = S.lastIdeas.res[+b.dataset.idea]; const mode = S.lastIdeas.mode;
    for (const g of x.groups) {
      if (g.deal) { const k = E.dealKey(g.deal.id, mode, g.parts.map((p) => p.id)); S.cart.set(k, (S.cart.get(k) || 0) + 1); }
      else for (const p of g.parts) { const k = E.itemKey(p.id, mode); S.cart.set(k, (S.cart.get(k) || 0) + 1); }
    }
    saveCartSoon(); renderOrderBits(); flash(`Added ${x.groups.map((g) => g.chain + ' ' + partsSummary(g.parts)).join(' + ')}`);
    b.textContent = 'Added ✓'; b.disabled = true; renderCartbar();
  });

  // history
  $('h-span').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.span = b.dataset.v; S.anchor = new Date(); S.confirmDel = null; renderHistory(); });
  $('h-prev').addEventListener('click', () => { const a = S.anchor; S.anchor = S.span === 'week' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() - 7) : new Date(a.getFullYear(), a.getMonth() - 1, 1); renderHistory(); });
  $('h-next').addEventListener('click', () => { const a = S.anchor; S.anchor = S.span === 'week' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7) : new Date(a.getFullYear(), a.getMonth() + 1, 1); renderHistory(); });
  $('h-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.again) {
      const m = S.meals.find((x) => x.id === b.dataset.again); if (!m) return;
      S.cart.clear(); S.sauce = {}; let skipped = 0;
      for (const it of (m.items || [])) { const k = legacyKey(it.key); if (k && E.resolve(k)) S.cart.set(k, (S.cart.get(k) || 0) + it.qty); else skipped++; }
      for (const s of (m.sauces || [])) if (E.sauceByKey(s.key)) S.sauce[s.key] = s.tbsp;
      $('log-date').value = today(); $('log-name').value = m.name || ''; saveCartSoon(); setTab('order');
      flash(`Loaded ${m.name || 'that meal'} into your order${skipped ? ` (${skipped} item${skipped > 1 ? 's are' : ' is'} no longer on the menu)` : ''}.`); return;
    }
    if (b.dataset.del) { S.confirmDel = b.dataset.del; renderHistory(); return; }
    if (b.dataset.delno) { S.confirmDel = null; renderHistory(); return; }
    if (b.dataset.delyes) { const id = b.dataset.delyes; S.confirmDel = null; try { await Store.deleteMeal(id); await reloadMeals(); } catch (err) { /* keep it listed */ } renderHistory(); }
  });

  // more
  $('tg-save').addEventListener('click', () => { const c = Number($('tg-cal').value), p = Number($('tg-pro').value); const f = $('tg-flash'); f.classList.remove('err'); if (!(c >= 800 && c <= 6000 && p >= 20 && p <= 400)) { f.classList.add('err'); f.textContent = 'Calories 800–6,000 and protein 20–400 g.'; return; } S.cal = Math.round(c); S.pro = Math.round(p); saveSettings(); f.textContent = 'Saved.'; });
  $('p-chain').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.pChain = b.dataset.v; renderPriceTable(); });
  let pqt; $('p-q').addEventListener('input', (e) => { clearTimeout(pqt); pqt = setTimeout(() => { S.pq = e.target.value; renderPriceTable(); }, 150); });
  $('price-table').addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-pid]'); if (!inp) return; const id = inp.dataset.pid; const raw = inp.value.trim(); const v = Number(raw);
    if (raw === '') delete S.prices[id]; else if (Number.isFinite(v) && v > 0 && v < 100) S.prices[id] = Math.round(v * 100) / 100; else return;
    inp.classList.toggle('set', S.prices[id] != null); $('price-reset').disabled = !Object.keys(S.prices).length; E.setOverrides(S.prices); savePricesSoon();
  });
  $('price-reset').addEventListener('click', () => { S.prices = {}; E.setOverrides(S.prices); renderPriceTable(); savePricesSoon(); });
  $('bk-export').addEventListener('click', exportBackup);
  $('bk-import').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
  $('reset-btn').addEventListener('click', () => {
    const row = $('reset-row'); row.replaceChildren(el('span', 'scoretext', 'Delete your log, prices, deals and order on this device?'));
    const yes = el('button', 'btn danger', 'Yes, delete everything'); yes.type = 'button'; const no = el('button', 'btn ghost', 'Keep it all'); no.type = 'button'; row.append(yes, no);
    no.addEventListener('click', () => { row.replaceChildren($('reset-btn') || resetBtn); });
    yes.addEventListener('click', async () => { await Store.clearAll(); location.reload(); });
  });
  const resetBtn = $('reset-btn');
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.tab === 'order') { renderScatter(); renderTicket(); } if (S.tab === 'history') renderHistory(); }, 200); });

  // ---------- service worker ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !(self.claude && typeof self.claude.use === 'function')) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const show = (w) => { const b = $('update-banner'); b.hidden = false; $('update-btn').onclick = () => w.postMessage('skipWaiting'); };
      if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); }); });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const [menu, deals] = await Promise.all([fetch('data/menu.json').then((r) => r.json()), fetch('data/deals.json').then((r) => r.json()).catch(() => ({ deals: [] }))]);
      S.menu = menu; S.dealsFile = deals; E.load(menu, deals);
    } catch (e) { $('loading').textContent = 'The menu couldn’t load. Check your connection and reopen the app.'; return; }
    await Store.init(); S.backend = Store.backend; S.memoryOnly = S.backend === 'memory';
    try {
      const [cart, settings, prices, customDeals] = await Promise.all([Store.get('cart'), Store.get('settings'), Store.get('prices'), Store.get('customDeals')]);
      if (settings) { if (settings.cal) S.cal = settings.cal; if (settings.pro) S.pro = settings.pro; if (settings.ideas) S.ideas = { ...S.ideas, ...settings.ideas }; if (settings.mode) S.mode = settings.mode; }
      if (prices) { S.prices = prices; E.setOverrides(prices); }
      if (Array.isArray(customDeals)) { S.customDeals = customDeals; E.setCustomDeals(customDeals); }
      if (cart) { for (const [k0, q] of (cart.items || [])) { const k = legacyKey(k0); if (k && E.resolve(k) && q > 0) S.cart.set(k, q); } S.sauce = { ...(cart.sauces || {}) }; }
      await reloadMeals();
    } catch (e) { /* start fresh */ }
    Store.persist();
    $('loading').remove();
    $('log-date').value = today();
    const h = (location.hash || '').slice(1); S.tab = TABS.includes(h) ? h : 'order';
    renderAllViews();
  }
  boot();
})();
