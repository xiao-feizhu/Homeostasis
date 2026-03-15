# Agent System API

REST API 和 WebSocket 实时通知服务

## 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# 指定端口
PORT=8080 npm start
```

## API 端点

### 工作流定义

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/workflows` | 获取工作流列表 |
| GET | `/api/workflows/:id` | 获取工作流详情 |
| POST | `/api/workflows` | 创建工作流 |
| PUT | `/api/workflows/:id` | 更新工作流 |
| DELETE | `/api/workflows/:id` | 删除工作流 |
| GET | `/api/workflows/:id/versions` | 获取版本列表 |
| GET | `/api/workflows/:id/validate` | 验证工作流 |

### 工作流执行

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/executions` | 获取执行列表 |
| GET | `/api/executions/:id` | 获取执行详情 |
| POST | `/api/executions` | 启动执行 |
| POST | `/api/executions/:id/cancel` | 取消执行 |
| GET | `/api/executions/:id/snapshot` | 获取状态快照 |

### HITL 断点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/breakpoints` | 获取断点列表 |
| GET | `/api/breakpoints/:id` | 获取断点详情 |
| POST | `/api/breakpoints/:id/approve` | 审批通过 |
| POST | `/api/breakpoints/:id/reject` | 审批拒绝 |
| POST | `/api/breakpoints/:id/cancel` | 取消断点 |
| GET | `/api/breakpoints/:id/events` | 获取断点事件 |
| GET | `/api/breakpoints/pending` | 获取待处理断点 |

### 监控指标

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/metrics` | 系统指标 |
| GET | `/api/metrics/prometheus` | Prometheus 格式 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/health/ready` | 就绪检查 |
| GET | `/api/health/live` | 存活检查 |

## WebSocket 实时通知

连接地址: `ws://localhost:3000/ws`

### 订阅频道

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// 订阅执行状态
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { channel: 'executions:exec-123' }
}));

// 订阅断点事件
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { channel: 'breakpoints' }
}));

// 订阅特定断点
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { channel: 'breakpoints:bp-456' }
}));
```

### 消息格式

```typescript
interface WebSocketMessage {
  type: string;      // 消息类型
  payload: unknown;  // 消息数据
  timestamp: string; // ISO 时间戳
}
```

### 事件类型

- `execution.status` - 执行状态更新
- `breakpoint.approved` - 断点审批通过
- `breakpoint.rejected` - 断点审批拒绝
- `breakpoint.cancelled` - 断点取消
- `workflow.started` - 工作流启动
- `workflow.completed` - 工作流完成

## 请求示例

### 创建工作流

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf-test-001",
    "name": "Test Workflow",
    "version": "1.0.0",
    "status": "active",
    "ownerId": "user-001",
    "nodes": [
      {
        "nodeId": "start",
        "name": "Start",
        "type": "start",
        "dependencies": [],
        "dependents": ["process"]
      },
      {
        "nodeId": "process",
        "name": "Process",
        "type": "code",
        "dependencies": ["start"],
        "dependents": ["end"],
        "config": {
          "code": "return { result: 'success' };"
        }
      },
      {
        "nodeId": "end",
        "name": "End",
        "type": "end",
        "dependencies": ["process"],
        "dependents": []
      }
    ],
    "schemaVersion": 1
  }'
```

### 启动执行

```bash
curl -X POST http://localhost:3000/api/executions \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf-test-001",
    "variables": {
      "input": "test data"
    },
    "options": {
      "userId": "user-001"
    }
  }'
```

### 审批断点

```bash
curl -X POST http://localhost:3000/api/breakpoints/bp-123/approve \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "approver-001",
    "comment": "Approved"
  }'
```

## 响应格式

所有 API 响应使用统一格式:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}
```

### 成功响应示例

```json
{
  "success": true,
  "data": {
    "workflowId": "wf-test-001",
    "name": "Test Workflow",
    "status": "active"
  },
  "error": null
}
```

### 错误响应示例

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Workflow not found"
  }
}
```
