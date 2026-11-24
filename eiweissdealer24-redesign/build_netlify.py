"""Baut den Netlify-Ordner (netlify/) und eine ZIP-Datei für Netlify Drop.
Start: python3 build_netlify.py
"""
import os, shutil, zipfile
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'netlify')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)

# Erlebnis-Seite wird Startseite, Shop-Prototyp wird shop.html
landing = open(os.path.join(here, 'landing.html'), encoding='utf-8').read()
landing = landing.replace('href="index.html#/', 'href="shop.html#/').replace('href="index.html"', 'href="shop.html"')
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(landing)

shop = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
shop = shop.replace('<a href="#/" class="logo" style="margin-bottom:16px">', '<a href="index.html" class="logo" style="margin-bottom:16px">')
open(os.path.join(out, 'shop.html'), 'w', encoding='utf-8').write(shop)

shutil.copytree(os.path.join(here, 'vendor'), os.path.join(out, 'vendor'))

# Nicht in Suchmaschinen aufnehmen (Konzept einer echten Marke)
open(os.path.join(out, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
open(os.path.join(out, '_headers'), 'w').write(
    '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Content-Type-Options: nosniff\n'
    '/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n')

# Für Deploys aus GitHub (Base directory: eiweissdealer24-redesign/netlify)
open(os.path.join(out, 'netlify.toml'), 'w').write('[build]\n  publish = "."\n  command = ""\n')

zp = os.path.join(here, '..', 'eiweissdealer24-netlify.zip')
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(out):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, out))
print('Ordner:', out)
print('ZIP:   ', os.path.abspath(zp), os.path.getsize(zp) // 1024, 'KB')
