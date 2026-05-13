## Project Overview
A Python-based tool for visualizing profit & loss curves of option combination strategies.
Users can define multiple option legs (call/put, long/short, strike, premium),
and the tool will render an interactive payoff diagram at expiration.
The diagram updates dynamically in real time as the user adjusts input parameters.

## Features

### General
- Single-page web application deployed on GitHub Pages (pure HTML/CSS/JS, no backend)
- Responsive web design (RWD) for both desktop and mobile devices
- Top navigation bar to switch between two pages:
  - **Option Combination** (default landing page)
  - **Option Strategy Guide**

---

### Option Combination Page

#### Payoff Diagram Area (top)
- Displays a real-time interactive P&L curve that updates instantly as the user adjusts any input parameter
- X-axis: underlying price at expiration; Y-axis: profit & loss
- Shows a reference vertical line at the current underlying price (from global input)
- For strategies involving time decay (e.g., horizontal spreads), P&L is calculated using the Black-Scholes model

#### Global Input (top of input area)
- User must input the current underlying market price before interacting
- This value drives the payoff diagram and BS model calculations
- No automatic price fetching; user enters the value manually

#### Leg Input Area (middle)
- Users can add up to 4 legs; each leg is displayed as an independent block (card/brick style)
- Each leg block contains:
  - Buy (green) / Sell (red) toggle
  - Call / Put toggle
  - Strike input: slider + adjacent number input box
  - Premium input: slider + adjacent number input box
  - Delete button to remove the leg
- A "+" button to add a new leg block
- If user attempts to render with empty required fields:
  - The empty field border turns red
  - A red exclamation mark appears inside the empty input

#### Strategy Preset Selector (bottom of input area)
- A quick-select panel listing common option strategies, including but not limited to:
  - **2-leg:**
    - Bull Call Spread / Bear Call Spread
    - Bull Put Spread / Bear Put Spread
    - Long Straddle / Short Straddle
    - Long Strangle / Short Strangle
    - Risk Reversal (Long Call + Short Put, or reverse)
    - Synthetic Long / Synthetic Short (same strike, opposite direction Call & Put)
    - Calendar Spread / Horizontal Spread (same strike, different expiration) ⚠️
  - **3-leg:**
    - Butterfly Spread (Call or Put)
    - Ratio Call Spread (Buy 1, Sell 2)
    - Ratio Put Spread (Buy 1, Sell 2)
    - Jade Lizard (Short Put + Short Call Spread)
  - **4-leg:**
    - Iron Condor
    - Iron Butterfly
    - Double Calendar Spread ⚠️
- Selecting a preset auto-populates the leg structure (direction, call/put type); user still fills in strike and premium values
- ⚠️ Strategies marked require two different expiration dates as input; BS model is used to calculate time value for each leg separately

---

### Option Strategy Guide Page

#### Mathematical Derivation Section
- Presents formal derivations of option pricing theory and Greek letters using LaTeX rendered via MathJax or KaTeX
- Each derivation step includes a footnote with recommended prerequisite learning resources (external links) for readers who need background knowledge
- Users can copy the LaTeX source of any formula for use in Overleaf

#### Greek Letters Interactive Section (bottom)
- Users can adjust sliders for all 5 Greek letter values: Delta, Gamma, Vega, Theta, Rho
- Additional slider for time to expiration
- Displays how TXO call/put prices change as each parameter varies, calculated via Black-Scholes model

---

### Black-Scholes Model Usage
- Applied when strategy P&L depends on time value (e.g., horizontal spreads)
- Required parameters not provided by user (risk-free rate, implied volatility) use reference values based on near-month TXO conventions
- User-provided underlying price always takes precedence over any reference value



## Input / Output

### Input
| Field | Type | Notes |
|---|---|---|
| Underlying price | Number | Global setting, manual input, required |
| Leg: Buy / Sell | Toggle | Green / Red |
| Leg: Call / Put | Toggle | |
| Leg: Strike | Slider + Number input | |
| Leg: Premium | Slider + Number input | |
| Leg: Expiration date | Date picker | Only required for Calendar / Horizontal Spread strategies |
| Strategy preset | Selection | Optional; auto-populates leg structure |

### Output
- Interactive P&L curve chart
  - X-axis: underlying price at expiration
  - Y-axis: profit & loss
  - Reference vertical line at current underlying price
- Real-time chart update on any input change
- Visual validation feedback (red border + red exclamation mark on empty required fields)
- LaTeX-rendered mathematical derivations (Strategy Guide page)
- Interactive Greek letter sensitivity chart (Strategy Guide page)

---

## Tech Stack
- **Language:** HTML / CSS / JavaScript (no backend, no Python)
- **Deployment:** GitHub Pages
- **Charting library:** TBD (candidates: Chart.js, Plotly.js)
- **Math rendering:** TBD (candidates: MathJax, KaTeX)
- **CSS framework:** TBD (candidates: Tailwind CSS, plain CSS)
- **BS model:** implemented in vanilla JS (no external library)
- **Build tool:** TBD (candidates: Vite, or no build tool via CDN)


## Out of Scope
- **Real-time market data fetching** — No automatic price retrieval from TAIFEX or any external API; all parameters are entered manually by the user
- **Stock / Futures leg support** — Strategies requiring a stock or futures position (e.g., Covered Call, Cash Secured Put, Protective Put, Collar) are not supported; tool covers options-only combinations
- **More than 4 legs** — Maximum leg count is fixed at 4
- **American-style option pricing** — BS model assumes European-style options (no early exercise)
- **Order execution / brokerage integration** — Tool is for visualization and learning only; no live trading functionality
- **Historical backtesting** — No simulation of past performance
- **User accounts / strategy saving** — No login, no persistent storage of user-defined strategies
- **Multi-underlying strategies** — All legs must reference the same underlying asset
