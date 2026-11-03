#!/usr/bin/env python3
import re;from pathlib import Path
R=Path(__file__).resolve().parent.parent;css=(R/'src/style.css').read_text();css=re.sub(r'/\*.*?\*/','',css,flags=re.S);css=re.sub(r'\s*\n\s*','',css)
js=(R/'src/app.js').read_text();js='\n'.join(l.strip() for l in js.split('\n') if l.strip() and not l.strip().startswith('/*'))
h=(R/'src/index.html').read_text().replace('/*CSS*/',css).replace('/*JS*/',js);(R/'index.html').write_text(h);print('index.html',len(h.encode()),'bytes')
