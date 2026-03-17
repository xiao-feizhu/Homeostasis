# AI Agent System - 完整演示脚本

## 📋 演示概览

**演示时长**: 15-20分钟
**目标受众**: 技术评审/产品演示
**演示环境**: 本地开发环境

---

## 🎯 演示目标

1. 展示 6 个 Phase 的完整功能
2. 证明 149 个测试全部通过
3. 演示端到端的对话流程
4. 展示多平台支持能力

---

## 🚀 演示前准备

### 环境检查

```bash
# 1. 检查 Node.js 版本
node -v  # >= 18.0.0

# 2. 检查项目完整性
ls -la src/
ls -la src/console/public/

# 3. 确保依赖已安装
npm install

# 4. 运行测试验证
npm test
```

### 快速启动命令

```bash
# 使用自动脚本
./scripts/full-demo.sh

# 或手动启动
npm test && npx serve src/console/public -p 8080
```

---

## 🎬 演示流程 (15分钟)

### Stage 1: 项目概述 (2分钟)

**讲解内容**:
```
AI Agent System 是基于 Airi 开源项目整合的虚拟形象交互系统。

核心技术栈:
- TypeScript + Node.js
- PixiJS + Live2D (虚拟形象渲染)
- wlipsync (口型同步)
- Web Audio API (语音处理)
- Telegram Bot API (多平台)

6个Phase:
1. Live2D 渲染引擎 ✓
2. 口型同步系统 ✓
3. 角色管线 ✓
4. 音频系统 ✓
5. Telegram Bot ✓
6. Web 控制台 ✓

测试覆盖: 149 tests passed
```

**展示**:
```bash
# 展示项目结构
tree -L 2 src/

# 展示测试结果
npm test -- --silent
```

---

### Stage 2: 测试验证 (2分钟)

**操作**:
```bash
# 运行完整测试套件
npm test
```

**预期输出**:
```
Test Suites: 8 passed, 8 total
Tests:       149 passed, 149 total
Snapshots:   0 total
Time:        5.234s
```

**讲解**:
```
149 个测试覆盖:
- Live2D 适配器 (眨眼、呼吸、注视、表情)
- 口型同步 (音频分析、元音映射)
- 情感分析 (6维指标)
- 角色管线 (分段、延迟、TTS)
- 音频系统 (麦克风、VAD、播放)
- Telegram Bot (消息、命令)
- Console Bridge (状态管理、事件)
```

---

### Stage 3: Live2D 表情系统 (2分钟)

**操作**:
1. 打开浏览器访问 http://localhost:8080
2. 观察角色默认状态 (眨眼 + 呼吸动画)

**演示脚本**:
```bash
# 运行表情演示
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true });
await demo.initialize();
await demo.runScenario('expressions');
"
```

**讲解**:
```
Phase 1 - Live2D 渲染引擎:
- 自动眨眼: 4秒间隔，200ms持续时间
- 呼吸动画: 5%幅度，平滑循环
- 鼠标注视: 跟随鼠标位置
- 表情映射: Neutral/Happy/Sad/Angry/Surprised

技术实现:
- PixiJS + pixi-live2d-display
- AiriLive2DAdapter 封装
- MotionManager 协调动画
```

**观察点**:
- [ ] 眨眼动画自然
- [ ] 呼吸效果流畅
- [ ] 注视跟随鼠标
- [ ] 表情切换平滑

---

### Stage 4: 口型同步 (3分钟)

**操作**:
```bash
# 运行语音演示
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('voice');
"
```

**讲解**:
```
Phase 2 - 口型同步:

音频分析流程:
1. 音频输入 (16kHz采样)
2. MFCC特征提取 (wlipsync WASM)
3. 音素识别 (a, i, u, e, o)
4. 元音映射到口型参数
5. Live2D 实时更新

口型映射:
  a → 张大嘴 (open: 0.8, wide: 0.9)
  i → 扁嘴   (open: 0.3, wide: 0.4)
  u → 圆嘴   (open: 0.2, wide: 0.3)
  e → 中等   (open: 0.5, wide: 0.8)
  o → 圆嘴   (open: 0.6, wide: 0.6)

技术实现:
- wlipsync (Rust + WASM)
- HybridLipSync (文本+音频)
- 平滑过渡算法
```

**观察点**:
- [ ] 口型与语音同步
- [ ] 不同元音口型正确
- [ ] 过渡平滑无跳跃

---

### Stage 5: 角色管线演示 (3分钟)

**操作**:
```bash
# 运行对话演示
npx ts-node -e "
import { DemoRunner } from './src/demo';
const demo = new DemoRunner({ enableLive2D: true, enableAudio: true });
await demo.initialize();
await demo.runScenario('conversation');
"
```

**演示对话**:
```
用户: "你好！"
  ↓
[Segmentation] → ["你好！"]
  ↓
[Emotion Analysis]
  - satisfaction: 60
  - trust: 50
  - frustration: 0
  - urgency: 0
  - engagement: 70 ← 高参与
  - confusion: 0
  - dominant: POSITIVE
  ↓
[Delay] 计算延迟: 800ms
  ↓
[LLM] 生成回复: "你好！很高兴见到你"
  ↓
[TTS] 合成语音
  ↓
[LipSync] 生成口型数据
  ↓
[Live2D] 表情: Happy
  ↓
输出: 文本 + 语音 + 动画
```

**讲解**:
```
Phase 3 - 角色管线:

1. SegmentationEngine (分段)
   - 语义分段策略
   - 最大100字符/段

2. EmotionAnalyzer (情感分析)
   - 6维情感指标
   - 主导状态识别

3. DelayController (延迟控制)
   - 基础延迟: 500-2000ms
   - 情感影响因子
   - 打字速度模拟

4. TTSConnector (语音合成)
   - 系统 TTS / ElevenLabs
   - 缓存机制

5. 事件驱动输出
   - segment.created
   - emotion.updated
   - response.ready
   - tts.complete
```

**浏览器控制台观察**:
```javascript
// 查看实时状态
const state = bridge.getState();
console.log('情感:', state.currentEmotion);
console.log('消息:', state.messages);
```

---

### Stage 6: 语音输入演示 (2分钟)

**操作**:
1. 点击控制台麦克风按钮
2. 说出: "今天天气怎么样"
3. 观察完整流程

**流程展示**:
```
[点击麦克风] → [权限请求]
    ↓
[MicrophoneCapture] 开始捕获
    ↓
[VADEngine] 检测语音开始
    ↓
[录音中...] (可视化波形)
    ↓
[检测到静音 > 500ms]
    ↓
[VADEngine] 检测语音结束
    ↓
[TranscriptionPipeline]
    - 音频缓冲
    - 语音转文字
    ↓
[生成文字] "今天天气怎么样"
    ↓
[发送给 AI]
    ↓
[角色管线处理] → [回复生成]
    ↓
[TTS + Live2D] → [播放]
```

**讲解**:
```
Phase 4 - 音频系统:

输入模块:
- MicrophoneCapture: 16kHz, 降噪
- VADEngine: 自适应阈值, 0.02-0.1
- 前置缓冲: 300ms

转录模块:
- 支持 Whisper / Azure
- 实时/离线模式

输出模块:
- AudioPlayer: Web Audio API
- TTSPlayback: 队列管理
```

---

### Stage 7: Telegram Bot (可选, 2分钟)

**操作** (如配置了 Token):
```bash
export TELEGRAM_BOT_TOKEN="your_token"
npm run telegram
```

**手机演示**:
1. 打开 Telegram
2. 搜索 Bot
3. 发送 `/start`
4. 发送文字消息
5. 发送语音消息

**讲解**:
```
Phase 5 - Telegram Bot:

架构:
Telegram User ↔ Telegram API ↔ Bot ↔ AgentBridge ↔ CharacterPipeline

功能:
- 文字对话 (共享 Console 状态)
- 语音消息 (自动转录)
- TTS 回复 (可选开关)
- 命令支持 (/start, /help, /voice)

技术:
- node-telegram-bot-api
- 轮询模式
- 共享 Pipeline 实例
```

---

### Stage 8: 总结 (1分钟)

**总结要点**:
```
✅ 6个Phase完整实现
✅ 149个测试全部通过
✅ 端到端对话流程
✅ 多平台支持 (Web + Telegram)
✅ 事件驱动架构
✅ TDD开发方法

扩展性:
- 支持自定义 Live2D 模型
- 支持多种 LLM 提供商
- 支持多种 TTS 引擎
- 支持自定义表情映射

生产就绪:
- Docker 部署
- Nginx 反向代理
- 监控和日志
- 安全加固
```

---

## 📊 演示检查清单

### 演示前检查

- [ ] Node.js >= 18
- [ ] `npm install` 完成
- [ ] 149个测试通过
- [ ] Live2D 模型文件存在
- [ ] 浏览器支持 WebGL
- [ ] 麦克风权限 (如需语音)
- [ ] Telegram Token (可选)

### 演示中检查

- [ ] Live2D 动画流畅 (60 FPS)
- [ ] 表情切换正常
- [ ] 口型同步准确
- [ ] 文字对话正常
- [ ] 语音输入正常
- [ ] TTS 播放正常
- [ ] 状态更新正确

### 演示后检查

- [ ] 无错误日志
- [ ] 内存使用正常
- [ ] 资源正确释放

---

## 🐛 演示故障快速修复

### 问题: 测试失败

```bash
# 清除缓存
rm -rf node_modules package-lock.json
npm install
npm test
```

### 问题: Live2D 不显示

```bash
# 检查模型文件
ls src/console/public/assets/live2d/

# 检查浏览器控制台
# 确认 WebGL 启用
```

### 问题: 麦克风不工作

```bash
# 浏览器设置 → 隐私 → 麦克风 → 允许 localhost
```

### 问题: TTS 无声音

```bash
# 需要用户交互后才能播放
# 先点击页面任意位置
```

---

## 🎥 演示命令速查

```bash
# 完整测试
npm test

# 控制台启动
npx serve src/console/public -p 8080

# 表情演示
npx ts-node -e "import {DemoRunner} from './src/demo'; const d = new DemoRunner({enableLive2D:true}); await d.initialize(); await d.runScenario('expressions');"

# 语音演示
npx ts-node -e "import {DemoRunner} from './src/demo'; const d = new DemoRunner({enableLive2D:true,enableAudio:true}); await d.initialize(); await d.runScenario('voice');"

# 对话演示
npx ts-node -e "import {DemoRunner} from './src/demo'; const d = new DemoRunner({enableLive2D:true,enableAudio:true}); await d.initialize(); await d.runScenario('conversation');"

# 完整演示
npm run demo

# Telegram Bot
export TELEGRAM_BOT_TOKEN="xxx"
npm run telegram
```

---

## 📚 相关文档

- `README.md` - 项目概述
- `DEMO-README.md` - Demo 详细说明
- `docs/01-QUICKSTART.md` - 快速开始
- `docs/02-ARCHITECTURE.md` - 架构设计
- `docs/05-DEMO.md` - 演示指南
