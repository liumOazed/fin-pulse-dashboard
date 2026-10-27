"""Synthetic OHLCV data so the dashboard can be built/tested offline."""
import numpy as np
import pandas as pd


def make_sample(tickers, n=2600, seed=7):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n)
    tickers = list(tickers)
    k = len(tickers)
    market = rng.normal(0.0004, 0.010, n)
    out = {}
    for i, t in enumerate(tickers):
        beta = 0.6 + 0.8 * rng.random()
        idio = rng.normal(0, 0.007, n)
        r = beta * market + idio + 0.0001
        base = 20 + 300 * rng.random()
        if t in ("^VIX", "^VIX3M"):
            v = np.empty(n)
            v[0] = 17
            for j in range(1, n):
                v[j] = max(9, v[j - 1] + 0.08 * (17 - v[j - 1]) - 90 * market[j] * 0.1 + rng.normal(0, 0.7))
            if t == "^VIX3M":
                v = 0.5 * v + 0.5 * 19 + 1.5
            close = v
        else:
            close = base * np.exp(np.cumsum(r))
        op = close * (1 + rng.normal(0, 0.003, n))
        hi = np.maximum(op, close) * (1 + np.abs(rng.normal(0, 0.004, n)))
        lo = np.minimum(op, close) * (1 - np.abs(rng.normal(0, 0.004, n)))
        vol = (rng.lognormal(15, 0.35, n)).astype(float)
        out[t] = pd.DataFrame({"Open": op, "High": hi, "Low": lo, "Close": close, "Volume": vol}, index=idx)
    return out
