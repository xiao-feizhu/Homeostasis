# Agent System - 工作流引擎

一个功能完整的工作流引擎，支持 DAG 执行、HITL（人工介入）、错误处理、版本控制和性能监控。

## 功能特性

### 核心功能
- **DAG 执行引擎** - 基于拓扑排序的工作流执行
- **状态管理** - 事件溯源 + 快照机制
- **节点执行器** - 插件化架构，支持 10+ 种节点类型

### 节点类型
| 节点 | 描述 |
|------|------|
| Start/End | 工作流起止节点 |
| Condition | 条件分支（支持表达式）|
| Code | JavaScript 代码执行（安全沙箱）|
| LLM | Claude API 集成 |
| API | HTTP 请求调用 |
| HITL | 人工审批/输入 |
| Loop | 循环执行（for/while/foreach）|
| Parallel | 并行执行（all/any/race）|
| Subflow | 子流程调用 |

### HITL 系统
- **断点管理** - 静态/动态/手动断点
- **审批引擎** - 或签/会签/顺序签/投票
- **干预处理** - 暂停/跳过/重试/回滚
- **通知服务** - 多渠道通知（邮件/短信/推送）
- **审计日志** - GDPR 合规

### 错误处理
- **错误分类** - 可重试/不可重试
- **重试策略** - Fixed/Exponential/Linear/Custom
- **死信队列** - 失败执行管理
- **补偿事务** - Saga 模式

### 版本控制
- **语义化版本** - major.minor.patch
- **版本比较** - 变更检测
- **迁移引擎** - 执行中工作流迁移

### 性能监控
- **指标收集** - Counter/Gauge/Histogram/Timer
- **Prometheus 导出**
- **告警管理** - 阈值告警
- **缓存优化** - LRU + TTL

## 快速开始

### 安装
```bash
npm install
```

### 运行测试
```bash
# 运行所有测试
npm test

# 覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch
```

### 基础示例
```typescript
import {
  WorkflowValidator,
  DAGExecutor,
  StateManager,
  NodeExecutorRegistry,
  NodeExecutionContextImpl
} from './src/workflow';

// 1. 验证工作流
const validator = new WorkflowValidator();
const result = validator.validate(workflowDefinition);

// 2. 执行工作流
const dagExecutor = new DAGExecutor();
const execution = await dagExecutor.execute(
  workflowDefinition,
  {
    executionId: 'exec-001',
    workflowId: 'wf-001',
    userId: 'user-001',
    variables: {}
  },
  async (node, context) => {
    // 节点执行逻辑
    return registry.execute(node, context);
  }
);
```

## 项目结构

```
src/workflow/
├── entities/          # 实体定义
├── validators/        # 验证器
├── executors/         # 执行器
├── errors/            # 错误处理
├── versioning/        # 版本控制
├── monitoring/        # 性能监控
├── stores/            # 状态管理
├── hitl/              # HITL 系统
├── repositories/      # 存储层
└── __tests__/         # 测试
```

## 测试统计

- **测试文件**: 34 个
- **测试用例**: 598 个
- **测试通过率**: 99.8%
- **TypeScript**: 类型检查通过

## 技术栈

- TypeScript
- Jest (测试)
- Node.js vm (沙箱)
- Anthropic SDK (Claude API)

## 文档

- [TDD 报告](./TDD-REPORT.md) - 详细实现报告

## 许可证

MIT
