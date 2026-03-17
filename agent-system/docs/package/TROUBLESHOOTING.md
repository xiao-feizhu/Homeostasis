# 故障排除指南

## 常见问题速查

### 启动问题

#### 问题: `npm install` 失败

**症状**:
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

#### 问题: `npm test` 失败

**症状**:
```
Test Suites: X failed
```

**解决方案**:
```bash
# 查看详细错误
npm test -- --verbose

# 运行单个测试文件
npm test -- avatar.spec.ts

# 更新快照
npm test -- --updateSnapshot
```

---

## Phase 1: Live2D 问题

### 问题: Live2D 模型不显示

**症状**: Canvas 空白，无角色显示

**排查步骤**:

1. 检查 Canvas 元素:
   ```javascript
   document.getElementById('live2d-canvas')
   // 应该返回 <canvas> 元素
   ```

2. 检查模型路径:
   ```bash
   ls src/console/public/assets/live2d/
   # 应该有 model.json 和纹理文件
   ```

3. 检查浏览器控制台错误:
   - 404 错误: 模型路径错误
   - CORS 错误: 需要启用跨域支持
   - WebGL 错误: 浏览器不支持 WebGL

**解决方案**:
```typescript
// 确保正确初始化
const bridge = new ConsoleBridge({
  canvasId: 'live2d-canvas',
  enableLive2D: true,
  modelPath: '/assets/live2d/model.json'  // 检查路径
});

await bridge.initialize();
```

### 问题: 表情切换无效

**症状**: 调用 `setExpression()` 无反应

**排查**:
```typescript
// 检查表情映射
const state = bridge.getState();
console.log('当前表情:', state.live2d.currentExpression);

// 检查模型是否支持该表情
// 查看 model.json 中的 expressions 字段
```

**解决方案**:
- 确保模型文件包含对应表情
- 检查表情名称映射配置

### 问题: 动画卡顿

**症状**: 帧率低，动画不流畅

**解决方案**:
```typescript
// 降低分辨率
const bridge = new ConsoleBridge({
  width: 400,
  height: 300,
});

// 或者禁用部分动画
adapter.setBlinking(false);  // 禁用眨眼
```

---

## Phase 2: 口型同步问题

### 问题: 口型不同步

**症状**: 嘴巴动作与语音不匹配

**排查**:
```typescript
// 检查音频分析是否工作
lipSync.on('analyzing', (data) => {
  console.log('音频数据:', data);
});

// 检查口型输出
console.log('当前口型:', lipSync.getCurrentViseme());
```

**解决方案**:
- 调整 `smoothing.factor` 参数
- 检查音频采样率配置
- 确保音频通道数为 1 (单声道)

### 问题: 口型过于敏感/迟钝

**解决方案**:
```typescript
// 调整阈值
const lipSync = new WlipsyncAdapter({
  threshold: {
    silence: 0.02,           // 提高阈值减少敏感
  },
  smoothing: {
    factor: 0.5,             // 增加平滑度
  }
});
```

---

## Phase 3: 管线问题

### 问题: 响应延迟过长

**症状**: AI 回复等待时间过长

**排查**:
```typescript
// 监听各阶段耗时
pipeline.on(PipelineEvent.SEGMENT_CREATED, () => {
  console.time('pipeline');
});

pipeline.on(PipelineEvent.RESPONSE_READY, () => {
  console.timeEnd('pipeline');
});
```

**解决方案**:
```typescript
// 减少延迟
const config = {
  delay: {
    baseDelay: { min: 200, max: 500 }
  }
};

// 或者禁用延迟模拟
const config = {
  typingSimulation: { enabled: false }
};
```

### 问题: 情感分析不准确

**症状**: 情感状态与用户输入不符

**解决方案**:
- 自定义情感词典
- 调整情感分析权重
- 使用更强大的 LLM 进行情感分析

### 问题: TTS 失败

**症状**: 无语音输出

**排查**:
```typescript
// 检查 TTS 配置
console.log('TTS 配置:', TTSConfig);

// 测试系统 TTS
const utterance = new SpeechSynthesisUtterance('测试');
window.speechSynthesis.speak(utterance);
```

**解决方案**:
- 检查浏览器是否支持 Web Speech API
- 确认 API 密钥有效
- 检查网络连接

---

## Phase 4: 音频问题

### 问题: 麦克风无权限

**症状**: `startVoiceInput()` 抛出权限错误

**解决方案**:
```javascript
// 检查权限状态
navigator.permissions.query({ name: 'microphone' })
  .then(result => {
    console.log('麦克风权限:', result.state);
    // prompt | granted | denied
  });

// 请求权限
navigator.mediaDevices.getUserMedia({ audio: true })
  .catch(err => {
    console.error('权限错误:', err);
    // 引导用户到浏览器设置开启权限
  });
```

### 问题: VAD 无法检测语音

**症状**: 无法触发语音开始/结束事件

**排查**:
```typescript
// 检查音频流
mic.onAudioData((buffer) => {
  const rms = calculateRMS(buffer);
  console.log('音频 RMS:', rms);  // 应该有值 > 0
});

// 检查 VAD 阈值
const vad = new VADEngine({
  threshold: 0.01,             // 降低阈值更易触发
});
```

### 问题: 音频播放无声音

**症状**: `speak()` 执行但无声音

**排查**:
```typescript
// 检查音频上下文状态
const audioContext = new AudioContext();
console.log('AudioContext state:', audioContext.state);
// suspended | running | closed

// 如果是 suspended，需要用户交互
await audioContext.resume();
```

**解决方案**:
- 确保页面有用户交互（点击）后才能播放音频
- 检查系统音量
- 检查浏览器标签页是否静音

### 问题: 转录结果为空

**症状**: 语音输入后无文字输出

**解决方案**:
- 检查网络连接
- 确认转录服务可用
- 提高语音清晰度
- 检查语言设置

---

## Phase 5: Telegram 问题

### 问题: Bot 无响应

**症状**: 发送消息给 Bot 无回复

**排查**:
```bash
# 检查 Token 是否有效
curl https://api.telegram.org/bot<TOKEN>/getMe

# 检查 Webhook 设置
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 如果使用 polling，检查是否有网络代理问题
```

**解决方案**:
```typescript
// 确保正确初始化
const bot = new TelegramBot({
  token: process.env.TELEGRAM_BOT_TOKEN,
  polling: true,
});

await bot.initialize();

// 检查运行状态
console.log('Bot running:', bot.isRunning());
```

### 问题: Webhook 模式不工作

**解决方案**:
```bash
# 删除 webhook 使用 polling
curl https://api.telegram.org/bot<TOKEN>/deleteWebhook

# 或者在代码中
await bot.deleteWebhook();
```

### 问题: 消息发送失败

**症状**: `sendMessage()` 抛出错误

**排查**:
```typescript
// 检查消息长度
if (text.length > 4096) {
  console.error('消息过长');
}

// 检查特殊字符
const hasInvalidChars = /[<>]/g.test(text);
```

---

## Phase 6: 控制台问题

### 问题: 页面空白

**症状**: 打开 http://localhost:8080 显示空白

**排查**:
```bash
# 检查文件是否存在
ls src/console/public/

# 检查服务器是否运行
lsof -i :8080

# 检查控制台错误 (浏览器 DevTools)
```

**解决方案**:
```bash
# 重新启动服务器
npx serve src/console/public -p 8080

# 或者使用其他服务器
python3 -m http.server 8080 --directory src/console/public
```

### 问题: 聊天消息不显示

**症状**: 发送消息后聊天面板无更新

**排查**:
```typescript
// 检查消息监听
bridge.onMessage((msg) => {
  console.log('收到消息:', msg);  // 应该打印
});

// 检查状态更新
bridge.onStateChange((state) => {
  console.log('消息数量:', state.messages.length);
});
```

---

## 性能问题

### 问题: 内存使用过高

**症状**: 浏览器/Node.js 内存占用持续增长

**解决方案**:
```typescript
// 限制消息历史
const config = {
  contextWindow: {
    maxMessages: 20,
  }
};

// 定期清理缓存
setInterval(() => {
  ttsConnector.clearCache();
}, 3600000);

// 销毁时清理
bridge.destroy();
```

### 问题: CPU 使用率高

**症状**: 风扇狂转，电池消耗快

**解决方案**:
```typescript
// 降低 Live2D 帧率
const adapter = new AiriLive2DAdapter({
  targetFps: 30,               // 从 60 降到 30
});

// 减少 VAD 检测频率
const vad = new VADEngine({
  frameDuration: 100,          // 从 30ms 增加到 100ms
});
```

---

## 调试技巧

### 启用调试日志

```typescript
// 设置日志级别
process.env.LOG_LEVEL = 'debug';

// 或在代码中
console.log('Debug:', data);
console.table(array);
console.time('operation');
console.timeEnd('operation');
```

### 浏览器调试

```javascript
// 在浏览器控制台访问 bridge
window.bridge = bridge;

// 然后可以
bridge.getState();
bridge.setExpression(ExpressionType.HAPPY);
```

### Node.js 调试

```bash
# 使用 inspect 模式
node --inspect-brk dist/index.js

# 使用 ndb
npx ndb npm test
```

---

## 获取帮助

### 报告问题

提供以下信息：
1. 错误消息和堆栈跟踪
2. 复现步骤
3. 环境信息 (Node.js 版本、操作系统、浏览器)
4. 配置文件 (删除敏感信息)

### 日志收集

```bash
# 收集系统信息
node -v
npm -v
uname -a

# 收集日志
npm test 2>&1 | tee test.log
```

---

## 已知限制

### 浏览器兼容性

- **Chrome**: 完全支持
- **Firefox**: 完全支持
- **Safari**: 部分支持 (音频需要用户交互)
- **Edge**: 完全支持

### 移动设备

- **iOS Safari**: 有限支持 (WebGL 限制)
- **Android Chrome**: 支持

### 性能限制

- Live2D 模型大小建议 < 10MB
- 同时连接数建议 < 100
- 音频缓冲区建议 < 60秒
