#!/bin/bash

echo "=== 開始部署到 GitHub Pages ==="

# 1. 安裝 gh-pages
echo "📦 安裝 gh-pages..."
npm install --save-dev gh-pages

# 2. 初始化 Git（如果還沒有）
if [ ! -d ".git" ]; then
  echo "🔧 初始化 Git..."
  git init
fi

# 3. 加入所有檔案
echo "📝 加入檔案..."
git add .

# 4. 提交
echo "💾 提交程式碼..."
git commit -m "Initial commit: Gear tooth counting tutorial" || echo "已經提交過或無變更"

# 5. 加入遠端倉庫
echo "🔗 加入遠端倉庫..."
git remote add origin https://github.com/jason385/gear-tooth-counting-tutorial.git 2>/dev/null || echo "遠端倉庫已存在"

# 6. 將分支重新命名為 main
echo "🌿 設定主分支..."
git branch -M main

# 7. 推送到 GitHub（可能需要身分驗證）
echo "⬆️  推送到 GitHub..."
git push -u origin main

# 8. 部署到 GitHub Pages
echo "🚀 部署到 GitHub Pages..."
npm run deploy

echo ""
echo "✅ 部署完成！"
echo "🌐 你的網站將在幾分鐘後可以造訪："
echo "   https://jason385.github.io/gear-tooth-counting-tutorial/"
echo ""
echo "💡 提示："
echo "   1. 如果推送失敗，請確認你已經在 GitHub 上建立了 'gear-tooth-counting-tutorial' 倉庫"
echo "   2. 可能需要在 GitHub 設定中啟用 Pages (Settings -> Pages -> Source: gh-pages)"
