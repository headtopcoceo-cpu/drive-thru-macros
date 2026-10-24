// Original illustrated item pictures, drawn as inline SVG. Food colours are fixed; the plate follows the theme.
const PIC = (() => {
  const C = {
    bun: '#DB9A4C', bunTop: '#E5A957', bunShade: '#C5843A', sesame: '#FFF2D4',
    patty: '#6A3A21', pattyHi: '#7E4A2C', cheese: '#F3C13A', lettuce: '#78B046', tomato: '#E0523C', onion: '#EFE4F2',
    chick: '#D4913A', chickDk: '#B8752A', spicy: '#C2552C', grill: '#D2A866', grillMk: '#7A5230',
    tortilla: '#ECD49E', tortillaIn: '#F7ECD2', fry: '#F2C64D', fryDk: '#D9A93A', ring: '#D9A55B', ringHi: '#F1CA8A',
    cheeseIn: '#FFF6DF', cap: '#3C414C', veggie: '#7D6F3A', fish: '#DDB565', egg: '#FFFDF5', yolk: '#F6B92B',
    bacon: '#B9442F', baconHi: '#E58A6E', sausage: '#8A4B2B', gravy: '#7A4A26', curd: '#FFF7E3', syrup: '#9C5A1E', butter: '#FBE38A',
    choc: '#6B3F26', serve: '#FFF8EA', pastry: '#E2B162', pastryDk: '#C08A3E', cone: '#D9A15A', coneDk: '#B9813F', dough: '#E8BA77',
    potato: '#B9864F', potatoIn: '#F4E1B8', bean: '#6E2A1B', chili: '#A4442A',
  };
  const plate = '<circle class="plate" cx="40" cy="32" r="30"/>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const wrapSvg = (inner, label) => `<svg viewBox="0 0 80 64" role="img" aria-label="${esc(label)}">${plate}${inner}</svg>`;

  function lettuce(L, R, y) {
    let d = `M${L} ${y + 3}`;
    for (let x = L; x < R; x += 5) d += ` q2.5 -3.6 5 0`;
    d += ` L${R} ${y + 4.2} L${L} ${y + 4.2} Z`;
    return `<path d="${d}" fill="${C.lettuce}"/>`;
  }
  function dome(L, W, y, h, sesame) {
    const R = L + W, mid = L + W / 2;
    let s = `<path d="M${L} ${y + h} C${L} ${y + h * 0.15} ${L + W * 0.16} ${y} ${mid} ${y} C${L + W * 0.84} ${y} ${R} ${y + h * 0.15} ${R} ${y + h} Z" fill="${C.bunTop}"/>`;
    s += `<path d="M${L + 2} ${y + h} L${R - 2} ${y + h}" stroke="${C.bunShade}" stroke-width="1.2"/>`;
    if (sesame) {
      const pts = [[0.3, 0.38], [0.45, 0.22], [0.58, 0.42], [0.7, 0.27], [0.38, 0.58], [0.62, 0.62], [0.22, 0.6], [0.8, 0.55]];
      for (const [px, py] of pts) s += `<ellipse cx="${(L + W * px).toFixed(1)}" cy="${(y + h * py).toFixed(1)}" rx="1.3" ry="0.8" fill="${C.sesame}"/>`;
    }
    return s;
  }
  function cheeseSlice(L, W, y) {
    const R = L + W;
    return `<path d="M${L - 1} ${y} H${R + 1} V${y + 2.4} H${R - 9} L${R - 12} ${y + 6} L${R - 15} ${y + 2.4} H${L + 15} L${L + 12} ${y + 5.2} L${L + 9} ${y + 2.4} H${L - 1} Z" fill="${C.cheese}"/>`;
  }
  function stack(o, fill) {
    const W = o.small ? 40 : o.wide ? 58 : 50;
    const L = 40 - W / 2;
    const parts = [];
    let y = 60;
    y -= 7; parts.push(`<rect x="${L}" y="${y}" width="${W}" height="7" rx="3.5" fill="${C.bun}"/>`);
    const fillPatty = fill || null;
    const n = o.p || 1;
    const pH = fill ? 9 : (o.thick ? 7 : o.thin ? 4.6 : 6);
    for (let i = 0; i < n; i++) {
      y -= pH;
      if (fillPatty) {
        const pw = W + 6, px = L - 3;
        parts.push(`<rect x="${px}" y="${y}" width="${pw}" height="${pH}" rx="4.5" fill="${fillPatty}"/>`);
        if (o.grilled) {
          for (let k = 0; k < 4; k++) parts.push(`<path d="M${px + 9 + k * 11} ${y + 1.5} l5 ${pH - 3}" stroke="${C.grillMk}" stroke-width="1.6" stroke-linecap="round"/>`);
        } else {
          for (let k = 0; k < 7; k++) parts.push(`<circle cx="${px + 5 + k * (pw - 10) / 6}" cy="${y + (k % 2 ? 2.6 : 6.2)}" r="1.1" fill="${o.spicy ? '#8E3A1C' : C.chickDk}"/>`);
        }
      } else {
        const px = o.square ? L - 2.5 : L + 1, pw = o.square ? W + 5 : W - 2;
        parts.push(`<rect x="${px}" y="${y}" width="${pw}" height="${pH}" rx="${o.square ? 1.4 : pH / 2}" fill="${o.veggie ? C.veggie : C.patty}"/>`);
        parts.push(`<rect x="${px + 3}" y="${y + 1}" width="${pw - 6}" height="1.2" rx="0.6" fill="${C.pattyHi}"/>`);
      }
      if (o.cheese && i < o.cheese) { y -= 2.4; parts.push(cheeseSlice(L, W, y)); }
      if (o.mid && i === 0) { y -= 5; parts.push(`<rect x="${L}" y="${y}" width="${W}" height="5" rx="2.5" fill="${C.bun}"/>`); }
    }
    if (o.veg === 'full') {
      y -= 3; parts.push(`<rect x="${L + 2}" y="${y}" width="${W - 4}" height="3" rx="1.5" fill="${C.tomato}"/>`);
      y -= 3.4; parts.push(lettuce(L - 2, L + W + 2, y));
    } else if (o.veg === 'lettuce') {
      y -= 3.4; parts.push(lettuce(L - 2, L + W + 2, y));
    } else if (o.veg === 'onion') {
      y -= 2.2; parts.push(`<rect x="${L + 3}" y="${y}" width="${W - 6}" height="2.2" rx="1.1" fill="${C.onion}"/>`);
    }
    const tH = o.small ? 11 : 14;
    y -= tH; parts.push(dome(L, W, y, tH, o.sesame || fill));
    const H = 60 - y;
    const dy = (64 - H) / 2 - y;
    return `<g transform="translate(0 ${dy.toFixed(1)})">${parts.join('')}</g>`;
  }
  function wrap(o) {
    const dot = o.spicy ? '#D9532A' : C.chick;
    const half = (cx, rot) => `<g transform="rotate(${rot} ${cx} 33)"><rect x="${cx - 16}" y="23" width="30" height="20" rx="10" fill="${C.tortilla}"/><ellipse cx="${cx + 12}" cy="33" rx="6" ry="10" fill="${C.tortillaIn}"/><circle cx="${cx + 12}" cy="29.5" r="3" fill="${C.lettuce}"/><circle cx="${cx + 13}" cy="36" r="2.6" fill="${dot}"/><circle cx="${cx + 10.5}" cy="33.5" r="1.8" fill="${C.cheese}"/></g>`;
    return half(30, -16) + half(46, 14);
  }
  function nuggets(o) {
    const pos = [[28, 41], [40, 43], [52, 41], [34, 32], [46, 32], [40, 23]];
    const k = Math.min(6, Math.max(3, Math.round((o.n || 6) * 0.75)));
    return pos.slice(0, k).map(([x, y], i) => `<g transform="rotate(${(i % 3 - 1) * 14} ${x} ${y})"><path d="M${x - 7} ${y} c0 -5 4 -6.5 7.5 -6 c4 0.5 6.5 2.5 6.5 6 c0 4 -3.5 5.8 -7 5.6 c-3.8 -0.2 -7 -1.6 -7 -5.6 Z" fill="${C.chick}"/><circle cx="${x - 2}" cy="${y - 1.5}" r="0.9" fill="${C.chickDk}"/><circle cx="${x + 2.5}" cy="${y + 1.5}" r="0.9" fill="${C.chickDk}"/></g>`).join('');
  }
  function strips(o, chainColor) {
    const k = Math.min(5, o.n || 3);
    const angles = { 3: [-16, 0, 16], 4: [-24, -8, 8, 24], 5: [-30, -15, 0, 15, 30] }[k] || [0];
    let s = angles.map((a) => `<g transform="rotate(${a} 40 50)"><rect x="36.5" y="16" width="7.5" height="30" rx="${o.toast ? 1.5 : 3.75}" fill="${o.toast ? C.dough : C.chick}"/><circle cx="39" cy="24" r="0.9" fill="${C.chickDk}"/><circle cx="41.5" cy="33" r="0.9" fill="${C.chickDk}"/></g>`).join('');
    s += `<path d="M19 40 H61 L57 55 H23 Z" style="fill:${chainColor}"/><path d="M21 44 H59" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>`;
    return s;
  }
  function box(chainColor, stickColor, count, scale) {
    const s = scale || 1;
    const w = 28 * s, h = 25 * s, top = 56 - h;
    const L = 40 - w / 2, R = 40 + w / 2;
    let out = '';
    const k = count;
    for (let i = 0; i < k; i++) {
      const x = L + 3 + i * (w - 6) / (k - 1) - 2;
      const hh = 14 + ((i * 7) % 5) * 2.2;
      out += `<rect x="${x.toFixed(1)}" y="${(top - hh + 6).toFixed(1)}" width="4" height="${hh}" rx="1.4" fill="${stickColor}" transform="rotate(${(i - (k - 1) / 2) * 4} ${x + 2} ${top + 6})"/>`;
    }
    out += `<path d="M${L} ${top} H${R} L${R - 3 * s} 56 H${L + 3 * s} Z" style="fill:${chainColor}"/>`;
    out += `<path d="M${40 - 6 * s} ${top} q${6 * s} ${7 * s} ${12 * s} 0" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>`;
    return out;
  }
  function rings(o) {
    const k = o.n || 2;
    const pos = k === 3 ? [[31, 39], [49, 39], [40, 25]] : [[33, 36], [47, 30]];
    return pos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${C.ring}" stroke-width="6.5"/><path d="M${x - 7} ${y - 4} a9 9 0 0 1 6 -5" fill="none" stroke="${C.ringHi}" stroke-width="1.6" stroke-linecap="round"/>`).join('');
  }
  function mozz(o) {
    const k = Math.min(5, Math.max(3, Math.round((o.n || 4) / 2.5) + 1));
    let s = '';
    for (let i = 0; i < k; i++) {
      const x = 40 - (k - 1) * 5 + i * 10;
      const rot = (i - (k - 1) / 2) * 9;
      s += `<g transform="rotate(${rot} ${x} 46)"><rect x="${x - 4}" y="20" width="8" height="28" rx="3.5" fill="${C.chick}"/><ellipse cx="${x}" cy="21" rx="4" ry="2.2" fill="${C.cheeseIn}"/><circle cx="${x - 1}" cy="31" r="0.9" fill="${C.chickDk}"/><circle cx="${x + 1.5}" cy="39" r="0.9" fill="${C.chickDk}"/></g>`;
    }
    return s;
  }
  function sauce(o) {
    const body = { mayo: '#F4ECD6', ketchup: '#D63A2E', chipotle: '#E07A36' }[o.t] || '#ddd';
    return `<rect x="35.5" y="12" width="9" height="9" rx="2" fill="${C.cap}"/><path d="M38.5 7 h3 l-0.8 5 h-1.4 Z" fill="${C.cap}"/><rect x="29" y="20" width="22" height="36" rx="7" fill="${body}"/><rect x="31.5" y="32" width="17" height="11" rx="2" fill="rgba(255,255,255,.7)"/><path d="M34 37.5 h12" stroke="${C.cap}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>`;
  }


  const flatBun = (L, W, y, h, color, r) => `<rect x="${L}" y="${y}" width="${W}" height="${h}" rx="${r ?? h / 2}" fill="${color}"/>`;
  function bsand(o) {
    const W = 46, L = 40 - W / 2; let y = 54; const parts = [];
    const bunCol = o.bun === 'griddle' ? '#C98B45' : o.bun === 'bagel' ? '#D29B55' : o.bun === 'croissant' ? C.pastry : '#E8C38A';
    y -= 8; parts.push(flatBun(L, W, y, 8, bunCol, 4));
    if (o.meat === 'sausage') { y -= 6; parts.push(`<rect x="${L + 1}" y="${y}" width="${W - 2}" height="6" rx="3" fill="${C.sausage}"/>`); }
    if (o.meat === 'chicken') { y -= 6; parts.push(`<rect x="${L + 1}" y="${y}" width="${W - 2}" height="6" rx="3" fill="${C.chick}"/>`); }
    if (o.meat === 'bacon') { y -= 3.4; let d = `M${L} ${y + 2}`; for (let x = L; x < L + W; x += 6) d += ' q3 -3 6 0'; parts.push(`<path d="${d}" fill="none" stroke="${C.bacon}" stroke-width="3" stroke-linecap="round"/>`); }
    if (o.egg) { y -= 5.5; parts.push(`<rect x="${L - 1}" y="${y}" width="${W + 2}" height="5.5" rx="2.75" fill="${C.egg}"/><rect x="${L + 12}" y="${y + 1.2}" width="${W - 24}" height="3" rx="1.5" fill="${C.yolk}"/>`); }
    if (o.cheese) { y -= 2.4; parts.push(`<path d="M${L} ${y} H${L + W} V${y + 2.4} H${L + W - 10} L${L + W - 13} ${y + 5.5} L${L + W - 16} ${y + 2.4} H${L} Z" fill="${C.cheese}"/>`); }
    if (o.bun === 'croissant') { y -= 13; parts.push(`<path d="M${L - 3} ${y + 13} C${L} ${y} ${L + W} ${y} ${L + W + 3} ${y + 13} Z" fill="${C.pastry}"/><path d="M${L + 10} ${y + 4} q3 4 2 9 M${L + 22} ${y + 1.5} q2 5 1 11.5 M${L + 34} ${y + 4} q-2 4 -1 9" stroke="${C.pastryDk}" stroke-width="1.2" fill="none"/>`); }
    else { const h = o.bun === 'bagel' ? 11 : 9; y -= h; parts.push(flatBun(L, W, y, h, bunCol, o.bun === 'bagel' ? 5.5 : 4)); if (o.bun === 'muffin') parts.push(`<circle cx="${L + 10}" cy="${y + 3}" r="0.8" fill="#FFF3DA"/><circle cx="${L + 24}" cy="${y + 2.4}" r="0.8" fill="#FFF3DA"/><circle cx="${L + 36}" cy="${y + 3.6}" r="0.8" fill="#FFF3DA"/>`); if (o.bun === 'griddle') parts.push(`<path d="M${L + 8} ${y + 4.5} h${W - 16}" stroke="#A86E33" stroke-width="1.2" stroke-dasharray="3 3"/>`); }
    const H = 54 - y, dy = (64 - H) / 2 - y;
    return `<g transform="translate(0 ${dy.toFixed(1)})">${parts.join('')}</g>`;
  }
  function pancakes() {
    let s = '';
    for (let i = 0; i < 3; i++) s += `<ellipse cx="40" cy="${47 - i * 6}" rx="22" ry="6.5" fill="${C.dough}"/><ellipse cx="40" cy="${45.5 - i * 6}" rx="21" ry="5" fill="#F0C98A"/>`;
    s += `<path d="M24 34 q4 8 2 14 M54 33 q3 6 1 11" stroke="${C.syrup}" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="40" cy="33" rx="16" ry="4" fill="${C.syrup}" opacity=".85"/><rect x="35" y="27.5" width="10" height="5.5" rx="1.5" fill="${C.butter}"/>`;
    return s;
  }
  function hashbrown() {
    return `<rect x="22" y="22" width="36" height="22" rx="10" fill="${C.pastry}"/><path d="M28 28 h8 M40 32 h10 M28 36 h12 M44 40 h7" stroke="${C.pastryDk}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  function platter() {
    return `<ellipse cx="33" cy="30" rx="12" ry="9" fill="${C.egg}"/><circle cx="33" cy="30" r="4.4" fill="${C.yolk}"/><path d="M45 22 q4 -3 8 0 t8 0 M45 28 q4 -3 8 0 t8 0" stroke="${C.bacon}" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="30" y="41" width="22" height="11" rx="5" fill="${C.pastry}"/><path d="M34 45 h6 M42 48 h6" stroke="${C.pastryDk}" stroke-width="1.2" stroke-linecap="round"/>`;
  }
  function poutine(chainColor) {
    let s = box(chainColor, C.fry, 6, 0.95).replace(/<path d="M\d[^"]*q[^"]*" fill="none"[^>]*\/>/, '');
    s += `<path d="M24 29 q8 -7 16 -2 q9 -6 16 2 q-2 6 -16 6 q-14 0 -16 -6 Z" fill="${C.gravy}"/>`;
    for (const [x, y] of [[30, 27], [37, 25], [44, 27], [50, 29], [34, 31], [46, 31]]) s += `<rect x="${x - 2}" y="${y - 2}" width="4.4" height="4" rx="1.4" fill="${C.curd}"/>`;
    return s;
  }
  function bowl(chainColor) {
    let s = `<ellipse cx="40" cy="30" rx="20" ry="6" fill="${C.chili}"/>`;
    for (const [x, y] of [[32, 29], [39, 31], [46, 28.5], [43, 32]]) s += `<ellipse cx="${x}" cy="${y}" rx="2" ry="1.3" fill="${C.bean}"/>`;
    s += `<path d="M20 31 H60 C60 44 52 52 40 52 C28 52 20 44 20 31 Z" style="fill:${chainColor}"/><path d="M24 37 H56" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>`;
    return s;
  }
  function potato() {
    return `<ellipse cx="40" cy="38" rx="21" ry="13" fill="${C.potato}"/><path d="M24 34 q16 -10 32 0 q-4 8 -16 8 q-12 0 -16 -8 Z" fill="${C.potatoIn}"/><ellipse cx="40" cy="31" rx="8" ry="4" fill="#FFFBEF"/><circle cx="36" cy="30" r="0.9" fill="${C.lettuce}"/><circle cx="43" cy="31" r="0.9" fill="${C.lettuce}"/>`;
  }
  function salad() {
    let s = `<path d="M17 32 H63 C63 46 53 54 40 54 C27 54 17 46 17 32 Z" fill="#CFD8C3" opacity=".9"/>`;
    for (const [x, y, r] of [[27, 30, 7], [36, 27, 8], [46, 28, 8], [54, 31, 6], [41, 32, 7]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.lettuce}"/>`;
    s += `<circle cx="31" cy="29" r="3" fill="${C.tomato}"/><circle cx="50" cy="27" r="2.6" fill="${C.tomato}"/><rect x="36" y="25" width="10" height="4" rx="2" fill="${C.grill}" transform="rotate(-12 41 27)"/><rect x="40" y="30" width="10" height="4" rx="2" fill="${C.grill}" transform="rotate(14 45 32)"/>`;
    return s;
  }
  function cup(o, chainColor) {
    const s = o.s || 0.9, w = 26 * s, h = 22 * s, top = 56 - h, L = 40 - w / 2, R = 40 + w / 2;
    const swirl = o.choc ? C.choc : C.serve;
    let out = `<path d="M${L - 1} ${top + 1} C${L} ${top - 12} ${R} ${top - 12} ${R + 1} ${top + 1} Z" fill="${swirl}"/><path d="M${L + 5} ${top - 4} q${w / 2 - 5} -8 ${w - 10} 0" fill="none" stroke="${o.choc ? '#8B5A3C' : '#EADFC8'}" stroke-width="1.6"/>`;
    out += `<path d="M${L} ${top} H${R} L${R - 3} 56 H${L + 3} Z" style="fill:${chainColor}"/><path d="M${L + 2} ${top + 5} H${R - 2}" stroke="rgba(255,255,255,.5)" stroke-width="1.4"/>`;
    return out;
  }
  function cone() {
    return `<path d="M30 30 L40 58 L50 30 Z" fill="${C.cone}"/><path d="M33 34 L47 34 M35 40 L45 40 M37 46 L43 46" stroke="${C.coneDk}" stroke-width="1"/><path d="M28 31 C28 18 52 18 52 31 Z" fill="${C.serve}"/><path d="M33 22 C35 12 45 12 47 22 Z" fill="${C.serve}"/><path d="M38 14 q2 -5 4 0" fill="${C.serve}" stroke="#EADFC8" stroke-width="1"/>`;
  }
  function pie() {
    return `<rect x="20" y="24" width="40" height="18" rx="5" fill="${C.pastry}"/><path d="M28 29 l4 8 M36 29 l4 8 M44 29 l4 8" stroke="${C.pastryDk}" stroke-width="1.6" stroke-linecap="round"/><path d="M22 41 H58" stroke="${C.pastryDk}" stroke-width="1"/>`;
  }
  function cookie() {
    let s = `<circle cx="40" cy="33" r="17" fill="${C.dough}"/>`;
    for (const [x, y] of [[33, 27], [44, 26], [38, 35], [48, 36], [31, 39], [42, 43]]) s += `<circle cx="${x}" cy="${y}" r="2" fill="${C.choc}"/>`;
    return s;
  }
  function muffin() {
    return `<path d="M27 36 H53 L50 55 H30 Z" fill="#E7DCC8"/><path d="M31 37 v17 M36 37 v18 M40 37 v18 M44 37 v18 M49 37 v17" stroke="#CDBFA6" stroke-width="1"/><path d="M24 37 C22 20 58 20 56 37 Z" fill="${C.dough}"/><circle cx="34" cy="29" r="1.6" fill="${C.choc}"/><circle cx="44" cy="27" r="1.6" fill="${C.choc}"/><circle cx="48" cy="32" r="1.6" fill="${C.choc}"/>`;
  }
  function donut() {
    return [[32, 36], [48, 29]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${C.dough}"/><circle cx="${x}" cy="${y}" r="3.5" class="plate"/><circle cx="${x - 4}" cy="${y - 4}" r="0.8" fill="#FFF3DA"/><circle cx="${x + 4}" cy="${y + 2}" r="0.8" fill="#FFF3DA"/><circle cx="${x + 1}" cy="${y - 6}" r="0.8" fill="#FFF3DA"/>`).join('');
  }
  function hotdog(o) {
    let s = `<rect x="12" y="27" width="56" height="9" rx="4.5" fill="#B5502F"/><rect x="16" y="28.5" width="48" height="1.6" rx="0.8" fill="#D2734F"/>`;
    if (o.cheese) s += `<path d="M18 30.5 h44" stroke="${C.cheese}" stroke-width="2.6" stroke-linecap="round"/>`;
    s += `<path d="M17 31 l4 -2.6 l4 2.6 l4 -2.6 l4 2.6 l4 -2.6 l4 2.6 l4 -2.6 l4 2.6 l4 -2.6 l4 2.6 l4 -2.6 l2 1.6" stroke="#E8C12E" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M15 33 H65 C65 44 58 47 40 47 C22 47 15 44 15 33 Z" fill="${C.bun}"/><path d="M19 37 H61" stroke="${C.bunShade}" stroke-width="1"/>`;
    return s;
  }

  return function draw(pic, chainColor, label) {
    const o = pic || {};
    let inner = '';
    switch (o.k) {
      case 'burger': inner = stack(o); break;
      case 'chicken': inner = stack({ ...o, p: 1 }, o.spicy ? C.spicy : o.grilled ? C.grill : C.chick); break;
      case 'wrap': inner = wrap(o); break;
      case 'nuggets': inner = nuggets(o); break;
      case 'strips': inner = strips(o, chainColor); break;
      case 'chfries': inner = box(chainColor, C.chick, Math.min(8, 3 + Math.round((o.n || 8) / 3)), 0.9 + (o.n || 8) / 80); break;
      case 'fries': inner = box(chainColor, C.fry, 7, o.s || 0.9); break;
      case 'rings': inner = rings(o); break;
      case 'mozz': inner = mozz(o); break;
      case 'sauce': inner = sauce(o); break;
      case 'fish': inner = stack({ ...o, p: o.p || 1, square: 1, cheese: 1 }, C.fish); break;
      case 'bsand': inner = bsand(o); break;
      case 'pancakes': inner = pancakes(); break;
      case 'hashbrown': inner = hashbrown(); break;
      case 'platter': inner = platter(); break;
      case 'poutine': inner = poutine(chainColor); break;
      case 'bowl': inner = bowl(chainColor); break;
      case 'potato': inner = potato(); break;
      case 'salad': inner = salad(); break;
      case 'cup': inner = cup(o, chainColor); break;
      case 'cone': inner = cone(); break;
      case 'pie': inner = pie(); break;
      case 'cookie': inner = cookie(); break;
      case 'muffin': inner = muffin(); break;
      case 'donut': inner = donut(); break;
      case 'hotdog': inner = hotdog(o); break;
      default: inner = '';
    }
    return wrapSvg(inner, label || 'Item picture');
  };
})();
