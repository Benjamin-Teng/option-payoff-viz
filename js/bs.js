// Abramowitz & Stegun approximation — max error < 7.5e-8
function normCDF(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - (Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function bsD1(S, K, T, r, sigma) {
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

function bsCall(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(S - K, 0);
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}

function bsPut(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(K - S, 0);
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

function bsDelta(S, K, T, r, sigma, type) {
  if (T <= 0) {
    if (type === 'call') return S > K ? 1 : (S === K ? 0.5 : 0);
    return S < K ? -1 : (S === K ? -0.5 : 0);
  }
  const d1 = bsD1(S, K, T, r, sigma);
  return type === 'call' ? normCDF(d1) : normCDF(d1) - 1;
}

function bsGamma(S, K, T, r, sigma) {
  if (T <= 0) return 0;
  const d1 = bsD1(S, K, T, r, sigma);
  return normPDF(d1) / (S * sigma * Math.sqrt(T));
}

// Returns vega per 1% change in volatility
function bsVega(S, K, T, r, sigma) {
  if (T <= 0) return 0;
  const d1 = bsD1(S, K, T, r, sigma);
  return S * normPDF(d1) * Math.sqrt(T) / 100;
}

// Returns theta per calendar day
function bsTheta(S, K, T, r, sigma, type) {
  if (T <= 0) return 0;
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  const decay = -(S * normPDF(d1) * sigma) / (2 * Math.sqrt(T));
  if (type === 'call') {
    return (decay - r * K * Math.exp(-r * T) * normCDF(d2)) / 365;
  }
  return (decay + r * K * Math.exp(-r * T) * normCDF(-d2)) / 365;
}

// Returns rho per 1% change in interest rate
function bsRho(S, K, T, r, sigma, type) {
  if (T <= 0) return 0;
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === 'call') {
    return K * T * Math.exp(-r * T) * normCDF(d2) / 100;
  }
  return -K * T * Math.exp(-r * T) * normCDF(-d2) / 100;
}
