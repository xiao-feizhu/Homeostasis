# AI Agent System Demo 演示脚本

## 演示概览

**目标**: 展示 Airi 集成后的完整 AI Agent 系统功能
**时长**: 约 15-20 分钟
**方式**: 控制台界面 + 语音交互

---

## 演示准备

### 1. 环境检查清单

```bash
# 运行所有测试
npm test

# 启动服务
npm run dev

# 检查控制台
open http://localhost:3000/console
```

### 2. 预设配置

```typescript
// 演示模式配置
const DEMO_CONFIG = {
  // Live2D 模型
  modelPath: '/assets/live2d/airi.model3.json',

  // TTS 语音
  voice: 'female-zh',

  // 自动表情切换
  autoExpression: true,

  // 语音回复
  voiceResponse: true,
};
```

---

## 演示流程 (15 分钟)

### 阶段 1: 系统启动 & Live2D 展示 (2 分钟)

**操作步骤**:
1. 打开控制台页面
2. 观察 Live2D 模型加载
3. 展示基础动画:
   - 眨眼 (Auto Blink)
   - 呼吸 (Breathing)
   - 注视 (Idle Eye Focus)

**解说词**:
> "系统启动后，Live2D 模型自动加载。可以看到自然的眨眼、呼吸和注视动画，这些都是通过 Airi 的 motion-manager 实现的。"

---

### 阶段 2: 表情控制演示 (2 分钟)

**操作步骤**:
1. 点击场景下方的表情按钮:
   - Neutral → Happy
   - Happy → Sad
   - Sad → Surprised
   - Surprised → Neutral

2. 观察模型表情变化
3. 查看右侧情感状态指示器

**解说词**:
> "通过 EmotionMapper，系统可以将 6 维情感指标映射到 Live2D 表情。当前展示的是直接控制模式。"

**技术要点**:
```typescript
// 表情映射关系
NEUTRAL  → 'Idle'
HAPPY    → 'Happy'
SAD      → 'Sad'
ANGRY    → 'Angry'
SURPRISED→ 'Surprised'
```

---

### 阶段 3: 文字对话演示 (3 分钟)

**场景**: 基础对话 + 情感分析

**操作步骤**:

#### 对话 1: 问候
```
用户: 你好！
AI: 你好！很高兴见到你。我是你的 AI 助手。
    [表情: Happy] [语音: 播放]
```

#### 对话 2: 求助
```
用户: 我有点难过
AI: 听到这个消息我也感到难过。能告诉我发生了什么吗？
    [表情: Sad] [语音: 播放]
```

#### 对话 3: 感谢
```
用户: 谢谢你的关心
AI: 不客气！我很高兴能帮到你。
    [表情: Happy] [语音: 播放]
```

**解说词**:
> "CharacterPipeline 协调了整个对话流程：
> 1. 输入分段 → 2. 情感分析 → 3. TTS 生成 → 4. 口型同步 → 5. Live2D 表情"

---

### 阶段 4: 语音交互演示 (3 分钟)

**操作步骤**:
1. 点击麦克风按钮
2. 说出: "今天天气怎么样"
3. 观察:
   - VAD 检测语音活动
   - 转录结果显示
   - AI 语音回复
   - 口型同步效果

**解说词**:
> "音频系统包含：
> - MicrophoneCapture: 实时音频捕获
> - VADEngine: 语音活动检测
> - TranscriptionPipeline: 语音转文字
> - TTSPlayback: 语音合成 + 口型同步"

**技术展示**:
```typescript
// 口型同步数据
const lipSyncData = [
  { time: 0, vowel: 'a', intensity: 0.8 },
  { time: 100, vowel: 'i', intensity: 0.6 },
  { time: 200, vowel: 'sil', intensity: 0 },
];
```

---

### 阶段 5: Telegram Bot 演示 (3 分钟)

**操作步骤**:
1. 打开手机 Telegram
2. 搜索 Bot: `@YourDemoBot`
3. 发送 `/start`
4. 发送文字消息
5. 发送语音消息
6. 查看 `/help` 命令

**演示对话**:
```
用户: /start
Bot: 🎉 欢迎使用 AI Agent Bot! 我是你的智能助手...

用户: 你能做什么？
Bot: 我可以：
• 💬 进行智能对话
• 🎭 表达情感
• 🔊 语音回复

用户: /voice
Bot: 🔊 语音回复已开启

用户: [语音] 讲个笑话
Bot: [语音回复] 好的，这是一个笑话...
```

**解说词**:
> "TelegramAgentBridge 将 Bot 接入到相同的 Agent System，共享情感分析和记忆系统。"

---

### 阶段 6: 综合场景演示 (2 分钟)

**场景**: 多轮情感对话

**对话流程**:
```
用户: 我今天工作特别顺利！
[AI分析: satisfaction=90, trust=80, state=POSITIVE]
AI: 太棒了！恭喜你！看到你开心我也很高兴。😊
   [表情: Happy] [语调: 兴奋]

用户: 但是下午有个紧急问题要处理...
[AI分析: urgency=80, engagement=90, state=NEUTRAL]
AI: 没问题，慢慢来。需要我帮你分析吗？
   [表情: Concerned] [语调: 关切]

用户: 解决了！一切都很好
[AI分析: satisfaction=95, state=POSITIVE]
AI: 太好了！你真厉害！🎉
   [表情: Excited] [语调: 庆祝]
```

**解说词**:
> "整个系统通过 EmotionMetrics 六维指标实时跟踪用户情感，驱动 Live2D 表情、TTS 语调和对话策略。"

---

## 演示脚本 (Console API)

```typescript
// 完整演示脚本
import { ConsoleBridge } from './console';

async function runDemo() {
  const console = new ConsoleBridge({
    canvasId: 'live2d-canvas',
    enableLive2D: true,
    enableAudio: true,
    enablePipeline: true,
  });

  // 1. 初始化
  await console.initialize();

  // 2. 加载模型
  await console.loadLive2DModel('/path/to/model.json');

  // 3. 设置表情
  await console.setExpression(ExpressionType.HAPPY);

  // 4. 发送消息
  await console.sendMessage('你好！');

  // 5. 语音输入
  await console.startVoiceInput();

  // 6. 语音输出
  await console.speak('很高兴见到你！');
}
```

---

## 故障处理

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| Live2D 模型未加载 | 检查模型路径，刷新页面 |
| 麦克风无权限 | 检查浏览器权限设置 |
| TTS 无声音 | 检查系统音量，尝试 /voice 命令切换 |
| Telegram Bot 无响应 | 检查 token，查看日志 |

### 备选方案

如果语音功能不可用，切换为纯文字模式:
```typescript
const FALLBACK_CONFIG = {
  enableAudio: false,
  textOnly: true,
};
```

---

## 演示总结

### 展示的技术栈

1. **Phase 1**: PixiJS + Live2D (可视化)
2. **Phase 2**: wlipsync (口型同步)
3. **Phase 3**: CharacterPipeline (对话管线)
4. **Phase 4**: Web Audio API (音频系统)
5. **Phase 5**: Telegram Bot (多平台)
6. **Phase 6**: Console (统一界面)

### 核心架构

```
用户输入 → VAD检测 → 转录 → 情感分析 →
    ↓
CharacterPipeline → TTS → 口型同步 → Live2D
    ↓
Telegram / Console / API
```

---

## 附录: 快速启动命令

```bash
# 1. 安装依赖
npm install

# 2. 运行测试
npm test

# 3. 启动开发服务器
npm run dev

# 4. 启动控制台
open http://localhost:3000/console

# 5. 设置 Telegram Bot Token
export TELEGRAM_BOT_TOKEN=your_token_here
```
