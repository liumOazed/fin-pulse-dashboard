"""
Regime detection: several independent detectors combined by a weighted vote.

Every detector takes a daily close series and returns a DataFrame indexed by date
with columns bull / neutral / bear (probabilities that sum to 1).

Look-ahead: each day's probabilities only use prices up to that day (HMM uses the
forward filter, the jump model uses the forward DP pass). The HMM / jump-model
*parameters* are fit once on the full history, the usual compromise for a daily
dashboard; it slightly flatters the history chart, not today's reading.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

STATES = ["bull", "neutral", "bear"]

# Equal weights until signal_log.csv has enough history to judge the models.
WEIGHTS = {"rules": 1.0, "hmm": 1.0, "jump": 1.0, "cross": 1.0}
MODEL_NAMES = {
    "rules": "Trend rules", "hmm": "Hidden Markov model",
    "jump": "Statistical jump model", "cross": "Cross-asset (US)",
}
HYSTERESIS = 0.20   # a new state must beat the current one by this much (or pass 50%) to flip the label
MIN_OBS = 500       # minimum daily closes to fit HMM / jump model
RELIABLE_OBS = 1500  # fewer closes than this -> flagged as less reliable


def _soft(labels, conf=0.8):
    """Hard labels -> probabilities (conf on the label, the rest split evenly)."""
    p = pd.DataFrame((1 - conf) / 2, index=labels.index, columns=STATES)
    for s in STATES:
        p.loc[labels == s, s] = conf
    return p


def _order(score):
    """State indices sorted bull -> neutral -> bear by a 'goodness' score."""
    return list(np.argsort(score)[::-1])


# --------------------------------------------------------------------------
# 1. Trend rules (own realised volatility instead of VIX so it works everywhere)
# --------------------------------------------------------------------------
def rules_model(close):
    r = np.log(close).diff()
    rv = r.rolling(21).std()
    sma50, sma200 = close.rolling(50).mean(), close.rolling(200).mean()
    trend = 50 * (close > sma200) + 25 * (sma50 > sma200) + 25 * (close > sma50)
    rv_pct = rv.rolling(252, min_periods=126).rank(pct=True)
    lab = pd.Series("neutral", index=close.index)
    lab[(trend >= 75) & (rv_pct < 0.8)] = "bull"
    lab[trend <= 25] = "bear"
    return _soft(lab[sma200.notna() & rv_pct.notna()])


# --------------------------------------------------------------------------
# 2. Gaussian HMM on daily return + short-term volatility, forward-filtered
# --------------------------------------------------------------------------
def hmm_model(close, n_states=3, seed=7):
    from hmmlearn.hmm import GaussianHMM
    from scipy.stats import multivariate_normal

    r = np.log(close).diff()
    X = pd.concat([r, np.log(r.rolling(10).std())], axis=1).dropna()
    X = X[np.isfinite(X).all(axis=1)]
    if len(X) < MIN_OBS:
        return None
    Z = ((X - X.mean()) / X.std()).values

    best = None
    for i in range(4):
        m = GaussianHMM(n_states, covariance_type="full", n_iter=200, random_state=seed + i)
        try:
            m.fit(Z)
            sc = m.score(Z)
        except Exception:
            continue
        if best is None or sc > best[0]:
            best = (sc, m)
    if best is None:
        return None
    m = best[1]

    ll = np.column_stack([
        multivariate_normal(m.means_[k], m.covars_[k], allow_singular=True).logpdf(Z)
        for k in range(n_states)
    ])
    alpha, prev = np.empty_like(ll), m.startprob_
    for t in range(len(ll)):
        pred = prev if t == 0 else prev @ m.transmat_
        a = np.log(pred + 1e-300) + ll[t]
        a = np.exp(a - a.max())
        prev = alpha[t] = a / a.sum()
    # bull = high return, low volatility
    order = _order(m.means_[:, 0] - m.means_[:, 1])
    return pd.DataFrame(alpha[:, order], index=X.index, columns=STATES)


# --------------------------------------------------------------------------
# 3. Statistical jump model (k-means with a penalty for switching state)
# --------------------------------------------------------------------------
def _jm_features(close):
    r = np.log(close).diff()
    dn = r.clip(upper=0) ** 2
    f = pd.concat({
        "m3": r.ewm(halflife=3).mean(), "m10": r.ewm(halflife=10).mean(),
        "dd5": np.sqrt(dn.ewm(halflife=5).mean()), "dd10": np.sqrt(dn.ewm(halflife=10).mean()),
        "v5": np.sqrt((r ** 2).ewm(halflife=5).mean()), "v10": np.sqrt((r ** 2).ewm(halflife=10).mean()),
    }, axis=1).iloc[21:].dropna()
    return f[np.isfinite(f).all(axis=1)]


def _jm_dp(Z, C, lam):
    """Forward DP values (causal) and the best full path."""
    D = ((Z[:, None, :] - C[None, :, :]) ** 2).sum(-1)
    T, K = D.shape
    V, back = np.empty((T, K)), np.zeros((T, K), dtype=int)
    V[0] = D[0]
    for t in range(1, T):
        stay, jump = V[t - 1], V[t - 1].min() + lam
        j = V[t - 1].argmin()
        better = stay <= jump
        back[t] = np.where(better, np.arange(K), j)
        V[t] = D[t] + np.where(better, stay, jump)
        V[t] -= V[t].min()
    s = np.empty(T, dtype=int)
    s[-1] = V[-1].argmin()
    for t in range(T - 1, 0, -1):
        s[t - 1] = back[t, s[t]]
    return V, s


def jump_model(close, n_states=3, lam=40.0, seed=7):
    f = _jm_features(close)
    if len(f) < MIN_OBS:
        return None
    Z = ((f - f.mean()) / f.std()).values
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(6):
        C = Z[rng.choice(len(Z), n_states, replace=False)].copy()
        s_prev = None
        for _ in range(30):
            V, s = _jm_dp(Z, C, lam)
            if s_prev is not None and (s == s_prev).all():
                break
            s_prev = s
            for k in range(n_states):
                if (s == k).any():
                    C[k] = Z[s == k].mean(0)
        cost = ((Z - C[s]) ** 2).sum() + lam * (np.diff(s) != 0).sum()
        if best is None or cost < best[0]:
            best = (cost, C.copy())
    C = best[1]
    V, _ = _jm_dp(Z, C, lam)
    w = np.exp(-V / (lam / 4))
    p = w / w.sum(1, keepdims=True)
    cols = list(f.columns)
    order = _order(C[:, cols.index("m10")] - C[:, cols.index("v10")])
    return pd.DataFrame(p[:, order], index=f.index, columns=STATES)


# --------------------------------------------------------------------------
# 4. Cross-asset model (US only): risk-on composite + VIX term structure
# --------------------------------------------------------------------------
def cross_model(ro_score, vix_ratio=None):
    s = ro_score.dropna()
    if len(s) < 60:
        return None
    bull = 1 / (1 + np.exp(-(s - 58) / 5))
    bear = 1 / (1 + np.exp(-(42 - s) / 5))
    if vix_ratio is not None:
        bear = bear * np.where(vix_ratio.reindex(s.index).ffill() > 1, 2.0, 1.0)
    neutral = (1 - bull - bear).clip(lower=0.05)
    p = pd.concat({"bull": bull, "neutral": neutral, "bear": bear}, axis=1)
    return p.div(p.sum(1), axis=0)


# --------------------------------------------------------------------------
# Combine
# --------------------------------------------------------------------------
def combine(models, index):
    """Weighted average of model probabilities + label with hysteresis."""
    avail = {k: v.reindex(index).ffill(limit=3) for k, v in models.items()
             if v is not None and len(v.dropna())}
    num = sum(v.fillna(0) * WEIGHTS[k] for k, v in avail.items())
    den = sum(v["bull"].notna() * WEIGHTS[k] for k, v in avail.items())
    avg = num.div(den.replace(0, np.nan), axis=0).dropna()
    labels, cur = [], None
    for row in avg[STATES].values:
        top = STATES[int(row.argmax())]
        lead = row[STATES.index(top)] - row[STATES.index(cur)] if cur else 1
        if lead >= HYSTERESIS or row.max() >= 0.5:
            cur = top
        labels.append(cur)
    return avg, pd.Series(labels, index=avg.index), avail


def detect(close, ro_score=None, vix_ratio=None, us=False):
    close = close.dropna()
    models = {"rules": rules_model(close)}
    for k, fn in (("hmm", hmm_model), ("jump", jump_model)):
        try:
            models[k] = fn(close)
        except Exception as e:  # one model failing must not drop the others
            print(f"regime: {k} failed: {e}")
            models[k] = None
    if us and ro_score is not None and len(ro_score):
        models["cross"] = cross_model(ro_score, vix_ratio)
    avg, labels, avail = combine(models, close.index)
    if avg.empty:
        return None

    last = labels.iloc[-1]
    since = labels.index[-1]
    for d, lab in zip(labels.index[::-1], labels.values[::-1]):
        if lab != last:
            break
        since = d
    votes = []
    for k, v in avail.items():
        row = v.dropna().iloc[-1]
        votes.append({"id": k, "name": MODEL_NAMES[k], "label": row.idxmax(),
                      "probs": {s: float(row[s]) for s in STATES}, "weight": WEIGHTS[k]})
    agree = sum(v["label"] == last for v in votes)
    tail = avg.tail(252)
    return {
        "label": last, "probs": {s: float(avg[s].iloc[-1]) for s in STATES},
        "since": since.strftime("%Y-%m-%d"), "asof": avg.index[-1].strftime("%Y-%m-%d"),
        "agree": agree, "n_models": len(votes), "models": votes, "n_obs": int(len(close)),
        "history": {
            "dates": [d.strftime("%Y-%m-%d") for d in tail.index],
            **{s: [round(float(x), 3) for x in tail[s]] for s in STATES},
            "label": list(labels.tail(252).values),
        },
    }
