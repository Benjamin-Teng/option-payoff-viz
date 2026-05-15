// ── TXO Settlement Date (3rd Wednesday of month, UTC+8 based) ──
function toDateStr(d) {
  // Format YYYY-MM-DD using local time components — avoids toISOString() UTC shift
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayUTC8() {
  // Return midnight Date in local representation of UTC+8 today
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate());
}

function getThirdWednesday(year, month) {
  const d = new Date(year, month, 1);
  let count = 0;
  while (count < 3) {
    if (d.getDay() === 3) count++;
    if (count < 3) d.setDate(d.getDate() + 1);
  }
  return d;
}

function getTXOSettlementDates() {
  const today = todayUTC8();
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonthSettlement = getThirdWednesday(y, m);

  let nearY, nearM;
  if (today >= thisMonthSettlement) {
    nearM = m + 1 > 11 ? 0 : m + 1;
    nearY = m + 1 > 11 ? y + 1 : y;
  } else {
    nearM = m;
    nearY = y;
  }

  const farM = nearM + 1 > 11 ? 0 : nearM + 1;
  const farY = nearM + 1 > 11 ? nearY + 1 : nearY;

  return {
    near: getThirdWednesday(nearY, nearM),
    far:  getThirdWednesday(farY,  farM)
  };
}

// ── Constants ──
const MAX_LEGS = 4;
const DEFAULT_SIGMA = 0.20;
const DEFAULT_R = 0.02;
const CHART_POINTS = 6000;
const TARGET_MAX_PNL = 300; // reference P&L at BASE_UNDERLYING
const BASE_UNDERLYING = 30000;

// ── State ──
const AppState = {
  underlyingPrice: null,
  legs: [],
  activePresetCategory: '2-Leg',
  chartInitialized: false,
  activeStrategyName: null
};

let legIdCounter = 0;
let userHasZoomed = false;
let _clamping = false;

// Ghost-value store: persists across renderLegs re-renders, keyed by "legId:field"
const ghostPrevValues = {};

// ── Utilities ──
function genId() { return 'leg_' + (++legIdCounter); }

function fmt(n, decimals = 2) {
  if (n === null || isNaN(n)) return '—';
  return n.toFixed(decimals);
}

function fmtChart(v) {
  if (v === null || isNaN(v)) return '—';
  return Math.abs(v) >= 10000 ? v.toFixed(0) : v.toFixed(2);
}

function getStrikeRange() {
  const S = AppState.underlyingPrice;
  if (S && S > 0) {
    const min  = Math.max(1, parseFloat((S * 0.05).toFixed(2)));
    const max  = parseFloat((S * 3.0).toFixed(2));
    const step = Math.max(0.01, parseFloat((S * 0.0001).toFixed(2)));
    return { min, max, step };
  }
  return { min: 1000, max: 80000, step: 10 };
}

function getPremiumMax() {
  const S = AppState.underlyingPrice;
  return S && S > 0 ? parseFloat((S * 0.12).toFixed(2)) : 2000;
}

function getPremiumStep() {
  const S = AppState.underlyingPrice;
  if (!S || S <= 0) return 1;
  const pmMax = getPremiumMax();
  return Math.max(0.01, parseFloat((pmMax * 0.001).toFixed(2)));
}

// ── P&L Calculation ──
function calcLegPnL(leg, S) {
  const { direction, type, strike: K, premium, expDate } = leg;
  if (K === null || K === undefined || premium === null || premium === undefined) return 0;

  if (expDate) {
    const today = todayUTC8();
    // Parse expDate as local midnight to avoid UTC offset shifting the day
    const [ey, em, ed] = expDate.split('-').map(Number);
    const exp = new Date(ey, em - 1, ed);
    const T = Math.max(0, (exp - today) / (365 * 24 * 60 * 60 * 1000));
    const price = type === 'call'
      ? bsCall(S, K, T, DEFAULT_R, DEFAULT_SIGMA)
      : bsPut(S, K, T, DEFAULT_R, DEFAULT_SIGMA);
    return direction === 'buy' ? price - premium : premium - price;
  }

  const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  return direction === 'buy' ? intrinsic - premium : premium - intrinsic;
}

function calcCombinedPnL(legs, S) {
  return legs.reduce((sum, leg) => sum + calcLegPnL(leg, S), 0);
}

// ── Breakeven Finder ──
function findBreakevens(prices, pnl) {
  // Cluster threshold: 0.2% of mid-price — absorbs BS numerical noise at any S scale
  const midPrice = (prices[0] + prices[prices.length - 1]) / 2;
  const minDist = midPrice * 0.002;

  // Use raw (unrounded) P&L for sign detection to avoid 2dp rounding creating
  // artificial flat zero regions that generate spurious enter/exit events
  const raw = [];
  for (let i = 0; i < pnl.length - 1; i++) {
    const a = pnl[i], b = pnl[i + 1];
    if ((a > 0) !== (b > 0)) {
      raw.push(prices[i] + (prices[i + 1] - prices[i]) * (-a) / (b - a));
    }
  }

  // Cluster nearby candidates and return their average
  const clusters = [];
  for (const bp of raw) {
    const last = clusters[clusters.length - 1];
    if (!last || bp - last.sum / last.n > minDist) {
      clusters.push({ sum: bp, n: 1 });
    } else {
      last.sum += bp;
      last.n += 1;
    }
  }

  // Round to 2dp only at output
  return clusters.map(c => Math.round(c.sum / c.n * 100) / 100);
}

// ── Chart Legend (desktop + mobile) ──
function renderMobileLegend(breakevens) {
  const el = document.getElementById('chart-legend-mobile');
  if (!el) return;

  const line = (color, dash = false) =>
    `<span style="display:inline-block;width:20px;height:${dash ? '0' : '2.5px'};` +
    `${dash ? `border-top:1.5px dashed ${color}` : `background:${color}`};vertical-align:middle"></span>`;
  const dot = color =>
    `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};vertical-align:middle"></span>`;

  const items = [
    { icon: line('#2563eb'),    label: '損益' },
    { icon: line('#94a3b8', true), label: '損益平衡線' },
  ];
  if (breakevens && breakevens.length > 0)
    items.push({ icon: dot('#16a34a'), label: '損益兩平' });
  if (AppState.underlyingPrice) {
    items.push({ icon: line('#f59e0b', true), label: '當前價格' });
    items.push({ icon: dot('#f59e0b'),        label: `損益 @ ${fmtChart(AppState.underlyingPrice)}` });
  }

  el.innerHTML = items.map(i =>
    `<span class="legend-item">${i.icon} ${i.label}</span>`
  ).join('');
}

// ── Chart ──
function updateChart() {
  const container = document.getElementById('payoff-chart');
  const validLegs = AppState.legs.filter(l => l.strike !== null && l.premium !== null);

  if (validLegs.length === 0) {
    if (AppState.chartInitialized) {
      Plotly.purge(container);
      AppState.chartInitialized = false;
      userHasZoomed = false;
    }
    container.innerHTML = '<div class="chart-placeholder">請至少新增一個含履約價與權利金的腳位，以顯示損益曲線。</div>';
    renderMobileLegend([]);
    updatePnlStats([], 0);
    return;
  }

  const S0 = AppState.underlyingPrice || (validLegs[0].strike || 22000);

  // Extended data range: 5% to 300% of S0 for deep OTM/ITM panning
  const dataMin = Math.max(1, S0 * 0.05);
  const dataMax = S0 * 3;
  const prices = [];
  const pnl = [];
  for (let i = 0; i <= CHART_POINTS; i++) {
    const S = dataMin + (dataMax - dataMin) * i / CHART_POINTS;
    prices.push(S);
    pnl.push(calcCombinedPnL(validLegs, S));
  }

  // Adaptive initial view: centre on strikes, buffer based on strike structure
  const strikes = validLegs.map(l => l.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const focusCenter = (minStrike + maxStrike) / 2;
  // structureSpan: the width of the strike layout (min 2% of S0 for ATM strategies)
  const structureSpan = Math.max(maxStrike - minStrike, S0 * 0.02);
  // buffer: 1.2× structure on each side, at least 5% of S0, capped at 20% of S0
  const viewBuffer = Math.min(
    Math.max(structureSpan * 1.2, S0 * 0.05),
    S0 * 0.20
  );
  let adaptiveXMin = Math.max(dataMin, focusCenter - viewBuffer);
  let adaptiveXMax = Math.min(dataMax, focusCenter + viewBuffer);

  // Expand view to include breakevens if they fall outside the structure-based view
  // (e.g. calendar/horizontal spreads where all strikes are at S0)
  const breakevens = findBreakevens(prices, pnl);
  if (breakevens.length > 0) {
    const beMin = Math.min(...breakevens);
    const beMax = Math.max(...breakevens);
    const beMargin = Math.max((beMax - beMin) * 0.2, S0 * 0.03);
    adaptiveXMin = Math.max(dataMin, Math.min(adaptiveXMin, beMin - beMargin));
    adaptiveXMax = Math.min(dataMax, Math.max(adaptiveXMax, beMax + beMargin));
  }

  // Y range computed over the final adaptive visible X region only
  const visPnl = prices
    .map((p, i) => (p >= adaptiveXMin && p <= adaptiveXMax ? pnl[i] : null))
    .filter(v => v !== null);
  const minVisiblePnL = visPnl.length ? Math.min(...visPnl) : Math.min(...pnl);
  const maxVisiblePnL = visPnl.length ? Math.max(...visPnl) : Math.max(...pnl);
  const padY = (maxVisiblePnL - minVisiblePnL) * 0.12 || 50;

  // Color the P&L line: green above zero, red below
  const traces = [
    {
      x: prices,
      y: pnl,
      type: 'scatter',
      mode: 'lines',
      name: '損益',
      line: { color: '#2563eb', width: 2.5 },
      customdata: prices.map((p, i) => [fmtChart(p), fmtChart(pnl[i])]),
      hovertemplate: '標的: %{customdata[0]}<br>損益: %{customdata[1]}<extra></extra>'
    },
    {
      x: [prices[0], prices[prices.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: '損益平衡線',
      line: { color: '#94a3b8', width: 1.3, dash: 'dash' },
      hoverinfo: 'skip'
    }
  ];

  if (breakevens.length > 0) {
    traces.push({
      x: breakevens,
      y: breakevens.map(() => 0),
      type: 'scatter',
      mode: 'markers+text',
      name: '損益兩平',
      marker: { color: '#16a34a', size: 10, symbol: 'circle', line: { color: '#fff', width: 2 } },
      text: breakevens.map(b => fmtChart(b)),
      textposition: 'top center',
      textfont: { color: '#16a34a', size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
      customdata: breakevens.map(b => fmtChart(b)),
      hovertemplate: '損益兩平: %{customdata}<extra></extra>'
    });
  }

  if (AppState.underlyingPrice) {
    const currentPnL = calcCombinedPnL(validLegs, AppState.underlyingPrice);
    traces.push({
      x: [AppState.underlyingPrice, AppState.underlyingPrice],
      y: [-1e9, 1e9],
      type: 'scatter',
      mode: 'lines',
      name: '當前價格',
      line: { color: '#f59e0b', width: 1.5, dash: 'dot' },
      hoverinfo: 'skip'
    });
    traces.push({
      x: [AppState.underlyingPrice],
      y: [currentPnL],
      type: 'scatter',
      mode: 'markers',
      name: `損益 @ ${fmtChart(AppState.underlyingPrice)}`,
      marker: { color: '#f59e0b', size: 8 },
      hovertemplate: `標的: ${fmtChart(AppState.underlyingPrice)}<br>損益: ${fmtChart(currentPnL)}<extra></extra>`
    });
  }

  const mobile = window.innerWidth < 640;
  const layout = {
    margin: { t: 16, r: 16, b: mobile ? 60 : 72, l: 60 },
    xaxis: {
      title: { text: mobile ? '到期價格' : '到期標的價格', font: { size: mobile ? 11 : 12 } },
      gridcolor: '#e2e8f0',
      zeroline: false,
      range: [adaptiveXMin, adaptiveXMax],
      autorange: false
    },
    yaxis: {
      title: { text: '損益', font: { size: mobile ? 11 : 12 } },
      gridcolor: '#e2e8f0',
      zeroline: true,
      zerolinecolor: '#94a3b8',
      zerolinewidth: 1,
      range: [minVisiblePnL - padY, maxVisiblePnL + padY],
      autorange: false
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f8fafc',
    showlegend: false,
    dragmode: 'pan',
    font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: 12 }
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    showTips: false,
    scrollZoom: true,
    doubleClick: false
  };

  container._dataRange = [dataMin, dataMax];

  if (AppState.chartInitialized) {
    if (userHasZoomed) {
      const fl = container._fullLayout;
      if (fl?.xaxis?.autorange === false) {
        layout.xaxis.range = fl.xaxis.range.slice();
      }
      if (fl?.yaxis?.autorange === false) {
        layout.yaxis.range = fl.yaxis.range.slice();
      }
    }
    Plotly.react(container, traces, layout, config);
  } else {
    container.innerHTML = '';
    Plotly.newPlot(container, traces, layout, config);
    AppState.chartInitialized = true;
    container.on('plotly_relayout', eventData => {
      if (_clamping) return;

      if ('xaxis.range[0]' in eventData || 'yaxis.range[0]' in eventData) {
        userHasZoomed = true;
      } else if (eventData['xaxis.autorange'] === true) {
        userHasZoomed = false;
      }

      if ('xaxis.range[0]' in eventData || 'xaxis.range[1]' in eventData) {
        const [dMin, dMax] = container._dataRange || [-Infinity, Infinity];
        const fl = container._fullLayout;
        if (!fl?.xaxis?.range) return;
        const x0 = fl.xaxis.range[0];
        const x1 = fl.xaxis.range[1];
        if (x0 < dMin || x1 > dMax) {
          _clamping = true;
          Plotly.relayout(container, {
            'xaxis.range': [Math.max(dMin, x0), Math.min(dMax, x1)]
          }).finally(() => { _clamping = false; });
        }
      }
    });
  }

  renderMobileLegend(breakevens);
  updatePnlStats(validLegs, S0);
}

// ── P&L Stats (Max Gain / Max Loss) ──
function calcPnlBounds(legs, S) {
  const expRange = S * 0.3;
  const pts = 1000;
  const pnlArr = [];
  for (let i = 0; i <= pts; i++) {
    pnlArr.push(calcCombinedPnL(legs, (S - expRange) + 2 * expRange * i / pts));
  }
  const pnlNearZero = calcCombinedPnL(legs, 0.0001);
  let hi = Math.max(Math.max(...pnlArr), pnlNearZero);
  let lo = Math.min(Math.min(...pnlArr), pnlNearZero);
  if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
  const netCallDir = legs.reduce((s, l) => l.type === 'call' ? s + (l.direction === 'buy' ? 1 : -1) : s, 0);
  return { hi, lo, netCallDir };
}

function applyPnlStats(gainEl, lossEl, gainLabelEl, lossLabelEl, hi, lo, netCallDir) {
  const fmt = v => (v >= 0 ? '+' : '') + fmtChart(v);

  // hi side: Max Gain (≥0) or Min Loss (<0, always losing)
  if (hi < 0) {
    gainLabelEl.textContent = '最小虧損';
    gainEl.textContent  = fmtChart(hi);
    gainEl.className    = 'pnl-stat-value pnl-loss';
  } else {
    gainLabelEl.textContent = '最大獲利';
    gainEl.textContent  = netCallDir > 0 ? '+∞' : fmt(hi);
    gainEl.className    = 'pnl-stat-value pnl-gain';
  }

  // lo side: Min Gain (>0, always gaining) or Max Loss (≤0)
  if (lo > 0) {
    lossLabelEl.textContent = '最小獲利';
    lossEl.textContent  = fmt(lo);
    lossEl.className    = 'pnl-stat-value pnl-gain';
  } else {
    lossLabelEl.textContent = '最大虧損';
    lossEl.textContent  = netCallDir < 0 ? '-∞' : fmtChart(lo);
    lossEl.className    = 'pnl-stat-value pnl-loss';
  }
}

function updatePnlStats(legs, S) {
  const gainEl      = document.getElementById('stat-max-gain');
  const lossEl      = document.getElementById('stat-max-loss');
  const gainLabelEl = document.getElementById('stat-max-gain-label');
  const lossLabelEl = document.getElementById('stat-max-loss-label');
  if (!gainEl || !lossEl) return;

  const reset = el => { el.textContent = '無'; el.className = 'pnl-stat-value pnl-none'; };

  if (!legs.length || !S) {
    reset(gainEl); reset(lossEl);
    if (gainLabelEl) gainLabelEl.textContent = '最大獲利';
    if (lossLabelEl) lossLabelEl.textContent = '最大虧損';
    return;
  }

  const { hi, lo, netCallDir } = calcPnlBounds(legs, S);
  applyPnlStats(gainEl, lossEl, gainLabelEl, lossLabelEl, hi, lo, netCallDir);
}

// ── Leg Rendering ──
function renderLegCard(leg, index) {
  const sr = getStrikeRange();
  const pmMax = getPremiumMax();
  const pmStep = getPremiumStep();
  const strikeVal = leg.strike !== null ? Number(leg.strike).toFixed(2) : '';
  const premiumVal = leg.premium !== null ? Number(leg.premium).toFixed(2) : '';
  const strikeSlider = leg.strike !== null ? leg.strike : parseFloat(((sr.min + sr.max) / 2).toFixed(2));
  const premiumSlider = leg.premium !== null ? leg.premium : 0;

  const strikeError = leg.touched && leg.strike === null;
  const premiumError = leg.touched && leg.premium === null;

  const expirySection = leg.showExpDate ? `
    <div class="expiry-row">
      <label>Expiry Date</label>
      <input type="date" class="expiry-input" data-field="expDate"
             value="${leg.expDate || ''}" min="${new Date().toISOString().split('T')[0]}">
      <span class="expiry-note">Used for BS pricing</span>
    </div>` : '';

  return `
    <div class="leg-card" data-leg-id="${leg.id}">
      <div class="leg-header">
        <span class="leg-number">Leg ${index + 1}</span>
        <div class="leg-toggles">
          <div class="toggle-group">
            <button class="toggle-btn ${leg.direction === 'buy' ? 'active-buy' : ''}"
                    data-field="direction" data-value="buy">Buy</button>
            <button class="toggle-btn ${leg.direction === 'sell' ? 'active-sell' : ''}"
                    data-field="direction" data-value="sell">Sell</button>
          </div>
          <div class="toggle-group">
            <button class="toggle-btn ${leg.type === 'call' ? 'active-call' : ''}"
                    data-field="type" data-value="call">Call</button>
            <button class="toggle-btn ${leg.type === 'put' ? 'active-put' : ''}"
                    data-field="type" data-value="put">Put</button>
          </div>
        </div>
        <button class="btn-delete-leg" data-leg-id="${leg.id}" title="Remove leg">✕</button>
      </div>

      <div class="slider-row">
        <span class="slider-label">履約價</span>
        <input type="range" class="leg-slider" data-field="strike"
               min="${sr.min}" max="${sr.max}" step="${sr.step}" value="${strikeSlider}">
        <div class="number-input-wrap">
          <input type="number" class="leg-number-input ${strikeError ? 'error' : ''}"
                 data-field="strike" value="${strikeVal}"
                 placeholder="—" min="0" step="${sr.step}">
          ${strikeError ? '<span class="error-icon">!</span>' : ''}
        </div>
      </div>

      <div class="slider-row">
        <span class="slider-label">權利金</span>
        <input type="range" class="leg-slider" data-field="premium"
               min="0" max="${pmMax}" step="${pmStep}" value="${premiumSlider}">
        <div class="number-input-wrap">
          <input type="number" class="leg-number-input ${premiumError ? 'error' : ''}"
                 data-field="premium" value="${premiumVal}"
                 placeholder="—" min="0" step="${pmStep}">
          ${premiumError ? '<span class="error-icon">!</span>' : ''}
        </div>
      </div>

      ${expirySection}
    </div>`;
}

function renderLegs() {
  const container = document.getElementById('legs-container');
  const count = document.getElementById('leg-count');
  const addBtn = document.getElementById('add-leg-btn');
  const clearBtn = document.getElementById('clear-legs-btn');

  container.innerHTML = AppState.legs.length > 0
    ? AppState.legs.map((leg, i) => renderLegCard(leg, i)).join('')
    : '<div style="font-size:13px;color:#94a3b8;padding:8px 0;">尚未新增腳位，請點擊 <strong>+ Add Leg</strong> 或從下方選擇策略。</div>';
  count.textContent = `(${AppState.legs.length}/${MAX_LEGS})`;
  addBtn.disabled = AppState.legs.length >= MAX_LEGS;
  clearBtn.disabled = AppState.legs.length === 0;

  bindLegEvents();
}

// ── Leg Events ──
function bindLegEvents() {
  const container = document.getElementById('legs-container');

  container.querySelectorAll('.btn-delete-leg').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.legs = AppState.legs.filter(l => l.id !== btn.dataset.legId);
      AppState.activeStrategyName = null;
      renderLegs();
      updateChart();
    });
  });

  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      leg[btn.dataset.field] = btn.dataset.value;
      renderLegs();
      updateChart();
    });
  });

  container.querySelectorAll('.leg-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const card = slider.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const val = parseFloat(slider.value);
      leg[slider.dataset.field] = val;
      // Sync number input without full re-render
      const numInput = card.querySelector(`.leg-number-input[data-field="${slider.dataset.field}"]`);
      if (numInput) numInput.value = parseFloat(val.toFixed(2));
      updateChart();
    });
  });

  container.querySelectorAll('.leg-number-input').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value === '') return;
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const val = parseFloat(input.value);
      if (isNaN(val)) return;
      leg[input.dataset.field] = val;
      updateChart();
    });

    input.addEventListener('change', () => {
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const field = input.dataset.field;
      const ghostKey = `${leg.id}:${field}`;
      // Ghost restore: if empty and prev value exists, restore instead of nulling
      if (input.value === '' && ghostPrevValues[ghostKey] != null) {
        input.value = ghostPrevValues[ghostKey];
      }
      const val = input.value === '' ? null : parseFloat(input.value);
      if (val !== null) ghostPrevValues[ghostKey] = String(val);
      leg[field] = val;
      leg.touched = true;
      if (val !== null) {
        const slider = card.querySelector(`.leg-slider[data-field="${field}"]`);
        if (slider) slider.value = val;
      }
      renderLegs();
      updateChart();
    });

    input.addEventListener('blur', () => {
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const field = input.dataset.field;
      const ghostKey = `${leg.id}:${field}`;
      let needsUpdate = false;
      // Ghost restore: change event may not fire if value was '' when focused
      if (input.value === '' && ghostPrevValues[ghostKey] != null) {
        const val = parseFloat(ghostPrevValues[ghostKey]);
        if (!isNaN(val)) {
          leg[field] = val;
          const slider = card.querySelector(`.leg-slider[data-field="${field}"]`);
          if (slider) slider.value = val;
          needsUpdate = true;
        }
      } else if (input.value !== '') {
        ghostPrevValues[ghostKey] = input.value;
      }
      leg.touched = true;
      renderLegs();
      if (needsUpdate) updateChart();
    });
  });

  container.querySelectorAll('.expiry-input').forEach(input => {
    input.addEventListener('change', () => {
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (leg) { leg.expDate = input.value || null; updateChart(); }
    });
  });
}

// ── Bounded Preset Computation ──
function computeBoundedLegs(preset, S) {
  const ratio = S / BASE_UNDERLYING;
  const target = TARGET_MAX_PNL * ratio; // linear scale: S=30000→300, S=100→1
  const settlements = getTXOSettlementDates();
  const today = todayUTC8();

  const legData = preset.legs.map(l => {
    // Scale strikeOffset proportionally so 600pt@30000 = 2% at any S
    const scaledOffset = (l.strikeOffset || 0) * ratio;
    const rawStrike = S + scaledOffset;
    const strike = parseFloat(rawStrike.toFixed(2));

    let T = 30 / 365;
    let expDate = null;
    if (l.needsExpDate) {
      const settlementDate = (l.expMonths || 1) === 1 ? settlements.near : settlements.far;
      expDate = toDateStr(settlementDate);
      const [ey, em, ed] = expDate.split('-').map(Number);
      const exp = new Date(ey, em - 1, ed);
      T = Math.max(1 / 365, (exp - today) / (365 * 24 * 60 * 60 * 1000));
    }

    const rawPremium = l.type === 'call'
      ? bsCall(S, strike, T, DEFAULT_R, DEFAULT_SIGMA)
      : bsPut(S, strike, T, DEFAULT_R, DEFAULT_SIGMA);

    return { ...l, strike, rawPremium, expDate };
  });

  const naturalNet = legData.reduce(
    (sum, l) => sum + (l.dir === 'sell' ? l.rawPremium : -l.rawPremium), 0
  );
  const absNet = Math.abs(naturalNet);
  const minNet = target * 0.001; // prevent divide-by-near-zero
  const pnlScale = absNet > minNet ? target / absNet : 1;

  return legData.map(l => ({
    ...l,
    premium: parseFloat(Math.max(target * 0.001, l.rawPremium * pnlScale).toFixed(2))
  }));
}

function addLegWithValues(data) {
  if (AppState.legs.length >= MAX_LEGS) return;
  AppState.legs.push({
    id: genId(),
    direction: data.dir,
    type: data.type,
    strike: data.strike,
    premium: data.premium,
    expDate: data.expDate || null,
    showExpDate: !!data.needsExpDate,
    touched: false
  });
}

// ── Add Leg ──
function addLeg(template = null) {
  if (AppState.legs.length >= MAX_LEGS) return;
  const sr = getStrikeRange();
  const S = AppState.underlyingPrice;
  let defaultStrike;
  if (template && template.strikePercent !== undefined && S) {
    defaultStrike = parseFloat((S * (1 + template.strikePercent / 100)).toFixed(2));
  } else {
    defaultStrike = S ? parseFloat(S.toFixed(2)) : parseFloat(((sr.min + sr.max) / 2).toFixed(2));
  }

  const factor = template && template.premiumFactor !== undefined ? template.premiumFactor : 4;
  const defaultPremium = parseFloat((defaultStrike * factor / 100).toFixed(2));

  let defaultExpDate = null;
  if (template && template.needsExpDate) {
    const settlements = getTXOSettlementDates();
    const expDate = (template.expMonths || 1) === 1 ? settlements.near : settlements.far;
    defaultExpDate = toDateStr(expDate);
  }

  const leg = {
    id: genId(),
    direction: template ? template.dir : 'buy',
    type: template ? template.type : 'call',
    strike: defaultStrike,
    premium: defaultPremium,
    expDate: defaultExpDate,
    showExpDate: template ? !!template.needsExpDate : false,
    touched: false
  };

  AppState.legs.push(leg);
}

// ── Presets ──
function renderPresetButtons() {
  const container = document.getElementById('preset-buttons');
  const category = STRATEGY_PRESETS.find(c => c.category === AppState.activePresetCategory);
  if (!category) return;

  container.innerHTML = category.strategies.map(s => `
    <button class="preset-btn" data-preset="${s.name}">${s.name}</button>
  `).join('');

  container.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });
}

function applyPreset(name) {
  if (!AppState.underlyingPrice) {
    showUnderlyingError();
    document.getElementById('underlying-price').focus();
    return;
  }

  const all = STRATEGY_PRESETS.flatMap(c => c.strategies);
  const preset = all.find(s => s.name === name);
  if (!preset) return;
  if (preset.legs.length > MAX_LEGS) return;

  AppState.legs = [];
  AppState.activeStrategyName = name;
  renderLegs();
  if (preset.bounded) {
    const computed = computeBoundedLegs(preset, AppState.underlyingPrice);
    computed.forEach(addLegWithValues);
  } else {
    preset.legs.forEach(template => addLeg(template));
  }
  renderLegs();
  updateChart();
}

// ── Underlying Price Validation ──
function showUnderlyingError() {
  document.getElementById('underlying-price').classList.add('error');
  document.getElementById('underlying-price-error').style.display = 'inline';
}

function clearUnderlyingError() {
  document.getElementById('underlying-price').classList.remove('error');
  document.getElementById('underlying-price-error').style.display = 'none';
}

// ── Navigation ──
function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('page-' + tab.dataset.page).classList.add('active');
    });
  });
}

// ── Global Input ──
function initGlobalInput() {
  const input = document.getElementById('underlying-price');
  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    AppState.underlyingPrice = isNaN(val) || val <= 0 ? null : val;
    if (AppState.underlyingPrice) clearUnderlyingError();
    renderLegs();
    updateChart();
  });
}

// ── Preset Tabs ──
function initPresetTabs() {
  document.querySelectorAll('.preset-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.preset-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      AppState.activePresetCategory = tab.dataset.category;
      renderPresetButtons();
    });
  });
  renderPresetButtons();
}

// ── Add Leg Button ──
function initAddLegBtn() {
  document.getElementById('add-leg-btn').addEventListener('click', () => {
    if (!AppState.underlyingPrice) {
      showUnderlyingError();
      document.getElementById('underlying-price').focus();
      return;
    }
    AppState.activeStrategyName = null;
    addLeg();
    renderLegs();
    updateChart();
  });
}

// ── Clear All Button ──
function initClearLegsBtn() {
  document.getElementById('clear-legs-btn').addEventListener('click', () => {
    AppState.legs = [];
    AppState.activeStrategyName = null;
    renderLegs();
    updateChart();
  });
}

// ── Chart Reset Button ──
function initChartResetBtn() {
  document.getElementById('chart-reset-btn').addEventListener('click', () => {
    if (AppState.chartInitialized) {
      userHasZoomed = false;
      updateChart();
    }
  });
}

// ── Export Strategy Image ──
async function exportStrategyImage() {
  const S = AppState.underlyingPrice;
  const legs = AppState.legs.filter(l => l.strike !== null && l.premium !== null);
  if (!legs.length || !AppState.chartInitialized) return;

  const btn = document.getElementById('export-btn');
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const mobile = window.innerWidth < 640;
    const W = 1400;

    const LEGEND_W  = Math.round(W * 0.22);
    const CHART_W   = W - LEGEND_W;
    const CHART_H   = Math.round(W * 0.48);
    const PAD       = Math.round(W * 0.025);
    const ROW_H     = Math.round(W * 0.038);
    const INFO_H    = Math.round(W * 0.065);
    const hasExpiry = legs.some(l => l.expDate);
    const COL_COUNT = hasExpiry ? 5 : 4;
    const TABLE_H   = ROW_H + legs.length * ROW_H + PAD;
    const H         = CHART_H + INFO_H + TABLE_H + PAD;

    const FS = { xs: Math.max(9,  Math.round(W*0.010)),
                 sm: Math.max(11, Math.round(W*0.013)),
                 md: Math.max(13, Math.round(W*0.016)),
                 lg: Math.max(16, Math.round(W*0.020)) };

    const C = { bg:'#ffffff', nav:'#1e3a5f', text:'#1e293b', muted:'#64748b',
                border:'#e2e8f0', row:'#f8fafc',
                buy:'#16a34a', sell:'#dc2626', call:'#2563eb', put:'#7c3aed',
                pnl:'#2563eb', zero:'#94a3b8', be:'#16a34a', price:'#f59e0b' };

    // Compute breakevens for legend annotations
    const expRange = S * 0.3;
    const expPrices = [], expPnl = [];
    for (let i = 0; i <= CHART_POINTS; i++) {
      const sp = (S - expRange) + (2 * expRange * i / CHART_POINTS);
      expPrices.push(sp);
      expPnl.push(calcCombinedPnL(legs, sp));
    }
    const exportBreakevens = findBreakevens(expPrices, expPnl);

    // Max Gain / Max Loss
    const pnlNearZero = calcCombinedPnL(legs, 0.0001);
    let expHi = Math.max(Math.max(...expPnl), pnlNearZero);
    let expLo = Math.min(Math.min(...expPnl), pnlNearZero);
    if (expLo > expHi) { const tmp = expLo; expLo = expHi; expHi = tmp; }
    const netCallDir = legs.reduce((s, l) => l.type === 'call' ? s + (l.direction === 'buy' ? 1 : -1) : s, 0);
    const fmt = v => (v >= 0 ? '+' : '') + fmtChart(v);
    const maxGainLabel = expHi < 0 ? '最小虧損' : '最大獲利';
    const maxGainStr   = expHi < 0 ? fmtChart(expHi) : (netCallDir > 0 ? '+∞' : fmt(expHi));
    const maxLossLabel = expLo > 0 ? '最小獲利' : '最大虧損';
    const maxLossStr   = expLo > 0 ? fmt(expLo) : (netCallDir < 0 ? '-∞' : fmtChart(expLo));
    const breakevenStr = exportBreakevens.length > 0
      ? exportBreakevens.map(b => fmtChart(b)).join(' / ')
      : 'N/A';

    // Export chart without legend
    const container = document.getElementById('payoff-chart');
    const prevLegend = container.layout?.showlegend ?? !mobile;
    const prevMarginB = container.layout?.margin?.b ?? (mobile ? 60 : 110);
    await Plotly.relayout(container, { showlegend: false, 'margin.b': 40 });
    const chartUrl = await Plotly.toImage(container, { format: 'png', width: CHART_W, height: CHART_H, scale: 1 });
    await Plotly.relayout(container, { showlegend: prevLegend, 'margin.b': prevMarginB });

    // Build canvas
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Load and draw chart
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, LEGEND_W, 0, CHART_W, CHART_H); resolve(); };
      img.src = chartUrl;
    });

    // ── Legend panel ──
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, LEGEND_W, CHART_H);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, LEGEND_W, CHART_H);

    let ly = Math.round(CHART_H * 0.12);
    const lx = Math.round(LEGEND_W * 0.10);
    const itemGap = Math.round(CHART_H * 0.10);
    const lineLen = Math.round(LEGEND_W * 0.30);

    ctx.font = `bold ${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = C.muted;
    ctx.fillText('圖例', lx, ly);
    ly += Math.round(itemGap * 0.7);

    const drawLegendItem = (icon, label, sublabel) => {
      icon();
      const textX = lx + lineLen + Math.round(LEGEND_W * 0.06);
      ctx.font = `${FS.xs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = C.text;
      ctx.fillText(label, textX, ly + 4);
      if (sublabel) {
        const subFS = Math.max(8, FS.xs - 1);
        ctx.font = `${subFS}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = C.muted;
        ctx.fillText(sublabel, textX, ly + 4 + Math.round(subFS * 1.7));
        ly += itemGap + Math.round(subFS * 1.7);
      } else {
        ly += itemGap;
      }
    };

    // P&L line
    drawLegendItem(() => {
      ctx.strokeStyle = C.pnl; ctx.lineWidth = 2.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lineLen, ly); ctx.stroke();
    }, '損益');

    // Zero line
    drawLegendItem(() => {
      ctx.strokeStyle = C.zero; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lineLen, ly); ctx.stroke();
      ctx.setLineDash([]);
    }, '損益平衡線');

    // Breakeven points
    const beText = exportBreakevens.length > 0
      ? exportBreakevens.map(b => '@' + fmtChart(b)).join('  ')
      : null;
    drawLegendItem(() => {
      const cx = lx + lineLen / 2, r = Math.round(lineLen * 0.15);
      ctx.fillStyle = C.be;
      ctx.beginPath(); ctx.arc(cx, ly, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, ly, r, 0, Math.PI * 2); ctx.stroke();
    }, '損益兩平', beText);

    // Current price
    drawLegendItem(() => {
      ctx.strokeStyle = C.price; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lineLen, ly); ctx.stroke();
      ctx.setLineDash([]);
    }, '當前價格', '@' + fmtChart(S));

    // Strategy name
    const strategyName = AppState.activeStrategyName || '自訂策略';
    ly += Math.round(itemGap * 0.3);
    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(LEGEND_W - lx, ly); ctx.stroke();
    ly += Math.round(itemGap * 0.5);
    ctx.font = `bold ${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = C.muted;
    ctx.fillText('策略', lx, ly);
    ly += Math.round(itemGap * 0.6);
    ctx.font = `${FS.xs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = C.text;
    ctx.fillText(strategyName, lx, ly);

    // ── Separator ──
    ctx.strokeStyle = C.nav; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, CHART_H); ctx.lineTo(W, CHART_H); ctx.stroke();

    // ── Info section ──
    const infoY = CHART_H + Math.round(INFO_H * 0.55);
    ctx.font = `bold ${FS.md}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = C.text;
    ctx.fillText(`標的現貨價格: ${fmtChart(S)}`, PAD, infoY);
    if (hasExpiry) {
      const expiries = [...new Set(legs.filter(l => l.expDate).map(l => l.expDate))];
      ctx.font = `${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = C.muted;
      ctx.fillText(`到期日: ${expiries.join(', ')}`, PAD, infoY + Math.round(INFO_H * 0.4));
    }

    // Right-side stats: Max Gain | Max Loss | Breakeven
    const statsStartX = Math.round(W * 0.38);
    const statsColW   = Math.round((W - PAD - statsStartX) / 3);
    const labelY = infoY - Math.round(INFO_H * 0.28);
    const valueY = infoY + Math.round(INFO_H * 0.08);
    [
      { label: maxGainLabel, value: maxGainStr, color: expHi < 0 ? C.sell : C.buy },
      { label: maxLossLabel, value: maxLossStr, color: expLo > 0 ? C.buy : C.sell },
      { label: '損益兩平', value: breakevenStr, color: C.text },
    ].forEach(({ label, value, color }, i) => {
      const x = statsStartX + i * statsColW;
      ctx.font = `${FS.xs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = C.muted;
      ctx.fillText(label, x, labelY);
      ctx.font = `bold ${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(value, x, valueY);
    });

    // ── Table ──
    const tableTop = CHART_H + INFO_H;
    const colW = Math.round((W - PAD * 2) / COL_COUNT);
    const cols = ['方向', '類型', '履約價', '權利金', ...(hasExpiry ? ['到期日'] : [])];

    // Header
    ctx.fillStyle = C.nav;
    ctx.fillRect(PAD, tableTop, W - PAD * 2, ROW_H);
    ctx.font = `bold ${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffffff';
    cols.forEach((col, i) => {
      ctx.fillText(col, PAD + i * colW + Math.round(colW * 0.06), tableTop + Math.round(ROW_H * 0.65));
    });

    // Rows
    legs.forEach((leg, ri) => {
      const ry = tableTop + ROW_H + ri * ROW_H;
      ctx.fillStyle = ri % 2 === 0 ? C.bg : C.row;
      ctx.fillRect(PAD, ry, W - PAD * 2, ROW_H);

      const ty = ry + Math.round(ROW_H * 0.65);
      const cells = [
        { text: leg.direction === 'buy' ? 'Buy' : 'Sell',
          color: leg.direction === 'buy' ? C.buy : C.sell },
        { text: leg.type === 'call' ? 'Call' : 'Put',
          color: leg.type === 'call' ? C.call : C.put },
        { text: fmtChart(leg.strike),  color: C.text },
        { text: fmtChart(leg.premium), color: C.text },
        ...(hasExpiry ? [{ text: leg.expDate || '—', color: C.muted }] : [])
      ];

      cells.forEach((cell, ci) => {
        ctx.font = `${ci < 2 ? 'bold ' : ''}${FS.sm}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = cell.color;
        ctx.fillText(cell.text, PAD + ci * colW + Math.round(colW * 0.06), ty);
      });

      // Row bottom border
      ctx.strokeStyle = C.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, ry + ROW_H); ctx.lineTo(W - PAD, ry + ROW_H); ctx.stroke();
    });

    // Download — use preset name if available, else fallback
    const rawName = AppState.activeStrategyName;
    const slug = rawName ? rawName.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') : '';
    const filename = slug ? slug + '.png' : 'option-strategy.png';
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();

  } catch (e) {
    console.error('Export failed:', e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px"><path d="M16.707 7.404c-.189-.188-.448-.283-.707-.283s-.518.095-.707.283l-2.293 2.293v-6.697c0-.552-.448-1-1-1s-1 .448-1 1v6.697l-2.293-2.293c-.189-.188-.44-.293-.707-.293s-.518.105-.707.293c-.39.39-.39 1.024 0 1.414l4.707 4.682 4.709-4.684c.388-.387.388-1.022-.002-1.412zM20.987 16c0-.105-.004-.211-.039-.316l-2-6c-.136-.409-.517-.684-.948-.684h-.219c-.094.188-.21.368-.367.525l-1.482 1.475h1.348l1.667 5h-13.893l1.667-5h1.348l-1.483-1.475c-.157-.157-.274-.337-.367-.525h-.219c-.431 0-.812.275-.948.684l-2 6c-.035.105-.039.211-.039.316-.013 0-.013 5-.013 5 0 .553.447 1 1 1h16c.553 0 1-.447 1-1 0 0 0-5-.013-5z"/></svg><span class="btn-label"> Export</span>';
  }
}

function initExportBtn() {
  document.getElementById('export-btn').addEventListener('click', exportStrategyImage);
}

// ── Help Panel ──
function initHelpPanel() {
  const panel    = document.getElementById('help-panel');
  const backdrop = document.getElementById('help-backdrop');
  const openBtn  = document.getElementById('help-btn');
  const closeBtn = document.getElementById('help-close-btn');

  const open  = () => { panel.classList.remove('hidden'); backdrop.classList.remove('hidden'); };
  const close = () => { panel.classList.add('hidden');    backdrop.classList.add('hidden'); };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// ── Resize Handler ──
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(updateChart, 200);
});

// ── Init ──
function initLegInputGhost() {
  const container = document.getElementById('legs-container');

  container.addEventListener('focusin', e => {
    const input = e.target;
    if (!input.classList.contains('leg-number-input')) return;
    const card = input.closest('.leg-card');
    if (!card) return;
    const leg = AppState.legs.find(l => l.id === card.dataset.legId);
    if (!leg) return;
    const field = input.dataset.field;
    const ghostKey = `${leg.id}:${field}`;
    if (ghostPrevValues[ghostKey] == null && leg[field] !== null) {
      ghostPrevValues[ghostKey] = String(leg[field]);
    }
    const prev = ghostPrevValues[ghostKey];
    if (prev) {
      input.placeholder = Number(prev).toFixed(2);
      input.value = '';
      input.classList.add('input-ghost');
    }
  });

  // Keyboard first printable key: clear placeholder and exit ghost before char inserts
  container.addEventListener('keydown', e => {
    const input = e.target;
    if (!input.classList.contains('leg-number-input')) return;
    if (!input.classList.contains('input-ghost')) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
        && /^[0-9.\-]$/.test(e.key)) {
      input.value = '';
      input.placeholder = '';
      input.classList.remove('input-ghost');
    }
  }, true);

  // Spinner / paste while ghost: value is delta from 0, adjust relative to prevValue.
  // Also restores ghost state when user deletes back to empty.
  // Runs in capture phase so it fires before the per-input renderLegs handler.
  container.addEventListener('input', e => {
    const input = e.target;
    if (!input.classList.contains('leg-number-input')) return;

    if (input.classList.contains('input-ghost')) {
      // Spinner / paste while ghost
      const card = input.closest('.leg-card');
      if (!card) return;
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const ghostKey = `${leg.id}:${input.dataset.field}`;
      const prev = parseFloat(ghostPrevValues[ghostKey]);
      const delta = parseFloat(input.value);
      if (!isNaN(prev) && !isNaN(delta)) {
        input.value = String(prev + delta);
      }
      input.placeholder = '';
      input.classList.remove('input-ghost');
      return;
    }

    // User deleted all typed characters → restore ghost placeholder and update chart
    if (input.value === '') {
      const card = input.closest('.leg-card');
      if (!card) return;
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const ghostKey = `${leg.id}:${input.dataset.field}`;
      const prev = ghostPrevValues[ghostKey];
      if (prev) {
        const val = parseFloat(prev);
        if (!isNaN(val)) {
          leg[input.dataset.field] = val;
          updateChart();
        }
        input.placeholder = Number(prev).toFixed(2);
        input.classList.add('input-ghost');
      }
    }
  }, true);
}

function initApp() {
  initNavigation();
  initGlobalInput();
  initAddLegBtn();
  initClearLegsBtn();
  initChartResetBtn();
  initExportBtn();
  initPresetTabs();
  initHelpPanel();
  initLegInputGhost();
  renderLegs();
  updateChart();
}

document.addEventListener('DOMContentLoaded', initApp);
