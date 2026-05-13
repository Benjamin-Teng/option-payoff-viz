# Option Payoff Viz｜選擇權損益視覺化工具

🔗 **https://benjamin-teng.github.io/option-payoff-viz/**

> 🇹🇼 繁體中文說明請見下方｜English version follows after the divider

---

## 繁體中文

### 簡介

以互動圖即時呈現選擇權組合策略的損益曲線，適合用於學習各種選擇權策略的損益結構與損益兩平點。以台灣指數選擇權（TXO）為使用情境設計，無需後端、無需帳號，開啟即用。

### 功能特色

- **損益曲線**：即時計算並繪製最多 4 腳的組合策略損益
- **快速策略**：內建 2-Leg、3-Leg、4-Leg 共 18 種常用策略預設，一鍵套用
- **Black-Scholes 定價**：有到期日的策略（如 Calendar Spread）使用 BS 模型計算時間價值
- **損益兩平點**：自動偵測並以綠點標示於圖表轉折處
- **P&L 線性縮放**：以 S=30,000 為基準，依標的價格線性縮放 ±P&L 目標，適用各種標的規模
- **希臘字母互動說明**：Strategy Guide 頁面提供 Black-Scholes 公式與希臘字母滑桿計算器
- **說明浮動視窗**：內建英中術語對照表與互動圖操作說明
- **策略圖片輸出**：一鍵將損益曲線、圖例與腳位明細合成為 PNG 圖片下載，檔名自動對應策略名稱
- **RWD 響應式設計**：針對手機螢幕優化版面，圖例獨立顯示、互動圖自動適應畫面大小

### 技術架構

| 項目 | 說明 |
|---|---|
| 純前端 | HTML / CSS / JavaScript，無框架、無建置工具 |
| 圖表 | [Plotly.js](https://plotly.com/javascript/) via CDN |
| 數學排版 | [KaTeX](https://katex.org/) via CDN |
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

---

## English

### Overview

An interactive P&L visualization tool for options combination strategies. Built for learning options payoff structures and breakeven analysis, designed around Taiwan Index Options (TXO). No backend, no login — runs entirely in the browser.

### Features

- **Live P&L Chart**: Real-time payoff curve for up to 4-leg combinations
- **Strategy Presets**: 18 built-in strategies across 2-Leg, 3-Leg, and 4-Leg categories
- **Black-Scholes Pricing**: Calendar-type strategies use BS model for time value calculation
- **Breakeven Detection**: Automatically marks breakeven points at curve inflection corners
- **P&L Scaling**: Linear P&L target based on underlying price (reference: ±300 at S=30,000)
- **Greeks Calculator**: Interactive sliders for Black-Scholes Greeks on the Strategy Guide page
- **Help Panel**: Built-in English–Chinese glossary and chart interaction guide
- **Image Export**: One-click export of the P&L chart, legend, and leg details as a PNG file; filename auto-matches the strategy name
- **Responsive Design (RWD)**: Mobile-optimized layout with adaptive chart sizing and standalone legend

### Tech Stack

| Item | Detail |
|---|---|
| Frontend only | HTML / CSS / JavaScript — no framework, no build tool |
| Chart | [Plotly.js](https://plotly.com/javascript/) via CDN |
| Math rendering | [KaTeX](https://katex.org/) via CDN |
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
