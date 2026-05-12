# 齒輪齒數計算教學 (Gear Tooth Counting Tutorial)

以 5 種傳統影像處理方法計算單一齒輪「齒數」的互動式教學網站。

**🌐 部署網址**：<https://jason385.github.io/gear-tooth-counting-tutorial/>

## 內容

涵蓋 5 種傳統方法：

1. 極座標展開 + 峰值偵測 (Polar Transform + Peak Detection)
2. 輪廓凸性缺陷 (Contour + Convexity Defects)
3. 徑向剖面峰值 (Radial Profile Peak Counting)
4. Canny 邊緣角頻率分析 (Canny + FFT)
5. 模板齒形匹配 (Tooth Template Matching)

每種方法皆包含概念說明、動態視覺化、完整 Python 程式碼及優缺點對比，並支援手機 / 平板 / 桌面響應式排版。

## 作者

**黃傑翔**
國立雲林科技大學 電子工程系
課程：數位影像處理導論

## 技術棧

React 19 + Vite，部署於 GitHub Pages。

## 本地開發

```bash
npm install
npm run dev
```

## 部署

第一次部署：執行 `./deploy.sh`（會建立 git repo、推上 GitHub、再用 `gh-pages` 發佈到 `gh-pages` 分支）。

之後只要修改完程式碼，跑：

```bash
npm run deploy
```

即可重新發佈。
