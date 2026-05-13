// strikeOffset: leg strike = underlying + offset (rounded to nearest 50)
// bounded strategies: premiums computed via BS model in applyPreset → scaled to ±300 P&L
// unbounded strategies: premiumFactor used → premium = round(strike * factor / 100)
//   factor 4 = K/25 (standard default)

const STRATEGY_PRESETS = [
  {
    category: '2-Leg',
    strategies: [
      {
        name: 'Bull Call Spread',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: 'Bear Call Spread',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: 'Bull Put Spread',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put', strikeOffset:    0 },
          { dir: 'buy',  type: 'put', strikeOffset: -600 }
        ]
      },
      {
        name: 'Bear Put Spread',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put', strikeOffset:    0 },
          { dir: 'sell', type: 'put', strikeOffset: -600 }
        ]
      },
      {
        name: 'Long Straddle',
        bounded: false,
        legs: [
          { dir: 'buy', type: 'call', premiumFactor: 4 },
          { dir: 'buy', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: 'Short Straddle',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4 },
          { dir: 'sell', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: 'Long Strangle',
        bounded: false,
        legs: [
          { dir: 'buy', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'buy', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: 'Short Strangle',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: 'Risk Reversal',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: 'Synthetic Long',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4 },
          { dir: 'sell', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: 'Synthetic Short',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4 },
          { dir: 'buy',  type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: 'Calendar Spread ⏱',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      },
      {
        name: 'Short Calendar Spread ⏱',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      }
    ]
  },
  {
    category: '3-Leg',
    strategies: [
      {
        name: 'Ratio Call Spread',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4, strikePercent:  0 },
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 }
        ]
      },
      {
        name: 'Ratio Put Spread',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'put', premiumFactor: 4, strikePercent:  0 },
          { dir: 'sell', type: 'put', premiumFactor: 4, strikePercent: -2 },
          { dir: 'sell', type: 'put', premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: 'Jade Lizard',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'put',  premiumFactor: 4, strikePercent: -2 },
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'buy',  type: 'call', premiumFactor: 4, strikePercent: +6 }
        ]
      }
    ]
  },
  {
    category: '4-Leg',
    strategies: [
      {
        name: 'Iron Condor',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put',  strikeOffset: -1200 },
          { dir: 'sell', type: 'put',  strikeOffset:  -600 },
          { dir: 'sell', type: 'call', strikeOffset:  +600 },
          { dir: 'buy',  type: 'call', strikeOffset: +1200 }
        ]
      },
      {
        name: 'Short Iron Condor',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put',  strikeOffset: -1200 },
          { dir: 'buy',  type: 'put',  strikeOffset:  -600 },
          { dir: 'buy',  type: 'call', strikeOffset:  +600 },
          { dir: 'sell', type: 'call', strikeOffset: +1200 }
        ]
      },
      {
        name: 'Iron Butterfly',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put',  strikeOffset: -600 },
          { dir: 'sell', type: 'put',  strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: 'Short Iron Butterfly',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put',  strikeOffset: -600 },
          { dir: 'buy',  type: 'put',  strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: 'Butterfly (Call)',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset: -300 },
          { dir: 'sell', type: 'call', strikeOffset: +300 },
          { dir: 'sell', type: 'call', strikeOffset: +300 },
          { dir: 'buy',  type: 'call', strikeOffset: +900 }
        ]
      },
      {
        name: 'Butterfly (Put)',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put', strikeOffset: +300 },
          { dir: 'sell', type: 'put', strikeOffset: -300 },
          { dir: 'sell', type: 'put', strikeOffset: -300 },
          { dir: 'buy',  type: 'put', strikeOffset: -900 }
        ]
      },
      {
        name: 'Double Calendar ⏱',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 },
          { dir: 'sell', type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      },
      {
        name: 'Short Double Calendar Spread ⏱',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 },
          { dir: 'buy',  type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'sell', type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      }
    ]
  }
];
