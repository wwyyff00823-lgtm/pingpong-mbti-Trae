#!/bin/bash

# 乒乓球MBTI测试 - 快速部署脚本
# 此脚本帮助您快速部署到Netlify

echo "🚀 乒乓球MBTI测试 - 快速部署"
echo "================================"
echo ""

# 检查是否安装了Netlify CLI
if ! command -v netlify &> /dev/null
then
    echo "⚠️  Netlify CLI未安装"
    echo "正在安装 Netlify CLI..."
    npm install -g netlify-cli
fi

echo "✅ Netlify CLI已安装"
echo ""

# 检查.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env文件不存在"
    echo "请先创建.env文件并配置虎皮椒凭证"
    exit 1
fi

echo "✅ .env文件已存在"
echo ""

# 提示用户配置环境变量
echo "📝 部署前请确认："
echo "1. 已在Netlify后台配置环境变量"
echo "   - HUPIJIAO_APPID"
echo "   - HUPIJIAO_APP_SECRET"
echo "   - HUPIJIAO_NOTIFY_URL"
echo "   - HUPIJIAO_RETURN_URL"
echo ""
echo "2. 已在虎皮椒后台配置回调地址"
echo ""
read -p "是否已完成配置？(y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ 请先完成配置后再部署"
    echo "查看配置指南：NETLIFY-CONFIG.md"
    exit 1
fi

echo ""
echo "🚀 开始部署..."
echo ""

# 部署到Netlify
netlify deploy --prod

echo ""
echo "✅ 部署完成！"
echo ""
echo "🎯 下一步："
echo "1. 访问您的Netlify站点URL"
echo "2. 测试支付流程"
echo "3. 确认虎皮椒账户收到款项"
echo ""
echo "📖 详细配置请查看：NETLIFY-CONFIG.md"