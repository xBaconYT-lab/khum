# Merge researched card JSON files into cards.js
import json, sys, glob
cards = []
for f in sorted(glob.glob(sys.argv[1] + "/*.json")):
    cards += json.load(open(f))
ids = [c["id"] for c in cards]
assert len(ids) == len(set(ids)), "duplicate ids"
for c in cards:
    assert c["bank"] in "KBank SCB UOB BBL AMEX KTC Krungsri TTB GSB ICBC BOC AEON LOTUS".split(), c["id"]
    for v in (c.get("earn") or {}).values():
        assert v is None or 1 <= v <= 1000, (c["id"], v)
open("cards.js", "w").write("window.CARDS = " + json.dumps(cards, ensure_ascii=False, indent=1) + ";\n")
print(len(cards), "cards")

# bust browser/CDN cache so a rebuild shows up immediately
import hashlib, re
v = hashlib.md5(open("cards.js", "rb").read() + open("app.js", "rb").read() + open("style.css", "rb").read()).hexdigest()[:8]
html = open("index.html").read()
html = re.sub(r'(cards\.js|app\.js|style\.css)(\?v=\w+)?"', rf'\1?v={v}"', html)
open("index.html", "w").write(html)
