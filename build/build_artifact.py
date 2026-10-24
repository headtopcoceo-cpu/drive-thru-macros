"""Makes artifact/page.html (the Claude-hosted version) from site/index.html."""
import os, re
H = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(H, 'site', 'index.html'), encoding='utf-8').read()
head = s[s.index('<head>') + 6:s.index('</head>')]
body = s[s.index('<body>') + 6:s.index('</body>')]
title = re.search(r'<title>.*?</title>', head).group(0)
style = head[head.index('<style>'):head.index('</style>') + 8]
fonts = '\n'.join(l for l in head.splitlines() if 'fonts.g' in l)
page = f'{title}\n<meta name="claude:viewport-fit-sides" content="cover">\n{fonts}\n{style}\n{body}'
os.makedirs(os.path.join(H, 'artifact'), exist_ok=True)
open(os.path.join(H, 'artifact', 'page.html'), 'w', encoding='utf-8').write(page)
print(len(page))
