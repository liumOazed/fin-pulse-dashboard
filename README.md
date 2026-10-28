# Pulse Dashboard

Static decision dashboard (GitHub Pages). A scheduled GitHub Action pulls prices (yfinance), computes everything in Python, writes `data/pulse.json` + `data/pulse.js`, and the browser draws it with Plotly.

Panels: Live signal + regime, Risk flags, Multi-index performance, Quant chart (anchored VWAP, Bollinger %B/bandwidth, ATR/RVOL), Global trend table, Risk-on composite, Correlation regime, Sectors (returns, stable beta, RRG).

## Quick look (no setup)
Unzip and double-click `index.html` (needs internet for the Plotly CDN). It ships with **sample data** (a banner says so).

## Publish at `https://<username>.github.io/<repo>/`
1. Unzip into your cloned empty repo (files at the repo root, including the hidden `.github` folder).
2. `git add . && git commit -m "Pulse dashboard" && git push origin main`
3. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions → "Update data & deploy" → Run workflow** (the first push may have run before step 3; rerun it). Real data replaces the sample after the first successful run; it then refreshes on weekdays.

If data fetch fails, the previous data is kept and the site still deploys.

## Run locally
```
pip install -r requirements.txt
python scripts/build_data.py            # real data
python scripts/build_data.py --sample   # offline synthetic data
```

## Tabs
`overview`, `signal` (Live signal), `sentiment` and `markets` (Risk appetite, Correlation, Sectors). Add a tab in `TABS` at the top of `assets/core.js`.

## Add a chart
1. Create `assets/panels/mychart.js`:
```js
Pulse.register({ id:'mychart', tab:'markets', order: 9, width:'half', title:'My chart', subtitle:'...',
  render(el, data, tools, state){ el.innerHTML='<div class="plot" style="height:300px"></div>';
    Pulse.plot(el.querySelector('.plot'), [{x:data.multi.dates, y:data.multi.series['S&P 500']}], Pulse.layout()); } });
```
2. Add `<script src="assets/panels/mychart.js"></script>` in `index.html`.
3. If it needs new numbers, compute them in `scripts/build_data.py` (`compute()`), add to the output dict.

## Live signal
One panel, driven by its own market picker. For the selected index it shows price, its regime consensus and a 0–100 composite = average of four market-specific scores: Trend, Momentum, Volatility (VIX for US indices, own 21D volatility elsewhere) and Regime (50 + 50 × (P(bull) − P(bear))). Risk appetite, Diversification and US sector breadth are cross-asset / US-only, so they are shown separately as a fixed "Global backdrop". `signal_log.csv` still logs the original six-part SPY composite.

## Market regime
`scripts/regime.py` labels each market card's index Bull / Neutral / Bear with up to four detectors, then averages their probabilities with the weights in `WEIGHTS` (equal for now):
- **Trend rules**: price vs 50D/200D averages plus the index's own realised-volatility percentile.
- **Hidden Markov model** (`hmmlearn`): 3 states on daily return and 10-day volatility, forward-filtered so each day only uses past prices.
- **Statistical jump model**: k-means on return/volatility features with a penalty for switching state (`lam`), so it flips less often.
- **Cross-asset** (US indices only): the risk-on composite, with extra bear weight when VIX/VIX3M > 1.

The label only flips when another state leads the current one by `HYSTERESIS` or passes 50%. HMM and jump-model parameters are fit once on the full 10-year history, which slightly flatters the history chart but not today's reading. Each day's labels are logged to `signal_log.csv` (`reg_<market>` / `regp_<market>`), so the weights can later be set from out-of-sample results.

## Sentiment
`scripts/sentiment.py` builds the Sentiment tab from free sources only:
- **Fear & Greed** (0–100): average of seven inputs, each ranked against its own past year: S&P 500 vs 125D average, sector distance from 52-week highs, share of sectors above 50D, VIX vs its 50D average, VIX/VIX3M, HYG/IEF and 20-day stocks-minus-bonds return. Modelled on CNN's index, computed from Yahoo prices.
- **Options**: SPY put/call volume and open interest from the option chain (yfinance), VIX, and the CBOE SKEW index.
- **Participants**: CFTC Traders in Financial Futures report for E-mini S&P 500 (weekly, public API). Small traders ≈ retail, asset managers ≈ institutions, leveraged funds ≈ hedge funds, dealers ≈ banks; each is ranked against its own 3 years.
- **AAII** weekly retail survey (spreadsheet download) and **StockTwits** bullish share for a few popular tickers.
- **Sectors**: each sector ETF's trend, 3-month momentum rank and RSI.

The option chain and StockTwits have no history, so each run writes a row to `data/sentiment_log.csv`. A feed that fails keeps the previous run's numbers and is marked "stale". News sentiment and dollar fund flows need a paid feed and are not shown. None of this feeds the Live signal score.

## Notes
- `data/signal_log.csv` records each day's composite/regime so you can later test whether signals predicted forward returns.
- Descriptive analytics, not investment advice. Sentiment data stays on its own tab and is not part of the Live signal score.
