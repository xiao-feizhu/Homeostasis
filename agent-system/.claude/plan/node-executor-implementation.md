# 节点执行器实现计划

## 1. 概述

实现工作流引擎的节点执行器系统，支持多种节点类型的执行。采用插件架构，便于扩展新的节点类型。

## 2. 实现目标

- 核心节点执行器：LLM、API、CODE、HITL、CONDITION
- 插件化注册机制
- 统一的执行上下文管理
- 完善的错误处理和重试机制
- 输入/输出参数映射

## 3. 实现步骤

### Phase 1: 执行器框架 (3 个测试文件)

#### 3.1 执行器接口与注册表
**文件**: `src/workflow/executors/node.executor.ts`

```typescript
// 核心接口
interface NodeExecutor {
  readonly type: NodeType;
  execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult>;
  validate?(node: WorkflowNode): ValidationResult;
}

// 执行上下文
interface ExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  input: Record<string, any>;
  state: Record<string, any>;
  getVariable(path: string): any;
  setVariable(path: string, value: any): void;
}

// 执行结果
interface NodeExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: ExecutionError;
  nextNodeId?: string; // 条件分支用
}
```

**测试**: `node.executor.spec.ts` (15-20 个测试用例)
- 注册执行器
- 获取执行器
- 执行节点
- 参数映射
- 错误处理

#### 3.2 执行器注册表
**文件**: `src/workflow/executors/executor.registry.ts`

功能：
- 注册/注销执行器
- 按类型获取执行器
- 支持自定义执行器加载

**测试**: `executor.registry.spec.ts` (10-15 个测试用例)

---

### Phase 2: 基础节点执行器 (5 个测试文件)

#### 3.3 Start/End 节点执行器
**文件**: `src/workflow/executors/start.executor.ts`, `end.executor.ts`

**测试**: `start-end.executor.spec.ts` (5-8 个测试用例)

#### 3.4 Condition 节点执行器
**文件**: `src/workflow/executors/condition.executor.ts`

功能：
- 条件表达式求值
- 分支路由

**测试**: `condition.executor.spec.ts` (10-12 个测试用例)
- 布尔条件
- 比较表达式
- 逻辑运算
- 分支选择

#### 3.5 Code 节点执行器
**文件**: `src/workflow/executors/code.executor.ts`

功能：
- JavaScript 代码执行
- 沙箱安全限制
- 超时控制

**测试**: `code.executor.spec.ts` (12-15 个测试用例)
- 代码执行
- 输入/输出映射
- 沙箱安全
- 超时处理

---

### Phase 3: 核心节点执行器 (3 个测试文件)

#### 3.6 LLM 节点执行器
**文件**: `src/workflow/executors/llm.executor.ts`

配置：
```typescript
interface LLMNodeConfig {
  model: string;           // claude-sonnet-4-6, gpt-4, etc.
  systemPrompt?: string;   // 系统提示词
  userPrompt: string;      // 用户提示词（支持模板）
  temperature?: number;    // 0-1
  maxTokens?: number;      // 最大令牌数
  tools?: Tool[];          // 工具调用
  responseFormat?: 'text' | 'json' | 'structured';
  outputMapping: {
    content: string;       // 输出到变量路径
    usage?: string;        // token 使用量
    finishReason?: string;
  };
}
```

**测试**: `llm.executor.spec.ts` (15-20 个测试用例)
- 提示词渲染
- LLM 调用
- 输出解析
- 错误重试
- Token 限制

#### 3.7 API 节点执行器
**文件**: `src/workflow/executors/api.executor.ts`

配置：
```typescript
interface APINodeConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;                    // 支持模板变量
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;                     // 请求体
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryCondition: 'always' | '5xx' | 'network';
  };
  outputMapping: {
    statusCode: string;
    body: string;
    headers?: string;
  };
}
```

**测试**: `api.executor.spec.ts` (15-18 个测试用例)
- HTTP 请求
- 模板渲染
- 响应处理
- 错误重试
- 超时处理

#### 3.8 HITL 节点执行器
**文件**: `src/workflow/executors/hitl.executor.ts`

功能：
- 创建断点
- 等待人工输入
- 审批处理
- 超时处理

**测试**: `hitl.executor.spec.ts` (12-15 个测试用例)
- 断点创建
- 人工输入
- 审批流程
- 超时处理

---

### Phase 4: 高级节点执行器 (2 个测试文件)

#### 3.9 Loop 节点执行器
**文件**: `src/workflow/executors/loop.executor.ts`

功能：
- For 循环
- While 循环
- 迭代映射

**测试**: `loop.executor.spec.ts` (10-12 个测试用例)

#### 3.10 Parallel 节点执行器
**文件**: `src/workflow/executors/parallel.executor.ts`

功能：
- 并行分支执行
- 聚合结果
- 部分失败处理

**测试**: `parallel.executor.spec.ts` (10-12 个测试用例)

---

## 4. 文件结构

```
src/workflow/executors/
├── node.executor.ts          # 接口定义
├── executor.registry.ts      # 注册表
├── start.executor.ts         # 开始节点
├── end.executor.ts           # 结束节点
├── condition.executor.ts     # 条件节点
├── code.executor.ts          # 代码节点
├── llm.executor.ts           # LLM 节点
├── api.executor.ts           # API 节点
├── hitl.executor.ts          # HITL 节点
├── loop.executor.ts          # 循环节点
├── parallel.executor.ts      # 并行节点
└── __tests__/
    ├── node.executor.spec.ts
    ├── executor.registry.spec.ts
    ├── start-end.executor.spec.ts
    ├── condition.executor.spec.ts
    ├── code.executor.spec.ts
    ├── llm.executor.spec.ts
    ├── api.executor.spec.ts
    ├── hitl.executor.spec.ts
    ├── loop.executor.spec.ts
    └── parallel.executor.spec.ts
```

## 5. 预期测试统计

| 组件 | 测试文件 | 测试用例 |
|------|----------|----------|
| 执行器框架 | 2 | 25-35 |
| 基础执行器 | 3 | 27-35 |
| 核心执行器 | 3 | 42-53 |
| 高级执行器 | 2 | 20-24 |
| **总计** | **10** | **114-147** |

## 6. 依赖关系

```
node.executor.ts (基础接口)
    ↓
executor.registry.ts (注册管理)
    ↓
各具体执行器 (LLM, API, HITL, etc.)
```

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Code 执行安全 | 使用 vm2 或 quickjs 沙箱 |
| LLM 调用成本 | 支持 mock 模式、token 限制 |
| API 超时 | 可配置超时、熔断机制 |
| 并行执行并发 | 限制并发数、队列控制 |

## 8. 验收标准

- [ ] 所有 10 个测试文件通过
- [ ] 覆盖率 > 80%
- [ ] 支持至少 8 种节点类型
- [ ] 错误处理完善
- [ ] TypeScript 类型完整
