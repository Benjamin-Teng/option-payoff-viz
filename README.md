# Option Payoff Viz｜選擇權損益視覺化工具

🔗 **https://benjamin-teng.github.io/option-payoff-viz/**

> 🇹🇼 繁體中文說明請見下方｜English version follows after the divider

---

## 繁體中文

### 簡介

以互動圖即時呈現選擇權組合策略的損益曲線，適合用於學習各種選擇權策略的損益結構與損益兩平點。以台灣指數選擇權（TXO）為使用情境設計，無需後端、無需帳號，開啟即用。

### 功能特色

- **損益曲線**：即時計算並繪製最多 4 腳的組合策略損益，獲利區淺綠、虧損區淺紅填色
- **快速策略**：內建 2-Leg、3-Leg、4-Leg 共 26 種常用策略預設，一鍵套用
- **自適應視窗**：圖表自動對焦到策略關鍵區域，確保所有轉折點（strike）與損益兩平點皆在可視範圍內
- **互動式縮放與平移**：桌面支援滾輪 / trackpad pinch 縮放、拖曳平移；手機支援雙指 pinch 縮放及平移，單指捲動頁面
- **Black-Scholes 定價**：有到期日的策略（如水平價差）使用 BS 模型計算時間價值
- **損益兩平點**：自動偵測並以綠點標示於圖表
- **Max Gain / Max Loss**：即時顯示策略的最大獲利與最大虧損，無上限時顯示 ±∞
- **P&L 線性縮放**：以 S=30,000 為基準，依標的價格線性縮放 ±P&L 目標，適用各種標的規模
- **希臘字母互動說明**：Greeks Explorer 頁面提供 Black-Scholes 公式與希臘字母滑桿計算器
- **說明浮動視窗**：內建英中術語對照表與互動圖操作說明
- **策略圖片輸出**：一鍵將損益曲線、圖例、策略名稱、Max Gain / Max Loss / Breakeven 與組合明細輸出為 1400px PNG 圖片
- **RWD 響應式設計**：針對手機螢幕優化版面，按鈕縮為 icon-only，圖例獨立顯示
- **Ghost-value 輸入體驗**：點擊履約價 / 權利金欄位時，原始值轉為灰色提示；輸入後立即更新圖表；Spinner 箭頭從有效值連續增減
- **繁體中文介面**：Option Combination 頁面全面中文化，含策略名稱、圖表標籤、損益統計與圖片輸出

### 技術架構

| 項目 | 說明 |
|---|---|
| 純前端 | HTML / CSS / JavaScript，無框架、無建置工具 |
| 圖表 | [Plotly.js](https://plotly.com/javascript/) via CDN |
| 數學排版 | [KaTeX](https://katex.org/) via CDN |
| 字型 | [Outfit](https://fonts.google.com/specimen/Outfit) + [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC) via Google Fonts |
| Black-Scholes 定價 | 自製 `bs.js`，用於水平價差等含到期日策略的時間價值計算 |
| 圖片輸出 | HTML Canvas 2D API（合成損益圖 + 圖例 + 腳位表格） |
| 社群預覽 | Open Graph Protocol meta tags + og-image.png |
| og-image 產生 | Python [Pillow](https://python-pillow.org/)（開發期一次性腳本） |
| 部署 | GitHub Pages |

### 本地開發

```bash
# 直接用瀏覽器開啟，或使用 VS Code Live Server 擴充套件
open index.html
```

不需要安裝任何相依套件。

### 部署至 GitHub Pages

1. 將專案推送至 GitHub repository
2. 前往 **Settings → Pages**
3. Source 選擇 `main` branch，root 目錄
4. 儲存後稍待片刻即可取得網址

### 使用方式

1. 在 **Underlying Price** 欄位輸入標的現貨價格（必填）
2. 手動新增腳位（**+ Add Leg**），或從下方快速策略選單一鍵套用
3. 調整各腳位的履約價（Strike）與權利金（Premium）
4. 圖表即時更新損益曲線與損益兩平點
5. 頁面右上角有 **Option Combination** 與 **Greeks Explorer** 可以選頁
6. **Option Combination** 用於分析組合損益；**Greeks Explorer** 用於理解選擇權定價模型

---

## English

### Overview

An interactive P&L visualization tool for options combination strategies. Built for learning options payoff structures and breakeven analysis, designed around Taiwan Index Options (TXO). No backend, no login — runs entirely in the browser.

### Features

- **Live P&L Chart**: Real-time payoff curve for up to 4-leg combinations, with semi-transparent green/red fill for profit/loss regions
- **Strategy Presets**: 26 built-in strategies across 2-Leg, 3-Leg, and 4-Leg categories
- **Adaptive Chart View**: Automatically focuses on the strategy's key region, ensuring all strike turning points and breakeven prices are visible
- **Interactive Zoom & Pan**: Desktop supports mouse wheel / trackpad pinch zoom and drag-to-pan; mobile supports two-finger pinch zoom and pan, single-finger page scroll
- **Black-Scholes Pricing**: Calendar-type strategies use BS model for time value calculation
- **Breakeven Detection**: Automatically marks breakeven points at curve zero-crossings
- **Max Gain / Max Loss**: Live display of maximum profit and loss; shows ±∞ for unbounded strategies
- **P&L Scaling**: Linear P&L target based on underlying price (reference: ±300 at S=30,000)
- **Greeks Calculator**: Interactive sliders for Black-Scholes Greeks on the Greeks Explorer page
- **Help Panel**: Built-in English–Chinese glossary and chart interaction guide
- **Image Export**: One-click export as 1400px PNG — includes P&L chart, legend, strategy name, Max Gain / Max Loss / Breakeven, and leg table
- **Responsive Design (RWD)**: Mobile-optimized layout with icon-only buttons and standalone legend
- **Ghost-value Input UX**: Strike / Premium fields show previous value as gray hint on focus; chart updates live on each keystroke; spinner increments from the current valid value
- **Traditional Chinese UI**: Option Combination page fully localized — strategy names, chart labels, P&L stats, and image export all in Traditional Chinese

### Tech Stack

| Item | Detail |
|---|---|
| Frontend only | HTML / CSS / JavaScript — no framework, no build tool |
| Chart | [Plotly.js](https://plotly.com/javascript/) via CDN |
| Math rendering | [KaTeX](https://katex.org/) via CDN |
| Fonts | [Outfit](https://fonts.google.com/specimen/Outfit) + [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC) via Google Fonts |
| Black-Scholes pricing | Custom `bs.js` for time-value calculation in expiry-dated strategies (Calendar Spread etc.) |
| Image export | HTML Canvas 2D API (composites P&L chart + legend + leg table) |
| Social preview | Open Graph Protocol meta tags + og-image.png |
| og-image generation | Python [Pillow](https://python-pillow.org/) (one-time dev script) |
| Deployment | GitHub Pages |

### Run Locally

```bash
# Open directly in browser, or use VS Code Live Server extension
open index.html
```

No dependencies to install.

### Deploy to GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Set Source to `main` branch, root directory
4. Save and wait a moment for the URL to appear

### How to Use

1. Enter the underlying spot price in the **Underlying Price** field (required)
2. Add legs manually with **+ Add Leg**, or apply a preset strategy from the quick selector
3. Adjust each leg's Strike and Premium
4. The chart updates in real time with the P&L curve and breakeven points
5. Use the tabs in the top-right corner to switch between **Option Combination** and **Greeks Explorer**
6. **Option Combination** is for analyzing strategy P&L; **Greeks Explorer** is for understanding the options pricing model
