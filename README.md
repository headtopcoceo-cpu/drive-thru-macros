# Drive-Thru Macros

No-sauce macros, pre-tax prices, Ontario deals and meal ideas for McDonald's, Wendy's, Harvey's, A&W and Burger King in Canada. It's an installable web app: open https://headtopcoceo-cpu.github.io/drive-thru-macros/ in Safari on an iPhone, tap Share, then Add to Home Screen.

- `index.html`, `js/`, `data/`, `sw.js`, `manifest.webmanifest`, `icons/`: the app (served by GitHub Pages).
- `data/menu.json`: 409 menu items with nutrition from each chain's own Canadian data and prices pulled October 23, 2026.
- `data/deals.json`: current deals, refreshed weekly.
- The Ideas tab opens with **Bob's Top 5s**: the best five orders at one restaurant and the best five across two, ranked on value (price per gram of protein), protein per 100 cal and lighter calories: two or more items from one restaurant, or a chicken item plus a burger from two, followed by Big Back Bob: your three go-to orders, scored the same way.
- `build/`: scripts and raw data used to build `data/menu.json` and the Claude-hosted copy of the page.

Your meal log stays on your phone. Save a backup under More now and then.
