#!/bin/bash

echo "=== 开始部署到 GitHub Pages ==="

# 1. 安装 gh-pages
echo "📦 安装 gh-pages..."
npm install --save-dev gh-pages

# 2. 初始化 Git（如果还没有）
if [ ! -d ".git" ]; then
  echo "🔧 初始化 Git..."
  git init
fi

# 3. 添加所有文件
echo "📝 添加文件..."
git add .

# 4. 提交
echo "💾 提交代码..."
git commit -m "Initial commit: Gear tooth counting tutorial" || echo "已经提交过或无更改"

# 5. 添加远程仓库
echo "🔗 添加远程仓库..."
git remote add origin https://github.com/jason385/gear-tooth-counting-tutorial.git 2>/dev/null || echo "远程仓库已存在"

# 6. 重命名分支为 main
echo "🌿 设置主分支..."
git branch -M main

# 7. 推送到 GitHub（可能需要身份验证）
echo "⬆️  推送到 GitHub..."
git push -u origin main

# 8. 部署到 GitHub Pages
echo "🚀 部署到 GitHub Pages..."
npm run deploy

echo ""
echo "✅ 部署完成！"
echo "🌐 你的网站将在几分钟后可以访问："
echo "   https://jason385.github.io/gear-tooth-counting-tutorial/"
echo ""
echo "💡 提示："
echo "   1. 如果推送失败，请确保你已经在 GitHub 上创建了 'gear-tooth-counting-tutorial' 仓库"
echo "   2. 可能需要在 GitHub 设置中启用 Pages (Settings -> Pages -> Source: gh-pages)"
