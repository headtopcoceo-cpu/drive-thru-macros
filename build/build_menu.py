"""Builds site/data/menu.json from the raw per-chain files. Run: python3 build_menu.py"""
import json, os, re
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, 'raw')
OLD = json.load(open(os.path.join(H, '..', 'tracker', 'data.json')))
old_by_id = {}
for m in OLD['menu']:
    old_by_id.setdefault(m['id'], {})[m['mode']] = m

def slug(s):
    s = s.lower().replace('&', 'and').replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def num(x):
    if x in ('', None): return None
    v = float(x); return int(v) if v == int(v) else round(v, 1)

def lines(fn):
    for ln in open(os.path.join(R, fn), encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln.strip() or ln.startswith('#'): continue
        yield ln.split('|')

# keep ids of items that existed before so logged meals can be re-ordered
KEEP = {
 ("McDonald's", 'Big Mac'): 'mcd-bigmac', ("McDonald's", 'Quarter Pounder with Cheese'): 'mcd-qpc', ("McDonald's", 'Quarter Pounder (no cheese)'): 'mcd-qp',
 ("McDonald's", 'McDouble'): 'mcd-mcdouble', ("McDonald's", 'Junior Chicken'): 'mcd-jrchicken',
 ("Wendy's", "Dave's Single"): 'wen-dave1', ("Wendy's", "Dave's Double"): 'wen-dave2', ("Wendy's", 'Double Stack'): 'wen-dstack',
 ("Wendy's", 'Spicy Chicken Sandwich'): 'wen-spicy', ("Wendy's", 'Crispy Chicken Sandwich (Jr crispy)'): 'wen-crispy', ("Wendy's", 'Grilled Chicken Wrap'): 'wen-gcwrap',
 ("Wendy's", 'Chicken Strips (3)'): 'wen-strips3', ("Wendy's", 'Chicken Strips (5)'): 'wen-strips5', ("Wendy's", 'Crispy Nuggets (6)'): 'wen-nug6',
 ("Wendy's", 'Kids fries'): 'wen-fries-k', ("Wendy's", 'Small fries'): 'wen-fries-s', ("Wendy's", 'Medium fries'): 'wen-fries-m', ("Wendy's", 'Large fries'): 'wen-fries-l',
 ("Harvey's", 'Angus Burger'): 'har-angus', ("Harvey's", 'Double Angus'): 'har-angus2', ("Harvey's", 'Original Burger'): 'har-orig', ("Harvey's", 'Double Original'): 'har-orig2',
 ("Harvey's", 'Junior Burger'): 'har-jr', ("Harvey's", 'Double Junior'): 'har-jr2', ("Harvey's", 'Triple Junior'): 'har-jr3', ("Harvey's", 'Crispy Chicken Sandwich'): 'har-crispy',
 ("Harvey's", 'Grilled Chicken Sandwich'): 'har-grilled', ("Harvey's", 'Chicken Strips (4)'): 'har-strips4', ("Harvey's", 'Chicken Strips (5)'): 'har-strips5',
 ("Harvey's", 'Kids fries'): 'har-fries-k', ("Harvey's", 'Regular fries'): 'har-fries-r', ("Harvey's", 'Large fries'): 'har-fries-l',
 ("Harvey's", 'Onion rings · Regular'): 'har-rings-r', ("Harvey's", 'Onion rings · Large'): 'har-rings-l',
 ('A&W', 'Mama Burger'): 'aw-mama', ('A&W', 'Mama Burger with cheese'): 'aw-mama-c', ('A&W', 'Spicy Habanero Chicken Burger'): 'aw-habanero',
 ('A&W', 'Spicy Chipotle Chicken Wrap'): 'aw-chipwrap', ('A&W', 'Kids fries'): 'aw-fries-k', ('A&W', 'Regular fries'): 'aw-fries-r',
 ('Burger King', 'Whopper'): 'bk-whopper', ('Burger King', 'Double Whopper'): 'bk-dwhopper', ('Burger King', 'Crispy Chicken Sandwich'): 'bk-crispy',
 ('Burger King', 'Chicken Nuggets (8)'): 'bk-nug8', ('Burger King', 'Chicken Fries (4)'): 'bk-chf4', ('Burger King', 'Chicken Fries (8)'): 'bk-chf8', ('Burger King', 'Chicken Fries (12)'): 'bk-chf12',
 ('Burger King', 'Mozzarella fries · 4 pc'): 'bk-mozz4', ('Burger King', 'Mozzarella fries · 8 pc'): 'bk-mozz8', ('Burger King', 'Mozzarella fries · 12 pc'): 'bk-mozz12',
 ('Burger King', 'Small fries'): 'bk-fries-s', ('Burger King', 'Medium fries'): 'bk-fries-m', ('Burger King', 'Large fries'): 'bk-fries-l',
}
PREFIX = {"McDonald's": 'mcd', "Wendy's": 'wen', "Harvey's": 'har', 'A&W': 'aw', 'Burger King': 'bk'}
CATMAP = {'Fish & veggie': 'More', 'Other': 'More'}

def pic_for(chain, name, cat):
    n = name.lower()
    if chain and (chain, name) in KEEP and KEEP[(chain, name)] in old_by_id:
        o = old_by_id[KEEP[(chain, name)]]; return next(iter(o.values()))['pic']
    def cnt():
        m = re.search(r'\((\d+)\)', n) or re.search(r'(\d+)[ -]?(?:pc|piece)', n)
        return int(m.group(1)) if m else 6
    size = 0.8 if 'small' in n or 'kids' in n or 'mini' in n else 1.05 if 'large' in n else 0.92
    if cat == 'Desserts':
        if 'cone' in n: return {'k': 'cone'}
        if 'pie' in n or 'turnover' in n: return {'k': 'pie'}
        if 'cookie' in n: return {'k': 'cookie'}
        if 'muffin' in n or 'cinnabon' in n: return {'k': 'muffin'}
        if 'donut' in n: return {'k': 'donut'}
        return {'k': 'cup', 'choc': 1 if 'chocolate' in n or 'fudge' in n or 'oreo' in n or 'hershey' in n or 'brownie' in n else 0, 's': 0.8 if 'jr' in n or 'small' in n else 1.0 if 'large' in n else 0.9}
    if cat == 'Salads': return {'k': 'salad'}
    if cat == 'Breakfast':
        if 'hash brown poutine' in n: return {'k': 'poutine'}
        if 'hash brown' in n: return {'k': 'hashbrown'}
        if 'hotcake' in n or 'pancake' in n: return {'k': 'pancakes'}
        if 'french toast' in n: return {'k': 'strips', 'n': 5 if '5' in n or '6' in n else 3, 'toast': 1}
        if 'wrap' in n or 'burrito' in n: return {'k': 'wrap'}
        if 'homestyle' in n or 'bacon & eggs' in n or 'special' in n: return {'k': 'platter'}
        bun = 'croissant' if 'croissan' in n else 'griddle' if 'griddle' in n else 'bagel' if 'bagel' in n else 'muffin'
        meat = 'sausage' if 'sausage' in n else 'bacon' if 'bacon' in n or 'blt' in n else 'chicken' if 'chicken' in n else ''
        return {'k': 'bsand', 'bun': bun, 'meat': meat, 'egg': 0 if ('egg' not in n and 'mighty' not in n and 'omelette' not in n) else 1, 'cheese': 1 if 'cheese' in n or 'mighty' in n or 'cheddar' in n or 'egger' in n else 0}
    if cat == 'Sides':
        if 'hash brown' in n: return {'k': 'hashbrown'}
        if 'poutine' in n or 'nacho' in n: return {'k': 'poutine'}
        if 'onion ring' in n or 'frings' in n: return {'k': 'rings', 'n': 3 if 'large' in n or 'frings' in n else 2}
        if 'mozzarella' in n or 'cheesy' in n or 'pickle' in n: return {'k': 'mozz', 'n': cnt() if cnt() <= 12 else 8}
        if 'chili' in n and 'fries' not in n: return {'k': 'bowl'}
        if 'potato' in n and 'sweet' not in n: return {'k': 'potato'}
        if 'snack box' in n: return {'k': 'fries', 's': 0.9}
        return {'k': 'fries', 's': size}
    if cat == 'More':
        if 'fish' in n: return {'k': 'fish', 'p': 2 if 'double' in n else 1}
        if 'hot dog' in n: return {'k': 'hotdog', 'cheese': 1 if 'cheese' in n else 0}
        return {'k': 'burger', 'p': 1, 'veggie': 1, 'veg': 'full', 'sesame': 1}
    if cat == 'Chicken':
        if 'nugget' in n: return {'k': 'nuggets', 'n': min(cnt(), 10)}
        if 'chicken fries' in n: return {'k': 'chfries', 'n': cnt()}
        if 'strip' in n: return {'k': 'strips', 'n': min(cnt(), 5)}
        spicy = 1 if re.search(r'spicy|buffalo|habanero|nashville|chipotle|korean|angry', n) else 0
        if 'wrap' in n: return {'k': 'wrap', 'spicy': spicy}
        o = {'k': 'chicken', 'spicy': spicy}
        if 'grilled' in n: o = {'k': 'chicken', 'grilled': 1}
        if re.search(r'jr|junior|buddy|snack', n): o['small'] = 1
        if re.search(r'deluxe|club|blt|cruncher|parmi|caesar', n): o['veg'] = 'full'
        elif not o.get('small'): o['veg'] = 'lettuce'
        return o
    # burgers
    p = 3 if re.search(r'triple|grandpa', n) else 2 if re.search(r'double|papa|big mac|mcdouble|baconator|bacon king|big harv|double stack|big king', n) else 1
    o = {'k': 'burger', 'p': p}
    if re.search(r'cheese|mozza|baconator|deluxe|big mac|mcdouble|melt|uncle|big king|qpc|bacon king|with cheese', n): o['cheese'] = 2 if 'quarter pounder' in n else 1
    if re.search(r'big mac|whopper|quarter pounder|teen|mama|papa|grandpa|mozza|angus|uncle|impossible|king', n): o['sesame'] = 1
    if re.search(r'jr|junior|buddy|baby|hamburger|cheeseburger|mcdouble|double stack|son of', n): o['small'] = 1; o['thin'] = 1
    if re.search(r'whopper|king', n) and 'jr' not in n: o['wide'] = 1
    if chain == "Wendy's": o['square'] = 1
    if re.search(r'whopper|dave|deluxe|teen|uncle|blt', n): o['veg'] = 'full'
    elif 'big mac' in n: o['veg'] = 'lettuce'; o['mid'] = 1
    elif re.search(r'mama|papa|grandpa', n): o['veg'] = 'onion'
    if re.search(r'quarter pounder|angus|teen|papa|grandpa|dave|baconator|king', n) and not o.get('small'): o['thick'] = 1
    return o

items = []
def add(chain, name, cat, price, cal, p, f, c, ns=None, psrc='store', basis='Official', pnote='', note='', nsbasis='Official, customized'):
    cat = CATMAP.get(cat, cat)
    iid = KEEP.get((chain, name)) or f"{PREFIX[chain]}-{slug(name)}"
    assert not any(i['id'] == iid for i in items), iid
    it = {'id': iid, 'chain': chain, 'name': name, 'cat': cat, 'cal': num(cal), 'p': num(p), 'f': num(f), 'c': num(c),
          'price': (round(float(price), 2) if price not in ('', None) else None), 'psrc': (psrc if price not in ('', None) else None), 'pnote': pnote, 'basis': basis, 'note': note, 'pic': pic_for(chain, name, cat)}
    if ns: it['ns'] = {'cal': num(ns[0]), 'p': num(ns[1]), 'f': num(ns[2]), 'c': num(ns[3]), 'removed': ns[4], 'basis': nsbasis}
    items.append(it)

# ---- McDonald's
mcd_ns = {r[0]: r for r in lines('mcd_ns.txt')}
MCD_PRICE = {'Big Mac': 8.69, 'Double Big Mac': None, 'Quarter Pounder with Cheese': 9.99, 'Quarter Pounder (no cheese)': 8.89, 'Double Quarter Pounder with Cheese': 11.89,
 'Double Quarter Pounder (no cheese)': 10.79, 'Quarter Pounder BLT': 9.99, 'Double Quarter Pounder BLT': 12.49, 'McDouble': 4.49, 'Hamburger': 3.49, 'Cheeseburger': 3.99,
 'Double Cheeseburger': 5.49, 'Double Hamburger': 4.29, 'Cheeseburger Deluxe': 4.39, 'Junior Chicken': 4.19, 'Sweet Chili Junior Chicken': 4.49, 'McChicken': 8.29,
 'McCrispy': 8.89, 'Spicy McCrispy': 9.49, 'McCrispy Bacon Deluxe': 10.89, 'Spicy Bacon Deluxe McCrispy': 11.29, 'Spicy Habanero McChicken': 8.99,
 'Grilled Chicken Sandwich': 8.99, 'Spicy Grilled Chicken Sandwich': 9.99, 'Bacon Deluxe Grilled Chicken Sandwich': 10.99, 'Spicy Bacon Deluxe Grilled Chicken Sandwich': 11.29,
 'Chicken & Bacon McWrap · Grilled': 9.99, 'Chicken & Bacon McWrap · Crispy': 9.99, 'Creamy Chipotle Chicken McWrap · Crispy': 9.99, 'Creamy Chipotle Chicken McWrap · Grilled': 9.99,
 'Sweet Chili McWrap · Crispy': 9.89, 'Sweet Chili McWrap · Grilled': 9.99, 'Ranch Chicken Snack Wrap · Crispy': 4.49, 'Ranch Chicken Snack Wrap · Grilled': 4.49,
 'Spicy Buffalo Chicken Snack Wrap · Crispy': 4.29, 'Spicy Buffalo Chicken Snack Wrap · Grilled': 4.29, 'McVeggie': 4.99, 'Spicy McVeggie': 4.99,
 'Filet-O-Fish': 7.89, 'Double Filet-O-Fish': 10.99, 'Poutine': 6.99, 'Hash Browns': 3.19,
 'Egg McMuffin': 5.49, 'Sausage McMuffin': 3.99, 'Chicken McMuffin': 5.29, "Bacon 'N Egg McMuffin": 5.69, "Sausage 'N Egg McMuffin": 5.39, "Egg 'N Cheese McMuffin": 5.09,
 'Egg BLT McMuffin': 6.39, 'Mighty McMuffin': 6.39, 'Hotcakes (plain)': 5.49, 'Hotcakes with Syrup and Butter': 5.49, 'Breakfast Burrito': 3.79, 'Sausage McGriddles': 4.89,
 'Chicken McGriddles': 4.79, "Egg 'N Cheese McGriddles": 4.99, 'Bacon, Egg & Cheese McGriddles': 6.19, 'Sausage, Egg & Cheese McGriddles': 6.29, 'Mighty McGriddles': 5.49,
 'English Muffin with Butter': 2.39, 'Plain Bagel with Butter': 2.49, 'Sesame Bagel with Butter': 2.49, 'Everything Bagel with Butter': 2.59,
 'Plain Bagel with Cream Cheese': 3.99, 'Sesame Bagel with Cream Cheese': 3.69, 'Everything Bagel with Cream Cheese': 3.69, 'Egg BLT Bagel (Sesame)': 6.99,
 'Egg BLT Bagel (Plain)': 7.99, 'Egg BLT Bagel (Everything)': 7.99, "Bacon 'N Egg Bagel (Sesame)": 6.39, "Sausage 'N Egg Bagel (Sesame)": 6.39,
 "Bacon 'N Egg Bagel (Plain)": 7.29, "Bacon 'N Egg Bagel (Everything)": 7.29, "Sausage 'N Egg Bagel (Plain)": 7.29, "Sausage 'N Egg Bagel (Everything)": 7.29,
 'Chicken Breakfast Wrap': 6.49, 'Sausage, Bacon & Egg Breakfast Wrap': 7.99, 'Spicy Egg & Hash Brown Breakfast Wrap': 6.49,
 'Vanilla Cone': 1.69, 'Hot Fudge Sundae': 3.99, 'Strawberry Sundae': 3.49, 'Hot Caramel Sundae': 3.89, 'Baked Strawberry Pie': 2.09, 'Baked Apple Pie': 1.99,
 'Oreo McFlurry': 5.99, 'Smarties McFlurry': 5.99, 'SKOR McFlurry': 5.99, 'Strawberry Cheesecake McFlurry': 4.99,
 'Carrot Muffin': 2.69, 'Blueberry Muffin': 2.69, 'Fruit & Fibre Muffin': 2.79, 'Chocolate Brownie Muffin': 2.69, 'Cranberry Orange Muffin': 2.79, 'Banana Chocolate Chunk Muffin': 2.79}
MCD_NOTE_NUG = 'Third-party prices for McNuggets disagree, so none is listed. Add what your app charges.'
for r in lines('mcd_base.txt'):
    iid, name, cat, cal, p, f, c = r
    ns = mcd_ns.get(iid)
    nsv = (ns[2], ns[3], ns[4], ns[5], ns[1].replace('Mayonnaise-Style Sauce', 'mayo-style sauce').replace('+', ', ').lower()) if ns else None
    pr = MCD_PRICE.get(name)
    pnote = MCD_NOTE_NUG if 'McNuggets' in name else ('' if pr else 'No reliable public price found. Add what your app charges.')
    add("McDonald's", name, cat, pr if pr else '', cal, p, f, c, nsv, psrc='approx', pnote=pnote)
# fries sizes + McDouble with extra patty from the earlier build
for oid, nm, pr in [('mcd-fries-mini', 'Mini fries', None), ('mcd-fries-s', 'Small fries', 3.09), ('mcd-fries-m', 'Medium fries', 4.99), ('mcd-fries-l', 'Large fries', 5.99)]:
    o = old_by_id[oid]['Plain']; items.append({'id': oid, 'chain': "McDonald's", 'name': nm, 'cat': 'Sides', 'cal': o['cal'], 'p': o['p'], 'f': o['f'], 'c': o['c'], 'price': pr, 'psrc': 'approx' if pr else None,
        'pnote': '' if pr else 'No reliable public price for Mini fries.', 'basis': 'Official', 'note': '', 'pic': o['pic']})
o = old_by_id['mcd-mcdouble-xp']; s, n = o['As served'], o['No sauce']
items.append({'id': 'mcd-mcdouble-xp', 'chain': "McDonald's", 'name': 'McDouble + extra patty', 'cat': 'Burgers', 'cal': s['cal'], 'p': s['p'], 'f': s['f'], 'c': s['c'], 'price': None, 'psrc': None,
    'pnote': 'The extra-patty charge isn’t listed anywhere public. Add what your app charges.', 'basis': 'Calculated', 'note': s['note'], 'pic': s['pic'],
    'ns': {'cal': n['cal'], 'p': n['p'], 'f': n['f'], 'c': n['c'], 'removed': 'mustard, ketchup', 'basis': 'Calculated'}})

# ---- Wendy's
for r in lines('wen.txt'):
    name, cat, price, cal, p, f, c, rem, nc, npp, nf, ncc, note = (r + [''] * 13)[:13]
    add("Wendy's", name, cat, price, cal, p, f, c, (nc, npp, nf, ncc, rem.lower().replace('+', ', ')) if nc else None, note=note)
# Dave's without cheese, from the earlier build (Wendy's own component data)
for oid, nm, pr in [('wen-dave1-nc', "Dave's Single (no cheese)", 7.59), ('wen-dave2-nc', "Dave's Double (no cheese)", 8.99)]:
    o = old_by_id[oid]; sv, nv = o['As served'], o['No sauce']
    items.append({'id': oid, 'chain': "Wendy's", 'name': nm, 'cat': 'Burgers', 'cal': sv['cal'], 'p': sv['p'], 'f': sv['f'], 'c': sv['c'], 'price': pr, 'psrc': 'store',
        'pnote': '', 'basis': 'Official', 'note': 'Same price as with cheese.', 'pic': sv['pic'],
        'ns': {'cal': nv['cal'], 'p': nv['p'], 'f': nv['f'], 'c': nv['c'], 'removed': 'ketchup, mayonnaise', 'basis': 'Official, customized'}})
# ---- Harvey's
for r in lines('har.txt'):
    name, cat, price, cal, p, f, c, note = (r + [''] * 8)[:8]
    pn = note if not price else ''
    add("Harvey's", name, cat, price, cal, p, f, c, None, pnote=pn, note='' if not price else note, basis='Calculated' if name in ('Triple Junior', 'Chicken Strips (5)') else 'Official')
# ---- A&W
EST = {'T': (90, 0, 10, 4), 't': (45, 0, 5, 2), 'M': (80, 0, 10, 1), 'm': (40, 0, 5, 0.5), 'W': (50, 0, 7, 1), 'W2': (100, 0, 14, 2)}
for r in lines('aw.txt'):
    name, cat, price, cal, p, f, c, est, rem, note = (r + [''] * 10)[:10]
    ns = None
    if est:
        d = EST[est]; ns = (float(cal) - d[0], float(p) - d[1], max(0, float(f) - d[2]), max(0, float(c) - d[3]), rem.lower())
    pn = 'No reliable public price found.' if not price else ''
    if name == 'Mama Burger with cheese': pn = note; note = ''
    add('A&W', name, cat, price, cal, p, f, c, ns, psrc='approx', pnote=pn, note=note, nsbasis='Estimate')
# ---- Burger King
for r in lines('bk.txt'):
    name, cat, price, cal, p, f, c, rem, nc, npp, nf, ncc, note = (r + [''] * 13)[:13]
    pn = '' if price else ('Breakfast prices aren’t shown in the evening menu.' if cat == 'Breakfast' else 'Not priced at the Lundy’s Lane store online.')
    add('Burger King', name, cat, price, cal, p, f, c, (nc, npp, nf, ncc, rem.lower().replace('+', ', ')) if nc else None, pnote=pn, note=note)

for it in items:
    if it.get('ns') and it['ns']['cal'] == it['cal']: del it['ns']
# salads are out of the app (Bobby's call, Oct 24 2026)
items = [it for it in items if it['cat'] != 'Salads']
# lettuce-wrapped burgers are out too (nobody orders them)
items = [it for it in items if 'lettuce-wrapped' not in it['name'].lower()]
SAUCES = OLD['sauces']
info = OLD.get('priceInfo', {})
info['pulled'] = 'October 23, 2026'
info['chains']["Wendy's"]['text'] = "Wendy's online ordering, 6948 McLeod Road, Niagara Falls."
out = {'version': '2026-10-23', 'items': items, 'sauces': SAUCES, 'priceInfo': info}
json.dump(out, open(os.path.join(H, 'site', 'data', 'menu.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(items), Counter(i['chain'] for i in items), Counter(i['cat'] for i in items))
print('with ns', sum(1 for i in items if i.get('ns')), 'priced', sum(1 for i in items if i['price']))
print(sorted(Counter(i['pic']['k'] for i in items).items()))
