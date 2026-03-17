#!/bin/bash
# AI Agent System 文档打包脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$SCRIPT_DIR/package"
OUTPUT_DIR="$SCRIPT_DIR"

# 版本号
VERSION="1.0.0"
DATE=$(date +%Y%m%d)
ARCHIVE_NAME="ai-agent-system-docs-v${VERSION}-${DATE}"

echo "📦 AI Agent System 文档打包工具"
echo "================================"
echo ""

# 检查文档目录是否存在
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ 错误: 文档目录不存在: $PACKAGE_DIR"
    exit 1
fi

# 检查必需文件
REQUIRED_FILES=(
    "README.md"
    "01-QUICKSTART.md"
    "02-ARCHITECTURE.md"
    "03-CONFIGURATION.md"
    "04-API.md"
    "05-DEMO.md"
    "06-DEPLOYMENT.md"
    "CHANGELOG.md"
    "TROUBLESHOOTING.md"
)

echo "📋 检查文档完整性..."
MISSING=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PACKAGE_DIR/$file" ]; then
        SIZE=$(du -h "$PACKAGE_DIR/$file" | cut -f1)
        echo "  ✅ $file ($SIZE)"
    else
        echo "  ❌ $file (缺失)"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
if [ $MISSING -gt 0 ]; then
    echo "⚠️  警告: 有 $MISSING 个文件缺失"
    read -p "是否继续打包? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建临时目录
echo ""
echo "📁 创建临时目录..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 复制文档
echo "📄 复制文档文件..."
cp -r "$PACKAGE_DIR" "$TEMP_DIR/$ARCHIVE_NAME"

# 创建归档 (tar.gz)
echo ""
echo "🗜️  创建归档..."
cd "$TEMP_DIR"
tar -czf "$OUTPUT_DIR/${ARCHIVE_NAME}.tar.gz" "$ARCHIVE_NAME"

# 创建归档 (zip)
if command -v zip &> /dev/null; then
    zip -rq "$OUTPUT_DIR/${ARCHIVE_NAME}.zip" "$ARCHIVE_NAME"
    ZIP_CREATED=true
else
    echo "⚠️  zip 命令未找到，跳过 zip 归档"
    ZIP_CREATED=false
fi

cd "$OUTPUT_DIR"

# 显示结果
echo ""
echo "✅ 打包完成!"
echo "================================"
echo ""
echo "📦 输出文件:"
echo "  📄 ${ARCHIVE_NAME}.tar.gz ($(du -h "${ARCHIVE_NAME}.tar.gz" | cut -f1))"
if [ "$ZIP_CREATED" = true ]; then
    echo "  📄 ${ARCHIVE_NAME}.zip ($(du -h "${ARCHIVE_NAME}.zip" | cut -f1))"
fi
echo ""
echo "📂 输出目录: $OUTPUT_DIR"
echo ""
echo "📖 文档清单:"
echo "  - README.md          项目概述和快速开始"
echo "  - 01-QUICKSTART.md   5分钟快速上手"
echo "  - 02-ARCHITECTURE.md 系统架构设计"
echo "  - 03-CONFIGURATION.md 配置指南"
echo "  - 04-API.md          API 文档"
echo "  - 05-DEMO.md         演示指南"
echo "  - 06-DEPLOYMENT.md   部署文档"
echo "  - CHANGELOG.md       更新日志"
echo "  - TROUBLESHOOTING.md 故障排除"
echo ""
echo "🚀 使用方式:"
echo "  tar -xzf ${ARCHIVE_NAME}.tar.gz"
echo "  cd $ARCHIVE_NAME"
echo "  cat README.md"
echo ""

# 清理
trap - EXIT
