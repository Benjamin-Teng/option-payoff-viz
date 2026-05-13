// ── Formula Definitions ──
const BS_FORMULAS = [
  {
    title: 'Call Option Price',
    latex: 'C = S \\cdot N(d_1) - K e^{-rT} N(d_2)',
    note: 'Price of a European call option under Black-Scholes assumptions.'
  },
  {
    title: 'Put Option Price',
    latex: 'P = K e^{-rT} N(-d_2) - S \\cdot N(-d_1)',
    note: 'Price of a European put option. Also derivable via put-call parity: P = C - S + Ke^{-rT}.',
    prereq: { text: 'Put-Call Parity', url: 'https://en.wikipedia.org/wiki/Put%E2%80%93call_parity' }
  },
  {
    title: 'd₁ and d₂',
    latex: 'd_1 = \\frac{\\ln(S/K) + \\left(r + \\frac{\\sigma^2}{2}\\right)T}{\\sigma\\sqrt{T}}, \\quad d_2 = d_1 - \\sigma\\sqrt{T}',
    note: 'S = spot price, K = strike, r = risk-free rate, σ = volatility, T = time to expiry (years).',
    prereq: { text: 'Geometric Brownian Motion', url: 'https://en.wikipedia.org/wiki/Geometric_Brownian_motion' }
  },
  {
    title: 'Standard Normal CDF',
    latex: 'N(x) = \\frac{1}{\\sqrt{2\\pi}} \\int_{-\\infty}^{x} e^{-t^2/2}\\, dt',
    note: 'N(d₁) represents the risk-adjusted probability the option expires in-the-money.',
    prereq: { text: 'Normal Distribution', url: 'https://en.wikipedia.org/wiki/Normal_distribution' }
  }
];

const GREEK_FORMULAS = [
  {
    title: 'Δ Delta — ∂Price/∂S',
    latex: '\\Delta_c = N(d_1), \\quad \\Delta_p = N(d_1) - 1',
    note: 'Rate of change of option price with respect to the underlying price. Call delta ∈ (0,1), put delta ∈ (−1,0).'
  },
  {
    title: 'Γ Gamma — ∂²Price/∂S²',
    latex: '\\Gamma = \\frac{n(d_1)}{S\\,\\sigma\\sqrt{T}}',
    note: 'Rate of change of delta. Identical for calls and puts. n(x) = N′(x) is the standard normal PDF.',
    prereq: { text: 'Second-order Greeks', url: 'https://en.wikipedia.org/wiki/Greeks_(finance)#Gamma' }
  },
  {
    title: 'ν Vega — ∂Price/∂σ',
    latex: '\\nu = S\\, n(d_1)\\sqrt{T}',
    note: 'Sensitivity to a 1-unit change in volatility. Identical for calls and puts. In practice quoted per 1% change.'
  },
  {
    title: 'Θ Theta — ∂Price/∂T',
    latex: '\\Theta_c = -\\frac{S\\,n(d_1)\\,\\sigma}{2\\sqrt{T}} - rKe^{-rT}N(d_2)',
    note: 'Time decay per calendar day. Theta is typically negative (options lose value as time passes).'
  },
  {
    title: 'ρ Rho — ∂Price/∂r',
    latex: '\\rho_c = KTe^{-rT}N(d_2), \\quad \\rho_p = -KTe^{-rT}N(-d_2)',
    note: 'Sensitivity to a 1% change in the risk-free interest rate. Less significant for short-dated options.'
  }
];

// ── Render Formulas ──
function renderFormulaBlock(formula) {
  const id = 'formula-' + Math.random().toString(36).slice(2, 8);
  const prereqHtml = formula.prereq
    ? `<br>📖 Prerequisite: <a href="${formula.prereq.url}" target="_blank" rel="noopener">${formula.prereq.text}</a>`
    : '';

  return `
    <div class="formula-block">
      <h3>${formula.title}</h3>
      <div class="formula-render" id="${id}"></div>
      <div class="formula-copy-row">
        <span class="formula-source">${formula.latex}</span>
        <button class="btn-copy" data-latex="${encodeURIComponent(formula.latex)}">Copy LaTeX</button>
      </div>
      <div class="formula-note">${formula.note}${prereqHtml}</div>
    </div>`;
}

function renderDerivations() {
  const bsContainer = document.getElementById('bs-formulas');
  const greeksContainer = document.getElementById('greeks-formulas');

  bsContainer.innerHTML = BS_FORMULAS.map(renderFormulaBlock).join('');
  greeksContainer.innerHTML = GREEK_FORMULAS.map(renderFormulaBlock).join('');

  // Render KaTeX for each formula
  document.querySelectorAll('.formula-render').forEach(el => {
    const block = el.closest('.formula-block');
    const copyBtn = block.querySelector('.btn-copy');
    const latex = decodeURIComponent(copyBtn.dataset.latex);
    try {
      katex.render(latex, el, { displayMode: true, throwOnError: false });
    } catch (e) {
      el.textContent = latex;
    }
  });

  // Copy-to-clipboard buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const latex = decodeURIComponent(btn.dataset.latex);
      navigator.clipboard.writeText(latex).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy LaTeX';
          btn.classList.remove('copied');
        }, 1800);
      });
    });
  });
}

// ── Greeks Interactive ──
function updateGreeks() {
  const S     = parseFloat(document.getElementById('slider-S').value);
  const K     = parseFloat(document.getElementById('slider-K').value);
  const sigma = parseFloat(document.getElementById('slider-sigma').value) / 100;
  const r     = parseFloat(document.getElementById('slider-r').value) / 100;
  const T     = parseFloat(document.getElementById('slider-T').value) / 365;

  document.getElementById('val-S').textContent     = S;
  document.getElementById('val-K').textContent     = K;
  document.getElementById('val-sigma').textContent = document.getElementById('slider-sigma').value;
  document.getElementById('val-r').textContent     = parseFloat(document.getElementById('slider-r').value).toFixed(1);
  document.getElementById('val-T').textContent     = document.getElementById('slider-T').value;

  const callPrice = bsCall(S, K, T, r, sigma);
  const putPrice  = bsPut(S, K, T, r, sigma);

  document.getElementById('out-call-price').textContent = callPrice.toFixed(4);
  document.getElementById('out-put-price').textContent  = putPrice.toFixed(4);

  const gamma = bsGamma(S, K, T, r, sigma);
  const vega  = bsVega(S, K, T, r, sigma);

  document.getElementById('g-delta-c').textContent = bsDelta(S, K, T, r, sigma, 'call').toFixed(4);
  document.getElementById('g-delta-p').textContent = bsDelta(S, K, T, r, sigma, 'put').toFixed(4);
  document.getElementById('g-gamma-c').textContent = gamma.toFixed(6);
  document.getElementById('g-gamma-p').textContent = gamma.toFixed(6);
  document.getElementById('g-vega-c').textContent  = vega.toFixed(4);
  document.getElementById('g-vega-p').textContent  = vega.toFixed(4);
  document.getElementById('g-theta-c').textContent = bsTheta(S, K, T, r, sigma, 'call').toFixed(4);
  document.getElementById('g-theta-p').textContent = bsTheta(S, K, T, r, sigma, 'put').toFixed(4);
  document.getElementById('g-rho-c').textContent   = bsRho(S, K, T, r, sigma, 'call').toFixed(4);
  document.getElementById('g-rho-p').textContent   = bsRho(S, K, T, r, sigma, 'put').toFixed(4);
}

const GREEK_DEFAULTS = { S: 100, K: 100, sigma: 20, r: 2, T: 30 };

function resetGreeks() {
  document.getElementById('slider-S').value     = GREEK_DEFAULTS.S;
  document.getElementById('slider-K').value     = GREEK_DEFAULTS.K;
  document.getElementById('slider-sigma').value = GREEK_DEFAULTS.sigma;
  document.getElementById('slider-r').value     = GREEK_DEFAULTS.r;
  document.getElementById('slider-T').value     = GREEK_DEFAULTS.T;
  updateGreeks();
}

function initGreekSliders() {
  ['slider-S', 'slider-K', 'slider-sigma', 'slider-r', 'slider-T'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateGreeks);
  });
  document.getElementById('greeks-reset-btn').addEventListener('click', resetGreeks);
  updateGreeks();
}

// ── Init Guide Page ──
function initGuidePage() {
  renderDerivations();
  initGreekSliders();
}

document.addEventListener('DOMContentLoaded', initGuidePage);
