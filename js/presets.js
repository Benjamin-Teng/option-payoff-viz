// strikeOffset: leg strike = underlying + offset (rounded to nearest 50)
// bounded strategies: premiums computed via BS model in applyPreset → scaled to ±300 P&L
// unbounded strategies: premiumFactor used → premium = round(strike * factor / 100)
//   factor 4 = K/25 (standard default)

const STRATEGY_PRESETS = [
  {
    category: '2-Leg',
    strategies: [
      {
        name: '多頭買權價差',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: '空頭買權價差',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: '多頭賣權價差',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put', strikeOffset:    0 },
          { dir: 'buy',  type: 'put', strikeOffset: -600 }
        ]
      },
      {
        name: '空頭賣權價差',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put', strikeOffset:    0 },
          { dir: 'sell', type: 'put', strikeOffset: -600 }
        ]
      },
      {
        name: '買進跨式',
        bounded: false,
        legs: [
          { dir: 'buy', type: 'call', premiumFactor: 4 },
          { dir: 'buy', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: '賣出跨式',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4 },
          { dir: 'sell', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: '買進勒式',
        bounded: false,
        legs: [
          { dir: 'buy', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'buy', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: '賣出勒式',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: '風險逆轉',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'put',  premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: '合成多頭',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4 },
          { dir: 'sell', type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: '合成空頭',
        bounded: false,
        legs: [
          { dir: 'sell', type: 'call', premiumFactor: 4 },
          { dir: 'buy',  type: 'put',  premiumFactor: 4 }
        ]
      },
      {
        name: '日曆價差 ⏱',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      },
      {
        name: '反向日曆價差 ⏱',
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
        name: '比例買權價差',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'call', premiumFactor: 4, strikePercent:  0 },
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 },
          { dir: 'sell', type: 'call', premiumFactor: 4, strikePercent: +2 }
        ]
      },
      {
        name: '比例賣權價差',
        bounded: false,
        legs: [
          { dir: 'buy',  type: 'put', premiumFactor: 4, strikePercent:  0 },
          { dir: 'sell', type: 'put', premiumFactor: 4, strikePercent: -2 },
          { dir: 'sell', type: 'put', premiumFactor: 4, strikePercent: -2 }
        ]
      },
      {
        name: '玉蜥蜴(Jade Lizard)',
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
        name: '鐵兀鷹',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put',  strikeOffset: -1200 },
          { dir: 'sell', type: 'put',  strikeOffset:  -600 },
          { dir: 'sell', type: 'call', strikeOffset:  +600 },
          { dir: 'buy',  type: 'call', strikeOffset: +1200 }
        ]
      },
      {
        name: '反向鐵兀鷹',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put',  strikeOffset: -1200 },
          { dir: 'buy',  type: 'put',  strikeOffset:  -600 },
          { dir: 'buy',  type: 'call', strikeOffset:  +600 },
          { dir: 'sell', type: 'call', strikeOffset: +1200 }
        ]
      },
      {
        name: '鐵蝴蝶',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put',  strikeOffset: -600 },
          { dir: 'sell', type: 'put',  strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: '反向鐵蝴蝶',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'put',  strikeOffset: -600 },
          { dir: 'buy',  type: 'put',  strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: '蝴蝶價差（買權）',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset: -600 },
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'sell', type: 'call', strikeOffset:    0 },
          { dir: 'buy',  type: 'call', strikeOffset: +600 }
        ]
      },
      {
        name: '蝴蝶價差（賣權）',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put', strikeOffset: +600 },
          { dir: 'sell', type: 'put', strikeOffset:    0 },
          { dir: 'sell', type: 'put', strikeOffset:    0 },
          { dir: 'buy',  type: 'put', strikeOffset: -600 }
        ]
      },
      {
        name: '兀鷹價差（買權）',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'call', strikeOffset: -1200 },
          { dir: 'sell', type: 'call', strikeOffset:  -600 },
          { dir: 'sell', type: 'call', strikeOffset:  +600 },
          { dir: 'buy',  type: 'call', strikeOffset: +1200 }
        ]
      },
      {
        name: '兀鷹價差（賣權）',
        bounded: true,
        legs: [
          { dir: 'buy',  type: 'put', strikeOffset: +1200 },
          { dir: 'sell', type: 'put', strikeOffset:  +600 },
          { dir: 'sell', type: 'put', strikeOffset:  -600 },
          { dir: 'buy',  type: 'put', strikeOffset: -1200 }
        ]
      },
      {
        name: '雙日曆價差 ⏱',
        bounded: true,
        legs: [
          { dir: 'sell', type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'call', strikeOffset: 0, needsExpDate: true, expMonths: 2 },
          { dir: 'sell', type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 1 },
          { dir: 'buy',  type: 'put',  strikeOffset: 0, needsExpDate: true, expMonths: 2 }
        ]
      },
      {
        name: '反向雙日曆價差 ⏱',
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
