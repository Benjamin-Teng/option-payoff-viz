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
const CHART_POINTS = 300;
const TARGET_MAX_PNL = 300; // reference P&L at BASE_UNDERLYING
const BASE_UNDERLYING = 30000;

// ── State ──
const AppState = {
  underlyingPrice: null,
  legs: [],
  activePresetCategory: '2-Leg',
  chartInitialized: false
};

let legIdCounter = 0;

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
    const step = Math.max(0.01, parseFloat((S * 0.001).toFixed(2)));
    return { min: parseFloat((S * 0.6).toFixed(2)), max: parseFloat((S * 1.4).toFixed(2)), step };
  }
  return { min: 10000, max: 40000, step: 50 };
}

function getPremiumMax() {
  const S = AppState.underlyingPrice;
  return S && S > 0 ? parseFloat((S * 0.12).toFixed(2)) : 2000;
}

function getPremiumStep() {
  const S = AppState.underlyingPrice;
  if (!S || S <= 0) return 1;
  const pmMax = getPremiumMax();
  return Math.max(0.01, parseFloat((pmMax * 0.005).toFixed(2)));
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
  const result = [];
  const priceStep = prices.length > 1 ? (prices[prices.length - 1] - prices[0]) / (prices.length - 1) : 1;
  // Round to 2dp for comparison so floating-point near-zero counts as zero
  const r = pnl.map(v => Math.round(v * 100) / 100);

  const addBP = bp => {
    const rounded = Math.round(bp * 100) / 100;
    if (result.length === 0 || Math.abs(rounded - result[result.length - 1]) > priceStep * 0.5) {
      result.push(rounded);
    }
  };

  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    if (a !== 0 && b !== 0 && (a > 0) !== (b > 0)) {
      // Direct sign change: interpolate crossing
      const x = prices[i] + (prices[i + 1] - prices[i]) * (-pnl[i]) / (pnl[i + 1] - pnl[i]);
      addBP(x);
    } else if (a !== 0 && b === 0) {
      // Entering zero region: corner is at prices[i+1]
      addBP(prices[i + 1]);
    } else if (a === 0 && b !== 0) {
      // Exiting zero region: corner is at prices[i]
      addBP(prices[i]);
    }
    // Both zero: interior of flat region, skip
  }

  return result;
}

// ── Chart ──
function updateChart() {
  const container = document.getElementById('payoff-chart');
  const validLegs = AppState.legs.filter(l => l.strike !== null && l.premium !== null);

  if (validLegs.length === 0) {
    if (AppState.chartInitialized) {
      Plotly.purge(container);
      AppState.chartInitialized = false;
    }
    container.innerHTML = '<div class="chart-placeholder">Add at least one leg with Strike and Premium to see the P&L curve.</div>';
    return;
  }

  const S0 = AppState.underlyingPrice || (validLegs[0].strike || 22000);
  const range = S0 * 0.3;
  const prices = [];
  const pnl = [];

  for (let i = 0; i <= CHART_POINTS; i++) {
    const S = (S0 - range) + (2 * range * i / CHART_POINTS);
    prices.push(S);
    pnl.push(calcCombinedPnL(validLegs, S));
  }

  const minPnL = Math.min(...pnl);
  const maxPnL = Math.max(...pnl);
  const padY = (maxPnL - minPnL) * 0.1 || 50;

  // Color the P&L line: green above zero, red below
  const traces = [
    {
      x: prices,
      y: pnl,
      type: 'scatter',
      mode: 'lines',
      name: 'P&L',
      line: { color: '#2563eb', width: 2.5 },
      customdata: prices.map((p, i) => [fmtChart(p), fmtChart(pnl[i])]),
      hovertemplate: 'Spot: %{customdata[0]}<br>P&L: %{customdata[1]}<extra></extra>'
    },
    {
      x: [prices[0], prices[prices.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: 'Break-even',
      line: { color: '#94a3b8', width: 1, dash: 'dash' },
      hoverinfo: 'skip'
    }
  ];

  const breakevens = findBreakevens(prices, pnl);
  if (breakevens.length > 0) {
    traces.push({
      x: breakevens,
      y: breakevens.map(() => 0),
      type: 'scatter',
      mode: 'markers+text',
      name: 'Breakeven',
      marker: { color: '#16a34a', size: 10, symbol: 'circle', line: { color: '#fff', width: 2 } },
      text: breakevens.map(b => fmtChart(b)),
      textposition: 'top center',
      textfont: { color: '#16a34a', size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
      customdata: breakevens.map(b => fmtChart(b)),
      hovertemplate: 'Breakeven: %{customdata}<extra></extra>'
    });
  }

  if (AppState.underlyingPrice) {
    const currentPnL = calcCombinedPnL(validLegs, AppState.underlyingPrice);
    traces.push({
      x: [AppState.underlyingPrice, AppState.underlyingPrice],
      y: [minPnL - padY, maxPnL + padY],
      type: 'scatter',
      mode: 'lines',
      name: 'Current Price',
      line: { color: '#f59e0b', width: 1.5, dash: 'dot' },
      hoverinfo: 'skip'
    });
    traces.push({
      x: [AppState.underlyingPrice],
      y: [currentPnL],
      type: 'scatter',
      mode: 'markers',
      name: `P&L @ ${fmtChart(AppState.underlyingPrice)}`,
      marker: { color: '#f59e0b', size: 8 },
      hovertemplate: `Spot: ${fmtChart(AppState.underlyingPrice)}<br>P&L: ${fmtChart(currentPnL)}<extra></extra>`
    });
  }

  const layout = {
    margin: { t: 16, r: 16, b: 110, l: 60 },
    xaxis: {
      title: { text: 'Underlying Price at Expiration', font: { size: 12 } },
      gridcolor: '#e2e8f0',
      zeroline: false
    },
    yaxis: {
      title: { text: 'Profit / Loss', font: { size: 12 } },
      gridcolor: '#e2e8f0',
      zeroline: true,
      zerolinecolor: '#94a3b8',
      zerolinewidth: 1
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f8fafc',
    showlegend: true,
    legend: { orientation: 'h', y: -0.28, x: 0, xanchor: 'left', font: { size: 11 } },
    font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: 12 }
  };

  const config = { responsive: true, displayModeBar: false };

  if (AppState.chartInitialized) {
    Plotly.react(container, traces, layout, config);
  } else {
    container.innerHTML = '';
    Plotly.newPlot(container, traces, layout, config);
    AppState.chartInitialized = true;
  }
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
        <span class="slider-label">Strike</span>
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
        <span class="slider-label">Premium</span>
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
    : '<div style="font-size:13px;color:#94a3b8;padding:8px 0;">No legs added yet. Click <strong>+ Add Leg</strong> or choose a strategy below.</div>';
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
    input.addEventListener('change', () => {
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (!leg) return;
      const val = input.value === '' ? null : parseFloat(input.value);
      leg[input.dataset.field] = val;
      leg.touched = true;
      // Sync slider
      if (val !== null) {
        const slider = card.querySelector(`.leg-slider[data-field="${input.dataset.field}"]`);
        if (slider) slider.value = val;
      }
      renderLegs();
      updateChart();
    });

    input.addEventListener('blur', () => {
      const card = input.closest('.leg-card');
      const leg = AppState.legs.find(l => l.id === card.dataset.legId);
      if (leg) { leg.touched = true; renderLegs(); }
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
    addLeg();
    renderLegs();
    updateChart();
  });
}

// ── Clear All Button ──
function initClearLegsBtn() {
  document.getElementById('clear-legs-btn').addEventListener('click', () => {
    AppState.legs = [];
    renderLegs();
    updateChart();
  });
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

// ── Init ──
function initApp() {
  initNavigation();
  initGlobalInput();
  initAddLegBtn();
  initClearLegsBtn();
  initPresetTabs();
  initHelpPanel();
  renderLegs();
  updateChart();
}

document.addEventListener('DOMContentLoaded', initApp);
