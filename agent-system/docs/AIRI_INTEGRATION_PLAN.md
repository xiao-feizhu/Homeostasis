# Airi 项目整合计划

## 项目概述

**Airi** (@moeru-ai/airi) 是一个功能完整的 AI Companion/虚拟形象项目，灵感来自 Neuro-sama。
支持 Live2D、VRM、音频处理、记忆系统、多平台部署。

**当前系统**是基于 Express 的 Agent System，已包含：
- 工作流引擎
- 情感系统 (6维度指标)
- 基础虚拟形象 (SVG Live2D)
- 记忆系统 (memU 架构)

---

## Airi 架构分析

### 核心包 (packages)

| 包名 | 功能 | 整合价值 |
|------|------|----------|
| `@proj-airi/stage-ui-live2d` | Live2D 渲染、动作管理、表情系统 | **高** - 替换现有 SVG 实现 |
| `@proj-airi/core-character` | 角色管线协调 (情绪、延迟、TTS) | **中** - 参考设计 |
| `@proj-airi/memory-pgvector` | pgvector 记忆存储 | **低** - 已有记忆系统 |
| `@proj-airi/model-driver-lipsync` | 口型同步 (wlipsync) | **高** - 增强现有口型 |
| `@proj-airi/audio` | 音频处理管道 | **中** - 语音交互 |
| `@proj-airi/stage-ui-three` | Three.js 3D 场景 | **低** - 可选扩展 |

### 应用 (apps)

| 应用 | 用途 | 参考程度 |
|------|------|----------|
| `stage-web` | Web 版虚拟形象主应用 | 主要参考 |
| `stage-tamagotchi` | 桌面宠物模式 | 可选 |
| `stage-pocket` | 移动端 | 可选 |

### 服务 (services)

| 服务 | 功能 | 整合价值 |
|------|------|----------|
| `telegram-bot` | Telegram 机器人集成 | **中** - 展示多平台能力 |

---

## 整合策略

### 方案 A: 渐进式整合 (推荐)
保留现有架构，逐步引入 Airi 组件

**优点：**
- 风险可控
- 现有功能不受影响
- 可逐步验证

**缺点：**
- 整合时间较长
- 需要适配层

### 方案 B: 全面替换
用 Airi 的 stage-web 替换现有 avatar 系统

**优点：**
- 功能完整
- 架构统一

**缺点：**
- 风险高
- 需要大量重构

---

## 实施计划 (方案 A)

### Phase 1: Live2D 渲染引擎整合 (Week 1-2)

**目标**：用 Airi 的 Live2D 实现替换现有 SVG 方案

**任务：**
1. **依赖引入**
   ```bash
   # 需要引入的核心依赖
   pixi-live2d-display  # Live2D 渲染
   @pixi/app             # PixiJS 应用
   @pixi/core            # PixiJS 核心
   pinia                 # 状态管理
   vue                   # UI 框架
   ```

2. **创建适配层** (`src/avatar/adapters/airi-live2d/`)
   - 封装 Airi 的 motion-manager
   - 适配现有 ExpressionType 到 Airi Emotion
   - 保持现有 API 接口不变

3. **关键文件映射**
   | Airi 文件 | 对应到当前系统 |
   |-----------|----------------|
   | `composables/live2d/motion-manager.ts` | `avatar/services/expression.controller.ts` |
   | `stores/live2d.ts` | `avatar/entities/avatar.entity.ts` |
   | `constants/emotions.ts` | `emotion/entities/emotion.entity.ts` |

4. **迁移检查清单**
   - [ ] 引入 PixiJS + Live2D 依赖
   - [ ] 创建 Live2DStore (替代现有 AvatarState)
   - [ ] 实现动作管理器插件系统
   - [ ] 表情映射 (现有 10 种 → Airi 9 种)
   - [ ] 眨眼系统替换
   - [ ] 呼吸动画实现
   - [ ] API 兼容性测试

**风险：**
- Live2D 模型加载方式不同 (需要 .model3.json)
- 依赖 Vue/Pinia 需要逐步引入

---

### Phase 2: 口型同步增强 (Week 2-3)

**目标**：整合 Airi 的 lipsync 驱动

**任务：**
1. **分析现有实现**
   - 当前：基于文本拼音映射
   - Airi：wlipsync + 音频分析

2. **整合方案**
   ```typescript
   // 创建适配器
   src/avatar/adapters/airi-lipsync/
   ├── audio-analyzer.ts      # 音频输入处理
   ├── wlipsync-adapter.ts    # wlipsync 包装
   └── hybrid-lipsync.ts      # 混合模式 (文本+音频)
   ```

3. **功能增强**
   - 保留：文本 fallback (无音频时)
   - 新增：音频实时分析
   - 新增：情感驱动的口型强度

**依赖：**
- `wlipsync` - 口型分析
- Web Audio API - 音频捕获

---

### Phase 3: 角色管线整合 (Week 3-4)

**目标**：引入 Airi 的 core-character 管线

**分析：**
- Airi 的 core-character 是一个事件驱动的管线
- 协调：分段、情感、延迟、TTS

**整合点：**
```typescript
// 在现有情感系统基础上扩展
src/emotion/pipeline/
├── character-pipeline.ts    # 核心管线
├── segmentation.ts          # 输入分段
├── delay-controller.ts      # 延迟控制
└── tts-connector.ts         # TTS 连接
```

**与现有系统关系：**
- 复用：现有 6 维度情感指标
- 增强：添加 Airi 的延迟控制
- 新增：TTS 触发机制

---

### Phase 4: 音频系统 (Week 4-5)

**目标**：添加语音交互能力

**组件：**
1. **音频输入** (`src/audio/input/`)
   - 麦克风捕获
   - VAD (语音活动检测)
   - 降噪处理

2. **音频输出** (`src/audio/output/`)
   - TTS 集成
   - 播放控制
   - 口型同步触发

3. **音频管道** (参考 `packages/audio-pipelines-transcribe`)
   - 转录 (Whisper 等)
   - 实时处理

---

### Phase 5: 多平台服务 (Week 5-6)

**目标**：引入 Telegram Bot 等多平台支持

**方案：**
```typescript
// 扩展现有 API 结构
src/services/
├── telegram/              # 从 Airi 迁移
│   ├── bot.ts
│   ├── agent/
│   └── llm/
└── discord/               # 未来扩展
```

**整合策略：**
- 复用 Airi 的 telegram-bot 服务代码
- 适配到现有 Express API 框架
- 共享：情感系统、记忆系统

---

### Phase 6: 演示控制台 (Week 6-7)

**目标**：参考 stage-web 创建统一控制台

**功能：**
1. **Live2D 场景**
   - 模型加载/切换
   - 实时表情控制
   - 口型同步可视化

2. **对话界面**
   - 聊天记录
   - 语音输入/输出
   - 情感状态显示

3. **系统集成**
   - 记忆查看
   - 工作流触发
   - 设置面板

**技术栈：**
- 参考：Vue 3 + TresJS (stage-web)
- 或保持：原生 HTML/Canvas (简化)

---

## 技术债务与决策

### 关键技术决策

| 决策 | 选项 | 建议 |
|------|------|------|
| 前端框架 | Vue 3 (Airi) vs 保持原生 | 保持原生，渐进引入 Vue 组件 |
| 状态管理 | Pinia (Airi) vs 现有 | 创建适配层，逐步迁移 |
| 渲染引擎 | PixiJS (Airi) vs SVG (现有) | 完全替换为 PixiJS |
| 记忆系统 | pgvector (Airi) vs 现有 | 保持现有，未来可考虑迁移 |

### 需要创建的适配层

```
src/adapters/airi/
├── live2d/
│   ├── motion-adapter.ts      # 动作系统适配
│   ├── emotion-adapter.ts     # 表情映射
│   └── store-adapter.ts       # 状态管理适配
├── lipsync/
│   └── wlipsync-adapter.ts    # 口型同步适配
└── character/
    └── pipeline-adapter.ts    # 角色管线适配
```

---

## 依赖分析

### 必须引入
```json
{
  "pixi-live2d-display": "^0.5.0",
  "@pixi/app": "^7.0.0",
  "@pixi/core": "^7.0.0",
  "wlipsync": "^1.3.0",
  "pinia": "^2.1.0"
}
```

### 可选引入
```json
{
  "vue": "^3.4.0",
  "@tresjs/core": "^5.5.0",
  "@huggingface/transformers": "^3.8.0"
}
```

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Live2D 模型兼容性问题 | 中 | 高 | 准备多个测试模型 |
| Vue/Pinia 引入复杂性 | 中 | 中 | 渐进引入，保持现有 API |
| 音频权限问题 (浏览器) | 高 | 中 | 提供降级方案 (纯文本) |
| 性能问题 (PixiJS) | 低 | 中 | 优化渲染循环 |

---

## 里程碑

| 里程碑 | 交付物 | 验收标准 |
|--------|--------|----------|
| M1 | Live2D 基础渲染 | 可在浏览器显示 Live2D 模型 |
| M2 | 表情+口型同步 | 表情切换流畅，口型与音频同步 |
| M3 | 语音交互 | 完整语音对话流程 |
| M4 | Telegram 集成 | 可在 Telegram 与 Agent 对话 |
| M5 | 完整演示 | 一体化控制台，所有功能可用 |

---

## 参考资源

- Airi GitHub: https://github.com/moeru-ai/airi
- Live2D Web SDK: https://github.com/guansss/pixi-live2d-display
- wlipsync: https://github.com/w-nowak/wlipsync

---

## 附录：文件映射详表

### Airi → Current System

| Airi 路径 | 当前系统路径 | 整合方式 |
|-----------|-------------|----------|
| `packages/stage-ui-live2d/src/composables/live2d/` | `src/avatar/services/` | 替换/增强 |
| `packages/stage-ui-live2d/src/stores/live2d.ts` | `src/avatar/entities/avatar.entity.ts` | 参考重构 |
| `packages/stage-ui-live2d/src/constants/emotions.ts` | `src/emotion/entities/emotion.entity.ts` | 映射对照 |
| `packages/model-driver-lipsync/src/` | `src/avatar/services/lipsync.engine.ts` | 替换 |
| `services/telegram-bot/src/` | `src/api/services/telegram/` | 迁移 |
| `apps/stage-web/src/` | `public/demo-console/` | 参考重构 |

---

*计划版本: v1.0*
*创建时间: 2026-03-16*
