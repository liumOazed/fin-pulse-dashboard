"""
Sentiment tab data: everything here comes from free sources.

- Fear & Greed score: our own 0-100 composite of seven market inputs (Yahoo prices),
  modelled on CNN's index but computed from data the site already downloads.
- Options: SPY option chain snapshot (yfinance) + CBOE SKEW index. The chain has no
  history, so each run appends a row to data/sentiment_log.csv.
- Participants: CFTC Traders in Financial Futures report for E-mini S&P 500 futures
  (weekly, free public API). Asset managers ~ institutions, leveraged funds ~ hedge
  funds, dealers ~ banks, non-reportable ~ small / retail traders.
- AAII retail survey: free spreadsheet, but the site often blocks scripts. Skipped
  quietly when the download fails.

Any feed that fails keeps the previous run's numbers (with their own as-of date).
"""
from __future__ import annotations

import io
import json
import math
import urllib.request
from datetime import date

import numpy as np
import pandas as pd

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124 Safari/537.36"}
SENTIMENT_TICKERS = ["^GSPC", "^VIX", "^VIX3M", "^SKEW", "HYG", "IEF", "SPY", "TLT", "RSP"]
COT_URL = ("https://publicreporting.cftc.gov/resource/gpe5-46if.json?"
           "cftc_contract_market_code=13874A&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=170")
AAII_URL = "https://www.aaii.com/files/surveys/sentiment.xls"


def _list(s, nd=1):
    return [None if pd.isna(v) else round(float(v), nd) for v in s]


def _dates(idx):
    return [d.strftime("%Y-%m-%d") for d in idx]


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def roll_pct(s, n=252):
    """Rolling percentile (0-100) of each value within its trailing n values."""
    return s.rolling(n, min_periods=n // 2).apply(lambda w: (w <= w[-1]).mean() * 100, raw=True)


def fg_label(v):
    if v is None:
        return "–"
    return ("Extreme fear" if v < 25 else "Fear" if v < 45 else "Neutral" if v <= 55
            else "Greed" if v <= 75 else "Extreme greed")


def pos_label(score):
    return ("Bullish" if score >= 70 else "Slightly bullish" if score >= 55 else "Neutral" if score >= 45
            else "Cautious" if score >= 30 else "Bearish")


# --------------------------------------------------------------------------
# Fear & Greed composite
# --------------------------------------------------------------------------
def fear_greed(px, sector_closes):
    def c(t):
        return px[t]["Close"] if t in px else None

    spx, vix, vix3m, hyg, ief, spy, tlt = (c(t) for t in ("^GSPC", "^VIX", "^VIX3M", "HYG", "IEF", "SPY", "TLT"))
    comps = []

    def add(key, name, raw, score, text, note):
        if score is None or score.dropna().empty:
            return
        comps.append({"key": key, "name": name, "s": score, "text": text, "note": note,
                      "raw": raw})

    if spx is not None and len(spx) > 300:
        m = (spx / spx.rolling(125).mean() - 1) * 100
        add("momentum", "Market momentum", m, roll_pct(m),
            f"S&P 500 {m.iloc[-1]:+.1f}% vs 125D avg", "S&P 500 vs its 125-day average")
    if sector_closes is not None and not sector_closes.empty:
        near = (sector_closes / sector_closes.rolling(252, min_periods=120).max() * 100).mean(axis=1)
        add("strength", "Price strength", near, roll_pct(near),
            f"Sectors avg {100 - near.iloc[-1]:.1f}% below 52W high", "How close sector ETFs are to their 52-week highs")
        above = (sector_closes > sector_closes.rolling(50).mean()).mean(axis=1) * 100
        add("breadth", "Breadth", above, above.rolling(5).mean(),
            f"{above.iloc[-1]:.0f}% of sectors above 50D", "Share of the 11 sector ETFs above their 50-day average")
    if vix is not None and len(vix) > 300:
        v = vix / vix.rolling(50).mean()
        add("volatility", "Volatility", vix, 100 - roll_pct(v),
            f"VIX {vix.iloc[-1]:.1f} vs 50D avg {vix.rolling(50).mean().iloc[-1]:.1f}", "VIX vs its 50-day average (lower = greed)")
    if vix is not None and vix3m is not None:
        ts = (vix / vix3m).dropna()
        if len(ts) > 300:
            add("term", "Options fear", ts, 100 - roll_pct(ts),
                f"VIX/VIX3M {ts.iloc[-1]:.2f}" + (" (inverted)" if ts.iloc[-1] > 1 else ""),
                "Near-term vs 3-month implied volatility; above 1 = demand for short-term protection")
    if hyg is not None and ief is not None:
        cr = (hyg / ief).dropna()
        if len(cr) > 300:
            add("junk", "Junk bond demand", cr, roll_pct(cr),
                f"HYG/IEF {(cr.iloc[-1] / cr.iloc[-21] - 1) * 100:+.1f}% over 1M", "High-yield vs Treasury bonds")
    if spy is not None and tlt is not None:
        sh = ((spy.pct_change(20) - tlt.pct_change(20)) * 100).dropna()
        if len(sh) > 300:
            add("haven", "Safe-haven demand", sh, roll_pct(sh),
                f"Stocks {sh.iloc[-1]:+.1f} pts vs bonds over 20D", "20-day stock return minus Treasury return")

    if not comps:
        return None
    df = pd.concat({x["key"]: x["s"] for x in comps}, axis=1).ffill(limit=3)
    score = df.mean(axis=1, skipna=True).dropna()
    hist = score.tail(260)
    week = score.iloc[-6] if len(score) > 6 else None
    out = []
    for x in comps:
        s = x["s"].dropna()
        out.append({"key": x["key"], "name": x["name"], "score": float(s.iloc[-1]),
                    "label": fg_label(float(s.iloc[-1])), "text": x["text"], "note": x["note"],
                    "series": _list(s.tail(260), 1)})
    return {
        "score": float(score.iloc[-1]), "label": fg_label(float(score.iloc[-1])),
        "week_ago": None if week is None else float(week),
        "month_ago": float(score.iloc[-22]) if len(score) > 22 else None,
        "history": {"dates": _dates(hist.index), "values": _list(hist, 1)},
        "components": out,
    }


# --------------------------------------------------------------------------
# VIX / SKEW / credit series for tiles and the trend chart
# --------------------------------------------------------------------------
def vol_block(px, idx):
    out = {}
    for key, t in (("vix", "^VIX"), ("skew", "^SKEW")):
        if t not in px:
            continue
        s = px[t]["Close"].dropna()
        if len(s) < 30:
            continue
        p = roll_pct(s)
        out[key] = {"value": float(s.iloc[-1]), "week_ago": float(s.iloc[-6]),
                    "pctile": None if pd.isna(p.iloc[-1]) else float(p.iloc[-1]),
                    "series": _list(s.reindex(idx).ffill(), 2),
                    "inv": _list((100 - p).reindex(idx).ffill(), 1)}
    return out


# --------------------------------------------------------------------------
# Sector sentiment
# --------------------------------------------------------------------------
def sector_sentiment(sector_closes, sectors):
    def rsi(c, n=14):
        d = c.diff()
        up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
        dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
        return 100 - 100 / (1 + up / dn.replace(0, np.nan))

    rows = []
    for name, t in sectors.items():
        if name not in sector_closes:
            continue
        c = sector_closes[name].dropna()
        if len(c) < 260:
            continue
        s50, s200 = c.rolling(50).mean(), c.rolling(200).mean()
        trend = 50 * (c.iloc[-1] > s200.iloc[-1]) + 25 * (s50.iloc[-1] > s200.iloc[-1]) + 25 * (c.iloc[-1] > s50.iloc[-1])
        r63 = c.pct_change(63).dropna().tail(756)
        mom = float((r63 <= r63.iloc[-1]).mean() * 100)
        r = float(rsi(c).iloc[-1])
        score = 0.4 * trend + 0.3 * mom + 0.3 * r
        rows.append({"name": name, "ticker": t, "score": float(score), "label": pos_label(score),
                     "trend": float(trend), "momentum": mom, "rsi": r,
                     "r1m": float((c.iloc[-1] / c.iloc[-22] - 1) * 100),
                     "rets": {str(n): float((c.iloc[-1] / c.iloc[-1 - n] - 1) * 100) for n in (21, 63, 126, 252)}})
    return sorted(rows, key=lambda x: -x["score"])


# --------------------------------------------------------------------------
# Options snapshot (SPY chain)
# --------------------------------------------------------------------------
def options_snapshot(symbol="SPY", max_days=45):
    """Put/call volume summed over expiries in the next ~6 weeks. Volumes on Yahoo are
    the last session's, so the row is dated by the last close (both daily runs agree)."""
    import yfinance as yf

    t = yf.Ticker(symbol)
    h = t.history(period="5d")["Close"].dropna()
    session = h.index[-1].strftime("%Y-%m-%d")
    today = pd.Timestamp.today().normalize()
    exps = [e for e in t.options if 0 <= (pd.Timestamp(e) - today).days <= max_days][:15]
    cv = pv = coi = poi = 0.0
    for e in exps:
        ch = t.option_chain(e)
        cv += float(ch.calls["volume"].fillna(0).sum())
        pv += float(ch.puts["volume"].fillna(0).sum())
        coi += float(ch.calls["openInterest"].fillna(0).sum())
        poi += float(ch.puts["openInterest"].fillna(0).sum())
    if cv < 1000 or pv < 1000:
        return None
    return {"date": session, "symbol": symbol, "pc_vol": pv / cv,
            "pc_oi": poi / coi if coi > 1000 and poi > 1000 else None,
            "call_vol": cv, "put_vol": pv}


def sample_options(px):
    rng = np.random.default_rng(3)
    return {"date": date.today().isoformat(), "symbol": "SPY",
            "pc_vol": round(0.85 + rng.normal(0, .08), 3), "pc_oi": round(1.45 + rng.normal(0, .1), 3),
            "call_vol": 7.1e6, "put_vol": 6.0e6}


# --------------------------------------------------------------------------
# StockTwits: share of bullish-tagged posts in each symbol's latest stream
# --------------------------------------------------------------------------
SOCIAL_GROUPS = {
    "Index": ["SPY", "QQQ"],
    "Tech": ["NVDA", "AAPL", "MSFT", "AMZN", "TSLA", "GOOGL", "META", "AMD"],
    "Payments": ["MA", "V"],
    "Growth": ["ADME", "APP", "BKNG", "DECK", "EXPE", "FICO", "INCY", "INTU", "MKC"],
}


def _bull_share(msgs):
    tags = [((m.get("entities") or {}).get("sentiment") or {}).get("basic") for m in msgs]
    tags = [t for t in tags if t in ("Bullish", "Bearish")]
    return (sum(t == "Bullish" for t in tags) / len(tags) * 100, len(tags), len(msgs)) if len(tags) >= 3 else None


def _social_summary(rows, skipped):
    """Overall and per-group bullish share, weighting each ticker by its tagged posts."""
    def pooled(rs):
        t = sum(r["tagged"] for r in rs)
        return (sum(r["bull"] * r["tagged"] for r in rs) / t, t) if t else (None, 0)

    groups = []
    for g in SOCIAL_GROUPS:
        rs = [r for r in rows if r["group"] == g]
        if rs:
            b, t = pooled(rs)
            groups.append({"name": g, "bull": b, "tagged": t, "symbols": sorted(rs, key=lambda r: -r["bull"])})
    bull, tagged = pooled(rows)
    return {"asof": date.today().isoformat(), "bull": bull, "tagged": tagged, "groups": groups, "skipped": skipped}


def social_live():
    import time

    rows, skipped = [], []
    for g, syms in SOCIAL_GROUPS.items():
        for sym in syms:
            try:
                msgs = json.loads(_get(f"https://api.stocktwits.com/api/2/streams/symbol/{sym}.json")).get("messages", [])
                r = _bull_share(msgs)
            except Exception as e:
                print(f"stocktwits {sym}: {str(e)[:120]}")
                r = None
            if r:
                rows.append({"symbol": sym, "group": g, "bull": r[0], "tagged": r[1], "posts": r[2]})
            else:
                skipped.append(sym)
            time.sleep(1)
    if len(rows) < 5:
        return None
    return _social_summary(rows, skipped)


def sample_social():
    rng = np.random.default_rng(5)
    rows = [{"symbol": s, "group": g, "bull": float(np.clip(rng.normal(62, 14), 15, 100)), "tagged": int(rng.integers(4, 25)), "posts": 30}
            for g, syms in SOCIAL_GROUPS.items() for s in syms]
    return _social_summary(rows, [])


# --------------------------------------------------------------------------
# CFTC positioning
# --------------------------------------------------------------------------
GROUPS = [
    ("retail", "Small traders", "Retail", "nonrept_positions_long", "nonrept_positions_short"),
    ("inst", "Asset managers", "Institutions", "asset_mgr_positions_long", "asset_mgr_positions_short"),
    ("hedge", "Leveraged funds", "Hedge funds", "lev_money_positions_long", "lev_money_positions_short"),
    ("banks", "Dealers", "Banks", "dealer_positions_long", "dealer_positions_short"),
]


def _field(row, prefix):
    for k, v in row.items():
        if k.startswith(prefix) and "spread" not in k and "chg" not in k and "pct" not in k:
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
    return None


def cot_from_rows(rows):
    recs = []
    for r in rows:
        d = r.get("report_date_as_yyyy_mm_dd")
        oi = _field(r, "open_interest_all")
        if not d or not oi:
            continue
        rec = {"date": pd.Timestamp(d[:10])}
        for key, _, _, lp, sp in GROUPS:
            lo, sh = _field(r, lp), _field(r, sp)
            rec[key] = None if lo is None or sh is None else (lo - sh) / oi * 100
        recs.append(rec)
    if len(recs) < 30:
        return None
    df = pd.DataFrame(recs).drop_duplicates("date").set_index("date").sort_index()
    groups = []
    for key, cftc, who, _, _ in GROUPS:
        s = df[key].dropna()
        if len(s) < 30:
            continue
        w = s.tail(156)
        score = float((w <= w.iloc[-1]).mean() * 100)
        groups.append({"key": key, "who": who, "cftc": cftc, "score": score, "label": pos_label(score),
                       "net_pct": float(s.iloc[-1]), "chg": float(s.iloc[-1] - s.iloc[-2]),
                       "series": _list(s.tail(60), 2)})
    return {"asof": df.index[-1].strftime("%Y-%m-%d"), "market": "E-mini S&P 500 futures",
            "dates": _dates(df.index[-60:]), "groups": groups}


def cot_live():
    return cot_from_rows(json.loads(_get(COT_URL)))


def sample_cot():
    rng = np.random.default_rng(11)
    idx = pd.date_range(end=pd.Timestamp.today().normalize(), periods=170, freq="W-TUE")
    rows = []
    base = {"nonrept": 2.0, "asset_mgr": 25.0, "lev_money": -12.0, "dealer": -8.0}
    walk = {k: np.cumsum(rng.normal(0, 1.2, len(idx))) + v for k, v in base.items()}
    for i, d in enumerate(idx):
        r = {"report_date_as_yyyy_mm_dd": d.strftime("%Y-%m-%dT00:00:00.000"), "open_interest_all": "2000000"}
        for k in base:
            net = walk[k][i] / 100 * 2_000_000
            suffix = "_all" if k in ("nonrept", "dealer") else ""
            r[f"{k}_positions_long{suffix}"] = str(400_000 + max(net, 0))
            r[f"{k}_positions_short{suffix}"] = str(400_000 + max(-net, 0))
        rows.append(r)
    return cot_from_rows(rows)


# --------------------------------------------------------------------------
# AAII survey
# --------------------------------------------------------------------------
def aaii_live():
    raw = _get(AAII_URL)
    df = pd.read_excel(io.BytesIO(raw), header=None)
    recs = []
    for _, row in df.iterrows():
        d = pd.to_datetime(row.iloc[0], errors="coerce")
        try:
            b, n, s = (float(row.iloc[i]) for i in (1, 2, 3))
        except (TypeError, ValueError):
            continue
        if pd.isna(d) or any(map(math.isnan, (b, n, s))) or not 0.9 < b + n + s < 1.1:
            continue
        recs.append((d, b * 100, n * 100, s * 100))
    if len(recs) < 10:
        return None
    a = pd.DataFrame(recs, columns=["date", "bull", "neutral", "bear"]).set_index("date").sort_index().tail(60)
    return {"asof": a.index[-1].strftime("%Y-%m-%d"), "bull": float(a["bull"].iloc[-1]),
            "neutral": float(a["neutral"].iloc[-1]), "bear": float(a["bear"].iloc[-1]),
            "prev_bull": float(a["bull"].iloc[-2]), "series": _list(a["bull"], 1)}


def sample_aaii():
    rng = np.random.default_rng(9)
    bull = np.clip(37 + np.cumsum(rng.normal(0, 3, 60)) * .6, 15, 60)
    bear = np.clip(31 - (bull - 37) * .6 + rng.normal(0, 3, 60), 15, 55)
    return {"asof": date.today().isoformat(), "bull": float(bull[-1]), "neutral": float(100 - bull[-1] - bear[-1]),
            "bear": float(bear[-1]), "prev_bull": float(bull[-2]), "series": [round(float(x), 1) for x in bull]}


# --------------------------------------------------------------------------
# Daily log for snapshot-only feeds
# --------------------------------------------------------------------------
def daily_log(log_path, row, write):
    """Feeds without history (option chain, StockTwits) build one up here, one row per day."""
    cols = ["date", "pc_vol", "pc_oi", "social_bull"] + [f"social_{g.lower()}" for g in SOCIAL_GROUPS]
    old = pd.read_csv(log_path) if log_path.exists() else pd.DataFrame(columns=cols)
    for c in cols:
        if c not in old:
            old[c] = None
    if row:
        prev = old[old["date"] == row["date"]]
        merged = {k: (prev[k].iloc[0] if len(prev) else None) for k in cols}
        merged.update({k: v for k, v in row.items() if v is not None})
        old = pd.concat([old[old["date"] != row["date"]], pd.DataFrame([merged])], ignore_index=True).sort_values("date")
        if write:
            old[cols].to_csv(log_path, index=False)
    h = old.tail(260)
    return {k: (h[k].tolist() if k == "date" else _list(pd.to_numeric(h[k], errors="coerce"), 4)) for k in cols}


# --------------------------------------------------------------------------
# Plain-English notes
# --------------------------------------------------------------------------
def _ord(v):
    n = round(v)
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def watch_list(s):
    out = []
    fg = s.get("fg")
    if fg and fg.get("week_ago") is not None:
        d = fg["score"] - fg["week_ago"]
        if abs(d) >= 3:
            out.append(f"Fear & Greed {'rose' if d > 0 else 'fell'} {abs(d):.0f} points this week to {fg['score']:.0f} ({fg['label'].lower()}).")
        else:
            out.append(f"Fear & Greed is steady at {fg['score']:.0f} ({fg['label'].lower()}).")
        comps = sorted(fg["components"], key=lambda c: c["score"])
        if comps:
            lo, hi = comps[0], comps[-1]
            out.append(f"Most fearful input: {lo['name'].lower()} ({lo['score']:.0f}). Most greedy: {hi['name'].lower()} ({hi['score']:.0f}).")
    v = s.get("vol", {}).get("vix")
    if v:
        d = v["value"] - v["week_ago"]
        out.append(f"VIX is {'falling' if d < -0.3 else 'rising' if d > 0.3 else 'flat'} at {v['value']:.1f}"
                   + (f", {_ord(v['pctile'])} percentile of the past year." if v.get("pctile") is not None else "."))
    o = s.get("options")
    if o and o.get("pc_vol"):
        pc = o["pc_vol"]
        out.append(f"SPY put/call volume {pc:.2f}: " + ("more puts than calls, traders are hedging." if pc > 1.1
                   else "more calls than puts, traders lean bullish." if pc < 0.8 else "balanced between puts and calls."))
    cot = s.get("cot")
    if cot:
        inst = next((g for g in cot["groups"] if g["key"] == "inst"), None)
        hf = next((g for g in cot["groups"] if g["key"] == "hedge"), None)
        if inst:
            out.append(f"Asset managers are {inst['label'].lower()} on S&P futures ({_ord(inst['score'])} percentile of 3 years)"
                       + (f"; hedge funds {hf['label'].lower()}." if hf else "."))
    a = s.get("aaii")
    if a:
        out.append(f"AAII survey: {a['bull']:.0f}% of retail investors bullish, {a['bear']:.0f}% bearish"
                   + (f" (bulls {'up' if a['bull'] >= a['prev_bull'] else 'down'} from {a['prev_bull']:.0f}%)." if a.get("prev_bull") else "."))
    so = s.get("social")
    if so:
        gs = so.get("groups") or []
        if gs:
            hi, lo = max(gs, key=lambda g: g["bull"]), min(gs, key=lambda g: g["bull"])
            out.append(f"StockTwits posts lean {so['bull']:.0f}% bullish; {hi['name'].lower()} names are the most upbeat ({hi['bull']:.0f}%)"
                       + (f", {lo['name'].lower()} the least ({lo['bull']:.0f}%)." if lo is not hi else "."))
    sec = s.get("sectors") or []
    if len(sec) >= 3:
        out.append(f"Strongest sectors: {sec[0]['name']}, {sec[1]['name']}. Weakest: {sec[-1]['name']}.")
    return out[:6]


def mood(fg):
    if not fg:
        return None
    v, d = fg["score"], fg["score"] - (fg.get("week_ago") or fg["score"])
    if v < 25:
        t, x = "Extreme fear", "Investors are selling first and asking questions later. These stretches have often been near short-term lows."
    elif v < 45:
        t, x = ("Fear, easing" if d > 3 else "Fear"), ("Nerves are still high but the worst readings are fading." if d > 3
                                                         else "Traders are defensive: protection is in demand and risk appetite is thin.")
    elif v <= 55:
        t, x = ("Cautious optimism" if d > 0 else "Growing caution" if d < -3 else "Balanced"), (
            "Some demand is back, but mixed signals keep traders on edge." if d > 0 else
            "Confidence is slipping from recent levels." if d < -3 else "Neither fear nor greed has the upper hand.")
    elif v <= 75:
        t, x = "Confident", "Buyers are in control and volatility is contained. Watch for complacency if it keeps rising."
    else:
        t, x = "Euphoric", "Greed is running hot. Crowded optimism has often preceded pullbacks."
    return {"title": t, "text": x}


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
def build(px, sector_closes, sectors, data_dir, sample=False):
    prev = {}
    try:
        prev = json.loads((data_dir / "pulse.json").read_text()).get("sentiment") or {}
    except Exception:
        pass

    fg = fear_greed(px, sector_closes)
    idx = pd.to_datetime(fg["history"]["dates"]) if fg else pd.DatetimeIndex([])
    out = {"fg": fg, "mood": mood(fg), "vol": vol_block(px, idx),
           "sectors": sector_sentiment(sector_closes, sectors), "sources": {}}

    def attempt(key, live, fake):
        try:
            v = fake() if sample else live()
            if v:
                out["sources"][key] = "ok"
                return v
        except Exception as e:
            print(f"sentiment {key} failed: {str(e)[:200]}")
        if prev.get(key):
            out["sources"][key] = "stale"
            return prev[key]
        out["sources"][key] = "missing"
        return None

    out["options"] = attempt("options", options_snapshot, lambda: sample_options(px))
    out["cot"] = attempt("cot", cot_live, sample_cot)
    out["aaii"] = attempt("aaii", aaii_live, sample_aaii)
    out["social"] = attempt("social", social_live, sample_social)

    row = {}
    if out["sources"]["options"] == "ok":
        row.update(date=out["options"]["date"], pc_vol=out["options"]["pc_vol"], pc_oi=out["options"]["pc_oi"])
    if out["sources"]["social"] == "ok":
        row.setdefault("date", out["social"]["asof"])
        row["social_bull"] = out["social"]["bull"]
        row.update({f"social_{g['name'].lower()}": g["bull"] for g in out["social"]["groups"]})
    out["log"] = daily_log(data_dir / "sentiment_log.csv", row or None, write=not sample)
    out["watch"] = watch_list(out)
    return out
