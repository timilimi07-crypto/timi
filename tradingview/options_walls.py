#!/usr/bin/env python3
"""Holt die Put- und Call-Walls von SPY und QQQ für den Freitags-Verfall
der laufenden Woche und gibt sie im Format für den TradingView-Indikator
"SPY/QQQ Options-Walls → ES/NQ" aus.

Quelle: CBOE Delayed Quotes (kostenlos, ohne Account, ca. 15 Min verzögert).
Open Interest wird von der OCC einmal täglich vor Handelsbeginn aktualisiert.

Nutzung:
    python3 options_walls.py                 # Freitag dieser Woche, OI > 20000
    python3 options_walls.py --min-oi 30000
    python3 options_walls.py --expiry 2026-11-20
    python3 options_walls.py --next          # Freitag der nächsten Woche

Am Wochenende wird automatisch der Freitag der kommenden Woche genommen.
Keine Zusatzpakete nötig (nur Python 3.8+).
"""
import argparse
import datetime as dt
import json
import re
import sys
import urllib.request

URL = "https://cdn.cboe.com/api/global/delayed_quotes/options/{}.json"
OCC = re.compile(r"^([A-Z]+)(\d{6})([CP])(\d{8})$")


def fetch(symbol):
    req = urllib.request.Request(URL.format(symbol), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]


def target_friday(today, next_week=False):
    # Mo–Fr → Freitag dieser Woche, Sa/So → Freitag der nächsten Woche
    days = (4 - today.weekday()) % 7
    fri = today + dt.timedelta(days=days)
    return fri + dt.timedelta(days=7) if next_week else fri


def parse_chain(data):
    """→ {expiry_date: {(strike, 'C'|'P'): open_interest}}"""
    chain = {}
    for o in data.get("options", []):
        m = OCC.match(o.get("option", ""))
        if not m:
            continue
        exp = dt.datetime.strptime(m.group(2), "%y%m%d").date()
        strike = int(m.group(4)) / 1000
        oi = int(o.get("open_interest") or 0)
        key = (strike, m.group(3))
        chain.setdefault(exp, {})
        chain[exp][key] = chain[exp].get(key, 0) + oi
    return chain


def pick_expiry(chain, friday):
    # Freitag; fällt er auf einen Feiertag, den letzten Verfall davor in derselben Woche
    monday = friday - dt.timedelta(days=4)
    week = [d for d in chain if monday <= d <= friday]
    return max(week) if week else None


def fmt_strike(k):
    return str(int(k)) if k == int(k) else f"{k:g}"


def walls_line(symbol, min_oi, friday):
    data = fetch(symbol)
    chain = parse_chain(data)
    exp = pick_expiry(chain, friday)
    if exp is None:
        raise SystemExit(f"{symbol}: kein Verfall in der Woche bis {friday} gefunden")
    rows = [(k, t, oi) for (k, t), oi in chain[exp].items() if oi > min_oi]
    calls = sorted((r for r in rows if r[1] == "C"), key=lambda r: -r[2])
    puts = sorted((r for r in rows if r[1] == "P"), key=lambda r: -r[2])
    parts = [exp.isoformat()] + [f"{fmt_strike(k)}{t}={oi}" for k, t, oi in calls + puts]
    return "; ".join(parts), data.get("current_price"), exp, calls, puts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--min-oi", type=int, default=20000, help="nur Strikes mit Open Interest über diesem Wert (Standard 20000)")
    ap.add_argument("--expiry", help="Verfall manuell, JJJJ-MM-TT")
    ap.add_argument("--next", action="store_true", help="Freitag der nächsten Woche")
    ap.add_argument("--symbols", default="SPY,QQQ")
    a = ap.parse_args()

    friday = dt.date.fromisoformat(a.expiry) if a.expiry else target_friday(dt.date.today(), a.next)

    for sym in a.symbols.upper().split(","):
        try:
            line, spot, exp, calls, puts = walls_line(sym, a.min_oi, friday)
        except Exception as e:  # noqa: BLE001
            print(f"{sym}: Fehler – {e}", file=sys.stderr)
            continue
        print(f"\n=== {sym}  (Kurs {spot}, Verfall {exp:%a %d.%m.%Y}, OI > {a.min_oi}) ===")
        print(f"  Call-Walls: " + (", ".join(f"{fmt_strike(k)} ({oi:,})" for k, _, oi in calls) or "keine"))
        print(f"  Put-Walls:  " + (", ".join(f"{fmt_strike(k)} ({oi:,})" for k, _, oi in puts) or "keine"))
        print(f"\n  → in TradingView ins Feld \"{sym} Walls\" einfügen:\n{line}")


if __name__ == "__main__":
    main()
