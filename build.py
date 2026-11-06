# Merge researched card JSON files into cards.js
import json, sys, glob
cards = []
for f in sorted(glob.glob(sys.argv[1] + "/*.json")):
    cards += json.load(open(f))
ids = [c["id"] for c in cards]
assert len(ids) == len(set(ids)), "duplicate ids"
for c in cards:
    assert c["bank"] in "KBank SCB UOB BBL AMEX KTC Krungsri TTB GSB ICBC BOC AEON".split(), c["id"]
    for v in (c.get("earn") or {}).values():
        assert v is None or 1 <= v <= 1000, (c["id"], v)
open("cards.js", "w").write("window.CARDS = " + json.dumps(cards, ensure_ascii=False, indent=1) + ";\n")
print(len(cards), "cards")
