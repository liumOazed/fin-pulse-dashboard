"""
Pulse Dashboard - data builder.

Downloads prices with yfinance, computes every metric the dashboard shows, and
writes:
    data/pulse.json   (raw data)
    data/pulse.js     (same data as `window.PULSE_DATA = ...`, so index.html
                       also works when opened by double-click)
    data/signal_log.csv  (one row per day, for validating the score later)

Run locally:   python scripts/build_data.py
Demo data:     python scripts/build_data.py --sample
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# --------------------------------------------------------------------------
# Universe  (edit these to change what the dashboard tracks)
# --------------------------------------------------------------------------
PRIMARY = "SPY"  # asset used for trend / regime

# Global trend table + performance chart. Includes every Major markets index.
GLOBAL = {
    "S&P 500": "^GSPC",
    "Nasdaq": "^IXIC",
    "Dow Jones": "^DJI",
    "Euronext 100": "^N100",
    "Euro Stoxx 50": "^STOXX50E",
    "FTSE 100": "^FTSE",
    "Shanghai": "000001.SS",
    "Shenzhen": "399001.SZ",
    "Hang Seng": "^HSI",
    "Nikkei 225": "^N225",
    "Nifty 50": "^NSEI",
    "Straits Times": "^STI",
    "Tadawul": "^TASI.SR",
    "FTSE ADX": "FADGI.FGI",
}
REGION = {
    "S&P 500": "Americas", "Nasdaq": "Americas", "Dow Jones": "Americas",
    "Euronext 100": "Europe", "Euro Stoxx 50": "Europe", "FTSE 100": "Europe",
    "Shanghai": "Asia", "Shenzhen": "Asia", "Hang Seng": "Asia", "Nikkei 225": "Asia",
    "Nifty 50": "Asia", "Straits Times": "Asia", "Tadawul": "Middle East", "FTSE ADX": "Middle East",
}
BENCH_NAME = "S&P 500"

# Headline market cards at the top of Overview. Session hours are local exchange
# time; the browser uses them to show open / lunch break / closed.
MARKETS = [
    {"key": "spx", "name": "S&P 500", "ticker": "^GSPC", "exchange": "NYSE", "city": "New York",
     "tz": "America/New_York", "ccy": "USD", "sessions": [["09:30", "16:00"]]},
    {"key": "ixic", "name": "NASDAQ Composite", "ticker": "^IXIC", "exchange": "Nasdaq", "city": "New York",
     "tz": "America/New_York", "ccy": "USD", "sessions": [["09:30", "16:00"]]},
    {"key": "sse", "name": "Shanghai Composite", "ticker": "000001.SS", "exchange": "SSE", "city": "Shanghai",
     "tz": "Asia/Shanghai", "ccy": "CNY", "sessions": [["09:30", "11:30"], ["13:00", "15:00"]]},
    {"key": "n225", "name": "Nikkei 225", "ticker": "^N225", "exchange": "TSE", "city": "Tokyo",
     "tz": "Asia/Tokyo", "ccy": "JPY", "sessions": [["09:00", "11:30"], ["12:30", "15:30"]]},
    {"key": "hsi", "name": "Hang Seng", "ticker": "^HSI", "exchange": "HKEX", "city": "Hong Kong",
     "tz": "Asia/Hong_Kong", "ccy": "HKD", "sessions": [["09:30", "12:00"], ["13:00", "16:00"]]},
    {"key": "n100", "name": "Euronext 100", "ticker": "^N100", "exchange": "Euronext", "city": "Paris",
     "tz": "Europe/Paris", "ccy": "EUR", "sessions": [["09:00", "17:30"]]},
    {"key": "tasi", "name": "Tadawul All Share", "ticker": "^TASI.SR", "exchange": "Tadawul", "city": "Riyadh",
     "tz": "Asia/Riyadh", "ccy": "SAR", "sessions": [["10:00", "15:00"]],
     "days": ["Sun", "Mon", "Tue", "Wed", "Thu"]},
    {"key": "adx", "name": "FTSE ADX General", "ticker": "FADGI.FGI", "exchange": "ADX", "city": "Abu Dhabi",
     "tz": "Asia/Dubai", "ccy": "AED", "sessions": [["10:00", "15:00"]]},
    {"key": "nifty", "name": "Nifty 50", "ticker": "^NSEI", "exchange": "NSE", "city": "Mumbai",
     "tz": "Asia/Kolkata", "ccy": "INR", "sessions": [["09:15", "15:30"]]},
    {"key": "sti", "name": "Straits Times Index", "ticker": "^STI", "exchange": "SGX", "city": "Singapore",
     "tz": "Asia/Singapore", "ccy": "SGD", "sessions": [["09:00", "12:00"], ["13:00", "17:00"]]},
]

SECTORS = {
    "Technology": "XLK", "Financials": "XLF", "Health Care": "XLV",
    "Cons. Discretionary": "XLY", "Energy": "XLE", "Comm. Services": "XLC",
    "Industrials": "XLI", "Cons. Staples": "XLP", "Utilities": "XLU",
    "Real Estate": "XLRE", "Materials": "XLB",
}

# Price structure picker: every Major markets index (keyed by its card name) plus US ETFs
QUANT_ETFS = {"SPY": "S&P 500 ETF", "QQQ": "Nasdaq 100 ETF", "DIA": "Dow Jones ETF", "IWM": "Russell 2000 ETF"}
QUANT_TICKERS = list(QUANT_ETFS)
QUANT_DEFAULT = "S&P 500"

# Assets used in the correlation panel (cross-asset on purpose)
CORR = {
    "S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Nikkei": "^N225",
    "Euro Stoxx": "^STOXX50E", "FTSE": "^FTSE", "Hang Seng": "^HSI",
    "Nifty": "^NSEI", "Gold": "GLD", "Treasuries": "TLT",
    "Oil": "USO", "Dollar": "UUP", "Bitcoin": "BTC-USD",
}

RISK_EXTRA = ["XLY", "XLP", "HYG", "IEF", "RSP", "SPY", "^VIX", "^VIX3M", "CPER", "GLD"]

# Sentiment tab (scripts/sentiment.py): CBOE SKEW index plus tickers already above
SENTIMENT_EXTRA = ["^SKEW", "TLT"]

ALL_TICKERS = sorted(
    set(GLOBAL.values()) | set(SECTORS.values()) | set(QUANT_TICKERS)
    | set(CORR.values()) | set(RISK_EXTRA) | set(SENTIMENT_EXTRA) | {m["ticker"] for m in MARKETS} | {PRIMARY}
)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _clean(o):
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    return o


def _list(s, nd=4):
    return [None if pd.isna(v) else round(float(v), nd) for v in s]


def _dates(idx):
    return [d.strftime("%Y-%m-%d") for d in idx]


def pct_rank(s, v=None, n=252):
    """Percentile (0-100) of v (default: last value) within the last n values."""
    s = pd.Series(s).dropna().tail(n)
    if len(s) < 30:
        return None
    v = s.iloc[-1] if v is None else v
    return float((s <= v).mean() * 100)


def rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / dn.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def atr_pct(df, n=14):
    pc = df["Close"].shift()
    tr = pd.concat(
        [df["High"] - df["Low"], (df["High"] - pc).abs(), (df["Low"] - pc).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean() / df["Close"] * 100


def ret(c, n):
    return float(c.iloc[-1] / c.iloc[-1 - n] - 1) * 100 if len(c) > n else None


def closes(px, mapping):
    cols = {n: px[t]["Close"] for n, t in mapping.items() if t in px}
    return pd.concat(cols, axis=1).sort_index() if cols else pd.DataFrame()


# --------------------------------------------------------------------------
# Download
# --------------------------------------------------------------------------
# Fallbacks tried (in order) when a ticker fails in the batch download.
# KSA / UAE (iShares MSCI country ETFs, USD) stand in for Tadawul / ADX when Yahoo has no index feed.
ALTERNATES = {"^TASI.SR": ["TASI.SR", "^TASI.SR", "KSA"], "FADGI.FGI": ["FADGI.FGI", "UAE"]}
PROXY_CCY = {"KSA": "USD", "UAE": "USD"}
ALIASES_USED = {}


def _history(sym, period="10y", tries=3):
    import time
    import yfinance as yf

    for i in range(tries):
        try:
            df = yf.Ticker(sym).history(period=period, interval="1d", auto_adjust=True)
            df = df[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"])
            if len(df) > 60:
                df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
                return df
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None


def download(tickers, period="10y"):
    import yfinance as yf

    out = {}
    try:
        raw = yf.download(
            tickers, period=period, interval="1d", auto_adjust=True,
            group_by="ticker", progress=False, threads=True,
        )
        for t in tickers:
            try:
                df = raw[t][["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"])
                if len(df) > 60:
                    out[t] = df
            except Exception:
                continue
    except Exception as e:
        print("batch download failed:", e)
    # second chance: one-by-one with retries, then alternates
    for t in tickers:
        if t in out:
            continue
        for sym in ALTERNATES.get(t, [t]) if t in ALTERNATES else [t, t]:
            df = _history(sym, period)
            if df is not None:
                out[t] = df
                if sym != t:
                    ALIASES_USED[t] = sym
                    print(f"{t}: using {sym} instead")
                break
    return out


# --------------------------------------------------------------------------
# Panel 1 - Quant chart
# --------------------------------------------------------------------------
def quant_for(df):
    c = df["Close"]
    sma20, sma50, sma200 = (c.rolling(n).mean() for n in (20, 50, 200))
    sd = c.rolling(20).std()
    bb_up, bb_lo = sma20 + 2 * sd, sma20 - 2 * sd
    bw = (bb_up - bb_lo) / sma20 * 100
    vol_ma = df["Volume"].rolling(20).mean()
    rvol = df["Volume"] / vol_ma
    # Several index feeds (e.g. Euronext 100, Nifty) carry no volume, so VWAP and RVOL are skipped
    has_vol = bool((df["Volume"].tail(60) > 0).mean() >= 0.8)
    atr = atr_pct(df)
    r = rsi(c)

    tail = df.tail(252)
    idx = tail.index

    def avwap(anchor):
        sub = df.loc[anchor:]
        tp = (sub["High"] + sub["Low"] + sub["Close"]) / 3
        v = (tp * sub["Volume"]).cumsum() / sub["Volume"].cumsum().replace(0, np.nan)
        return v.reindex(idx)

    last = df.index[-1]
    ytd_candidates = df.index[df.index >= pd.Timestamp(year=last.year, month=1, day=1)]
    anchors = {
        "ytd": ytd_candidates[0] if len(ytd_candidates) else idx[0],
        "swing": df["Low"].tail(60).idxmin(),
        "hivol": df["Volume"].tail(120).idxmax(),
    }
    vwap = {k: _list(avwap(a), 2) for k, a in anchors.items()} if has_vol else {}

    bw_p = pct_rank(bw)
    return {
        "dates": _dates(idx),
        "open": _list(tail["Open"], 2), "high": _list(tail["High"], 2),
        "low": _list(tail["Low"], 2), "close": _list(tail["Close"], 2),
        "volume": _list(tail["Volume"], 0) if has_vol else None, "has_volume": has_vol,
        "sma50": _list(sma50.reindex(idx), 2), "sma200": _list(sma200.reindex(idx), 2),
        "bb_up": _list(bb_up.reindex(idx), 2), "bb_lo": _list(bb_lo.reindex(idx), 2),
        "vwap": vwap,
        "vwap_anchor": {k: a.strftime("%Y-%m-%d") for k, a in anchors.items()},
        "stats": {
            "atr_pct": float(atr.iloc[-1]), "atr_pctile": pct_rank(atr),
            "bandwidth": float(bw.iloc[-1]), "bw_pctile": bw_p,
            "squeeze": bool(bw_p is not None and bw_p <= 15),
            "rvol": None if not has_vol or pd.isna(rvol.iloc[-1]) else float(rvol.iloc[-1]),
            "rsi": float(r.iloc[-1]),
            "dist200": None if pd.isna(sma200.iloc[-1]) else float((c.iloc[-1] / sma200.iloc[-1] - 1) * 100),
            "close": float(c.iloc[-1]),
        },
    }


def price_structure(px):
    tickers = {}
    idx = [m for m in MARKETS if m["ticker"] in px and len(px[m["ticker"]]) > 210]
    for m in idx:
        proxy = ALIASES_USED.get(m["ticker"])
        tickers[m["name"]] = {**quant_for(px[m["ticker"]]), "label": m["name"] + (f" ({proxy} ETF)" if proxy else ""),
                              "symbol": proxy or m["ticker"], "ccy": PROXY_CCY.get(proxy, m["ccy"])}
    etfs = [t for t in QUANT_TICKERS if t in px]
    for t in etfs:
        tickers[t] = {**quant_for(px[t]), "label": f"{t} · {QUANT_ETFS[t]}", "symbol": t, "ccy": "USD"}
    groups = [g for g in (["Major markets", [m["name"] for m in idx]], ["US ETFs", etfs]) if g[1]]
    default = QUANT_DEFAULT if QUANT_DEFAULT in tickers else next(iter(tickers), None)
    return {"default": default, "groups": groups, "tickers": tickers}


# --------------------------------------------------------------------------
# Panel 2 - Global trend table + risk-on composite
# --------------------------------------------------------------------------
def global_table(px):
    rows = []
    for name, t in GLOBAL.items():
        if t not in px:
            continue
        c = px[t]["Close"]
        if len(c) < 210:
            continue
        sma50, sma200 = c.rolling(50).mean(), c.rolling(200).mean()
        dist = (c / sma200 - 1) * 100
        r126 = c.pct_change().tail(126)
        vol = r126.std() * math.sqrt(252) * 100
        r6 = ret(c, 126)
        rows.append({
            "name": name, "ticker": t, "region": REGION.get(name), "proxy": ALIASES_USED.get(t),
            "close": float(c.iloc[-1]),
            "dist200": float(dist.iloc[-1]), "dist200_pctile": pct_rank(dist),
            "state": "golden" if sma50.iloc[-1] > sma200.iloc[-1] else "death",
            "r1m": ret(c, 21), "r3m": ret(c, 63), "r6m": r6, "r12m": ret(c, 252),
            "volmom": (r6 / vol) if (r6 is not None and vol) else None,
            "rsi": float(rsi(c).iloc[-1]), "rsi_pctile": pct_rank(rsi(c)),
            "asof": c.index[-1].strftime("%Y-%m-%d"),
        })
    return rows


def risk_on(px):
    def ratio(a, b):
        return (px[a]["Close"] / px[b]["Close"]).dropna() if a in px and b in px else None

    comps = [
        ("Cyclicals vs Defensives (XLY/XLP)", ratio("XLY", "XLP"), +1, "Higher = risk-on"),
        ("High Yield vs Treasuries (HYG/IEF)", ratio("HYG", "IEF"), +1, "Higher = credit risk appetite"),
        ("Equal vs Cap-weight (RSP/SPY)", ratio("RSP", "SPY"), +1, "Higher = broader participation"),
        ("VIX level", px["^VIX"]["Close"] if "^VIX" in px else None, -1, "Lower = calmer"),
        ("VIX / VIX3M term structure", ratio("^VIX", "^VIX3M"), -1, ">1 = stress (backwardation)"),
        ("Copper vs Gold (CPER/GLD)", ratio("CPER", "GLD"), +1, "Higher = growth optimism"),
    ]
    z_cols, items = {}, []
    for name, s, sign, desc in comps:
        if s is None or len(s) < 150:
            continue
        z = (s - s.rolling(252, min_periods=120).mean()) / s.rolling(252, min_periods=120).std()
        z = (z * sign).clip(-3, 3)
        z_cols[name] = z
        items.append({"name": name, "z": float(z.dropna().iloc[-1]), "desc": desc,
                      "value": float(s.iloc[-1])})
    if not z_cols:
        return {"score": None, "components": [], "history": {"dates": [], "values": []}}, pd.Series(dtype=float)
    zdf = pd.concat(z_cols, axis=1).ffill(limit=3)
    comp = zdf.mean(axis=1, skipna=True).dropna()
    score = (50 + comp * 25).clip(0, 100)
    hist = score.tail(252)
    return {
        "score": float(score.iloc[-1]), "components": items,
        "history": {"dates": _dates(hist.index), "values": _list(hist, 1)},
    }, score


# --------------------------------------------------------------------------
# Panel 3 - Correlation
# --------------------------------------------------------------------------
def correlation(px):
    cl = closes(px, CORR).ffill(limit=3)
    # 2-day log returns reduce the time-zone mismatch between Asian/European
    # and US closes (they would otherwise look de-correlated).
    lr = np.log(cl).diff(2).dropna()
    if len(lr) < 120 or lr.shape[1] < 3:
        return None, pd.Series(dtype=float)

    c20 = lr.tail(20).corr()
    c90 = lr.tail(90).corr()

    order = list(c90.columns)
    try:
        from scipy.cluster.hierarchy import leaves_list, linkage
        from scipy.spatial.distance import squareform

        dist = np.sqrt(0.5 * (1 - c90.values.clip(-1, 1)))
        np.fill_diagonal(dist, 0)
        order = [c90.columns[i] for i in leaves_list(linkage(squareform(dist, checks=False), "average"))]
    except Exception:
        pass

    def avg_pair(m):
        v = m.values[np.triu_indices_from(m.values, k=1)]
        return float(np.nanmean(v))

    start = max(20, len(lr) - 252)
    dates, vals = [], []
    for i in range(start, len(lr) + 1):
        w = lr.iloc[i - 20:i]
        dates.append(w.index[-1])
        vals.append(avg_pair(w.corr()))
    avg = pd.Series(vals, index=dates)

    def mat(m):
        m = m.loc[order, order]
        return [[None if pd.isna(x) else round(float(x), 3) for x in row] for row in m.values]

    diff = (c20 - c90)
    return {
        "labels": order, "c20": mat(c20), "c90": mat(c90), "diff": mat(diff),
        "avg": {
            "dates": _dates(avg.index), "values": _list(avg, 3),
            "current": float(avg.iloc[-1]), "pctile": pct_rank(avg),
            "avg20": avg_pair(c20), "avg90": avg_pair(c90),
        },
    }, avg


# --------------------------------------------------------------------------
# Panel 4 - Sectors
# --------------------------------------------------------------------------
def sectors(px):
    cl = closes(px, {**SECTORS, "SPY": "SPY"}).ffill(limit=3)
    if "SPY" not in cl or cl.shape[1] < 4:
        return None
    names = [n for n in SECTORS if n in cl.columns]

    returns = {"labels": names}
    for key, n in (("1W", 5), ("1M", 21), ("3M", 63)):
        returns[key] = [ret(cl[nm].dropna(), n) for nm in names]

    weekly = cl.resample("W-FRI").last().dropna(how="all")
    wr = weekly.pct_change().dropna(how="all").tail(52)
    spy = wr["SPY"]
    beta = []
    for nm in names:
        y = wr[nm]
        d = pd.concat([spy, y], axis=1).dropna()
        d.columns = ["x", "y"]
        n = len(d)
        if n < 26:
            continue
        slope, icpt = np.polyfit(d["x"], d["y"], 1)
        resid = d["y"] - (slope * d["x"] + icpt)
        se = math.sqrt(resid.var(ddof=2) / (d["x"].var(ddof=1) * (n - 1)))
        r2 = float(np.corrcoef(d["x"], d["y"])[0, 1] ** 2)
        down = d[d["x"] < 0]
        dbeta = float(np.polyfit(down["x"], down["y"], 1)[0]) if len(down) >= 8 else None
        beta.append({
            "name": nm, "ticker": SECTORS[nm], "raw": float(slope),
            "blume": float(0.67 * slope + 0.33), "downside": dbeta,
            "r2": r2, "ci": float(1.96 * se * 0.67), "n": int(n),
        })

    # Relative Rotation Graph (weekly, 26w baseline)
    w2 = cl.resample("W-FRI").last().dropna(how="all").tail(130)
    rrg = []
    for nm in names:
        rs = (w2[nm] / w2["SPY"]).dropna()
        if len(rs) < 40:
            continue
        ratio = 100 * rs / rs.rolling(26).mean()
        mom = 100 * ratio / ratio.shift(4)
        d = pd.concat([ratio, mom], axis=1).dropna().tail(8)
        if d.empty:
            continue
        x, y = d.iloc[:, 0], d.iloc[:, 1]
        quad = ("Leading" if x.iloc[-1] >= 100 and y.iloc[-1] >= 100 else
                "Weakening" if x.iloc[-1] >= 100 else
                "Improving" if y.iloc[-1] >= 100 else "Lagging")
        rrg.append({"name": nm, "ticker": SECTORS[nm], "x": _list(x, 2), "y": _list(y, 2), "quadrant": quad})

    return {"returns": returns, "beta": beta, "rrg": rrg}


# --------------------------------------------------------------------------
# Panel 6 - Multi-index performance
# --------------------------------------------------------------------------
def multi(px, lookback=126):
    cl = closes(px, GLOBAL).ffill(limit=3).tail(lookback)
    if cl.empty:
        return None
    norm = cl.apply(lambda s: s / s.dropna().iloc[0] * 100 if s.notna().any() else s)
    out = {"dates": _dates(norm.index), "series": {}, "rs": {}}
    bench = norm.get(BENCH_NAME)
    for n in norm.columns:
        out["series"][n] = _list(norm[n], 2)
        if bench is not None:
            out["rs"][n] = _list(norm[n] / bench * 100, 2)
    return out


# --------------------------------------------------------------------------
# Panel 0 - Major market cards
# --------------------------------------------------------------------------
def markets(px):
    out = []
    for m in MARKETS:
        t = m["ticker"]
        if t not in px or len(px[t]) < 2:
            continue
        df = px[t].dropna(subset=["Close"])
        c = df["Close"]
        last, prev = df.iloc[-1], df.iloc[-2]
        y1 = df.tail(252)
        ytd = c[c.index >= pd.Timestamp(year=c.index[-1].year, month=1, day=1)]
        ytd_base = c[c.index < ytd.index[0]].iloc[-1] if len(ytd) and (c.index < ytd.index[0]).any() else None
        hi52, lo52 = float(y1["High"].max()), float(y1["Low"].min())
        proxy = ALIASES_USED.get(t)
        out.append({
            **{k: m[k] for k in ("key", "name", "ticker", "exchange", "city", "tz", "ccy", "sessions")},
            "days": m.get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"]),
            "proxy": proxy, "ccy": PROXY_CCY.get(proxy, m["ccy"]),
            "asof": c.index[-1].strftime("%Y-%m-%d"),
            "last": float(last["Close"]), "prev": float(prev["Close"]),
            "chg": float(last["Close"] - prev["Close"]),
            "chg_pct": float((last["Close"] / prev["Close"] - 1) * 100),
            "open": float(last["Open"]), "day_high": float(last["High"]), "day_low": float(last["Low"]),
            "hi52": hi52, "lo52": lo52,
            "from_hi52": float((last["Close"] / hi52 - 1) * 100),
            "ytd": float((c.iloc[-1] / ytd_base - 1) * 100) if ytd_base else None,
            "r1m": ret(c, 21),
            "spark": {"dates": _dates(y1.index), "close": _list(y1["Close"], 2)},
        })
    return out


# --------------------------------------------------------------------------
# Panel 1b - Regime ensemble for every market card
# --------------------------------------------------------------------------
US_MARKETS = {"spx", "ixic"}


def regimes(px, ro_series):
    from regime import detect

    vix_ratio = None
    if "^VIX" in px and "^VIX3M" in px:
        vix_ratio = (px["^VIX"]["Close"] / px["^VIX3M"]["Close"]).dropna()
    out = []
    for m in MARKETS:
        t = m["ticker"]
        if t not in px:
            continue
        try:
            r = detect(px[t]["Close"], ro_series, vix_ratio, us=m["key"] in US_MARKETS)
        except Exception as e:
            print(f"regime {t} failed: {e}")
            continue
        if r is None:
            continue
        proxy = ALIASES_USED.get(t)
        out.append({"key": m["key"], "name": m["name"], "ticker": t, "proxy": proxy,
                    "reliable": proxy is None and r["n_obs"] >= 1500, **r})
    counts = {s: sum(x["label"] == s for x in out) for s in ("bull", "neutral", "bear")}
    return {"markets": out, "counts": counts}


# --------------------------------------------------------------------------
# Panel 1c - Live signal per market (market-specific scores + regime)
# --------------------------------------------------------------------------
def comp_label(score):
    return "Risk-On" if score >= 62 else "Neutral" if score >= 45 else "Risk-Off"


def market_signals(px, regime_data, sc):
    vix = px["^VIX"]["Close"] if "^VIX" in px else None
    regs = {m["key"]: m for m in (regime_data or {}).get("markets", [])}
    out = []
    for m in MARKETS:
        t = m["ticker"]
        if t not in px or len(px[t]) < 210:
            continue
        c = px[t]["Close"].dropna()
        sma50, sma200 = c.rolling(50).mean(), c.rolling(200).mean()
        dist = (c / sma200 - 1) * 100
        trend = 50 * (c.iloc[-1] > sma200.iloc[-1]) + 25 * (sma50.iloc[-1] > sma200.iloc[-1]) + 25 * (c.iloc[-1] > sma50.iloc[-1])
        mom = pct_rank(c.pct_change(63).dropna(), n=756) or 50
        if m["key"] in US_MARKETS and vix is not None and len(vix) > 100:
            vp, vser = pct_rank(vix), vix
            vtxt = f"VIX {vix.iloc[-1]:.1f} · {vp:.0f}th pct"
        else:
            vser = c.pct_change().rolling(21).std() * math.sqrt(252) * 100
            vp = pct_rank(vser)
            vtxt = f"21D vol {vser.iloc[-1]:.1f}% · {vp:.0f}th pct" if vp is not None else "n/a"
        comps = [
            {"key": "trend", "name": "Trend", "score": float(trend),
             "text": f"{dist.iloc[-1]:+.1f}% vs 200D", "series": _list(dist.tail(252), 2),
             "note": "Price vs 200D and 50D moving averages"},
            {"key": "momentum", "name": "Momentum", "score": float(mom),
             "text": f"3M return {ret(c, 63):+.1f}%", "series": _list(c.tail(252), 2),
             "note": "3-month return percentile vs 3 years"},
            {"key": "volatility", "name": "Volatility", "score": float(100 - (vp if vp is not None else 50)),
             "text": vtxt, "series": _list(vser.tail(252), 2),
             "note": "Calm = high score (inverse percentile of volatility)"},
        ]
        rg = regs.get(m["key"])
        if rg:
            h = rg["history"]
            comps.append({
                "key": "regime", "name": "Regime", "score": 50 + 50 * (rg["probs"]["bull"] - rg["probs"]["bear"]),
                "text": f"{rg['agree']} of {rg['n_models']} models agree",
                "series": [round(50 + 50 * (b - e), 1) for b, e in zip(h["bull"][-252:], h["bear"][-252:])],
                "note": "50 + 50 x (P(bull) - P(bear)) from the regime consensus"})
        for x in comps:
            x["band"] = band(x["score"])
        composite = float(np.mean([x["score"] for x in comps]))
        out.append({
            "key": m["key"], "name": m["name"], "ticker": t, "proxy": ALIASES_USED.get(t),
            "close": float(c.iloc[-1]), "chg1d": float((c.iloc[-1] / c.iloc[-2] - 1) * 100),
            "rsi": float(rsi(c).iloc[-1]), "asof": c.index[-1].strftime("%Y-%m-%d"),
            "components": comps, "composite": composite, "label": comp_label(composite),
        })
    by_key = {x["key"]: x for x in sc["components"]}
    glob = [{**by_key[k], "name": n} for k, n in (("riskon", "Risk appetite"), ("diversification", "Diversification"),
                                                   ("breadth", "US sector breadth")) if k in by_key]
    return {"markets": out, "global": glob}


# --------------------------------------------------------------------------
# Panel 5 - Scorecard, regime
# --------------------------------------------------------------------------
def band(score):
    return "good" if score >= 60 else "mid" if score >= 40 else "bad"


def scorecard(px, ro_score, ro_data, avg_corr, sec_closes):
    spy = px[PRIMARY]["Close"]
    sma50, sma200 = spy.rolling(50).mean(), spy.rolling(200).mean()
    dist = (spy / sma200 - 1) * 100

    trend = 50 * (spy.iloc[-1] > sma200.iloc[-1]) + 25 * (sma50.iloc[-1] > sma200.iloc[-1]) + 25 * (spy.iloc[-1] > sma50.iloc[-1])
    r63 = spy.pct_change(63).dropna()
    mom = pct_rank(r63, n=756) or 50

    vix = px["^VIX"]["Close"] if "^VIX" in px else None
    if vix is not None and len(vix) > 100:
        vix_p = pct_rank(vix)
        vol_score, vol_txt, vol_series = 100 - vix_p, f"VIX {vix.iloc[-1]:.1f} · {vix_p:.0f}th pct", vix.tail(252)
    else:
        a = atr_pct(px[PRIMARY])
        vix_p = pct_rank(a)
        vol_score, vol_txt, vol_series = 100 - vix_p, f"ATR% {a.iloc[-1]:.2f} · {vix_p:.0f}th pct", a.tail(252)

    b50 = (sec_closes > sec_closes.rolling(50).mean()).mean(axis=1) * 100
    b200 = (sec_closes > sec_closes.rolling(200).mean()).mean(axis=1) * 100
    breadth_s = ((b50 + b200) / 2).dropna()
    breadth = float(breadth_s.iloc[-1]) if len(breadth_s) else 50.0

    if len(avg_corr):
        cp = pct_rank(avg_corr)
        div_score = 100 - (cp if cp is not None else 50)
        div_txt = f"Avg corr {avg_corr.iloc[-1]:.2f} · {cp:.0f}th pct" if cp is not None else f"Avg corr {avg_corr.iloc[-1]:.2f}"
        div_series = avg_corr.tail(252)
    else:
        div_score, div_txt, div_series = 50, "n/a", pd.Series(dtype=float)

    ro = ro_score.dropna() if len(ro_score) else pd.Series(dtype=float)
    ro_val = float(ro.iloc[-1]) if len(ro) else 50.0

    comps = [
        {"key": "trend", "name": "Trend", "score": float(trend),
         "text": f"{PRIMARY} {dist.iloc[-1]:+.1f}% vs 200D", "series": _list(dist.tail(252), 2),
         "note": "Price vs 200D and 50D moving averages"},
        {"key": "momentum", "name": "Momentum", "score": float(mom),
         "text": f"3M return {ret(spy, 63):+.1f}%", "series": _list(spy.tail(252), 2),
         "note": "3-month return percentile vs 3 years"},
        {"key": "volatility", "name": "Volatility", "score": float(vol_score), "text": vol_txt,
         "series": _list(vol_series, 2), "note": "Calm = high score (inverse percentile of VIX)"},
        {"key": "breadth", "name": "Breadth", "score": breadth,
         "text": f"{b50.iloc[-1]:.0f}% sectors > 50D · {b200.iloc[-1]:.0f}% > 200D",
         "series": _list(breadth_s.tail(252), 1), "note": "Share of S&P sectors above their moving averages"},
        {"key": "diversification", "name": "Diversification", "score": float(div_score),
         "text": div_txt, "series": _list(div_series, 3),
         "note": "Rising average correlation = diversification failing"},
        {"key": "riskon", "name": "Risk Appetite", "score": ro_val,
         "text": f"{len(ro_data.get('components', []))} cross-asset ratios",
         "series": _list(ro.tail(252), 1), "note": "Composite of cross-asset risk ratios"},
    ]
    for c in comps:
        c["band"] = band(c["score"])
    composite = float(np.mean([c["score"] for c in comps]))
    label = comp_label(composite)

    # Regime: simple, transparent rules
    above200 = spy.iloc[-1] > sma200.iloc[-1]
    golden = sma50.iloc[-1] > sma200.iloc[-1]
    stressed = vix_p is not None and vix_p >= 80
    if above200 and golden:
        regime = ("Uptrend · stressed" if stressed else "Uptrend", "bull" if not stressed else "mid")
    elif (not above200) and (not golden):
        regime = ("Downtrend", "bear")
    else:
        regime = ("Transition", "mid")
    detail = (f"{PRIMARY} {'above' if above200 else 'below'} 200D, "
              f"50D {'above' if golden else 'below'} 200D, VIX percentile "
              f"{'n/a' if vix_p is None else f'{vix_p:.0f}'}")
    return {
        "composite": composite, "label": label, "components": comps,
    }, {"label": regime[0], "tone": regime[1], "detail": detail}, vix_p, dist


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def compute(px, sample=False):
    if PRIMARY not in px:
        raise RuntimeError(f"{PRIMARY} data missing - aborting so existing data is kept.")
    missing = [t for t in ALL_TICKERS if t not in px]

    quant = price_structure(px)
    gtable = global_table(px)
    ro_data, ro_series = risk_on(px)
    corr_data, avg_corr = correlation(px)
    sec_data = sectors(px)
    multi_data = multi(px)
    markets_data = markets(px)
    regime_data = regimes(px, ro_series)

    sec_cl = closes(px, SECTORS).ffill(limit=3)
    sc, regime, vix_p, _ = scorecard(px, ro_series, ro_data, avg_corr, sec_cl)
    signals = market_signals(px, regime_data, sc)

    spy = px[PRIMARY]["Close"]
    asof = spy.index[-1].strftime("%Y-%m-%d")

    from sentiment import build as build_sentiment
    try:
        senti = build_sentiment(px, sec_cl, SECTORS, DATA_DIR, sample=sample)
    except Exception:
        import traceback
        traceback.print_exc()
        senti = None

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "asof": asof, "sample": bool(sample), "missing": missing, "aliases": ALIASES_USED, "version": 1,
        },
        "headline": {
            "ticker": PRIMARY, "close": float(spy.iloc[-1]),
            "chg1d": float((spy.iloc[-1] / spy.iloc[-2] - 1) * 100),
            "rsi": float(rsi(spy).iloc[-1]),
        },
        "regime": regime, "scorecard": sc, "markets": markets_data,
        "regimes": regime_data, "signals": signals,
        "multi": multi_data, "quant": quant, "globaltable": gtable,
        "riskon": ro_data, "corr": corr_data, "sectors": sec_data, "sentiment": senti,
    }


def append_signal_log(data):
    path = DATA_DIR / "signal_log.csv"
    row = {
        "date": data["meta"]["asof"], "composite": round(data["scorecard"]["composite"], 1),
        "label": data["scorecard"]["label"], "regime": data["regime"]["label"],
        "spy_close": round(data["headline"]["close"], 2),
    }
    for c in data["scorecard"]["components"]:
        row[c["key"]] = round(c["score"], 1)
    for m in (data.get("regimes") or {}).get("markets", []):
        row[f"reg_{m['key']}"] = m["label"]
        row[f"regp_{m['key']}"] = round(m["probs"][m["label"]], 3)
    new = pd.DataFrame([row])
    if path.exists():
        old = pd.read_csv(path)
        old = old[old["date"] != row["date"]]
        new = pd.concat([old, new], ignore_index=True)
    new.sort_values("date").to_csv(path, index=False)


def write(data):
    DATA_DIR.mkdir(exist_ok=True)
    payload = _clean(data)
    (DATA_DIR / "pulse.json").write_text(json.dumps(payload, separators=(",", ":")))
    (DATA_DIR / "pulse.js").write_text(
        "window.PULSE_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n"
    )


def main():
    sample = "--sample" in sys.argv
    sys.path.insert(0, str(Path(__file__).parent))
    if sample:
        from make_sample import make_sample
        px = make_sample(ALL_TICKERS)
    else:
        px = download(ALL_TICKERS)
        print(f"Downloaded {len(px)}/{len(ALL_TICKERS)} tickers")
    data = compute(px, sample=sample)
    write(data)
    if not sample:
        append_signal_log(data)
    print(f"OK  as-of {data['meta']['asof']}  composite {data['scorecard']['composite']:.1f} "
          f"({data['scorecard']['label']})  missing={len(data['meta']['missing'])}")


if __name__ == "__main__":
    main()
