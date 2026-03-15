/**
 * WebSocket 实时通知服务器
 *
 * 执行状态实时推送、断点事件实时推送
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * WebSocket 消息类型
 */
export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

/**
 * WebSocket 客户端连接
 */
interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  subscriptions: Set<string>;
}

/**
 * WebSocket 服务器
 */
export class WebSocketNotificationServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化 WebSocket 服务器
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocketClient, _req) => {
      const clientId = this.generateClientId();
      ws.isAlive = true;
      ws.subscriptions = new Set();
      this.clients.set(clientId, ws);

      console.log(`WebSocket client connected: ${clientId}`);

      // 发送欢迎消息
      this.sendToClient(clientId, {
        type: 'connected',
        payload: { clientId },
        timestamp: new Date().toISOString()
      });

      // 处理消息
      ws.on('message', (data) => {
        this.handleMessage(clientId, ws, data.toString());
      });

      // 心跳响应
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // 断开连接
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });

      // 错误处理
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });

    // 启动心跳检查
    this.startHeartbeat();
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(clientId: string, ws: WebSocketClient, data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, ws, message.payload);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, ws, message.payload);
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            payload: null,
            timestamp: new Date().toISOString()
          });
          break;

        default:
          this.sendToClient(clientId, {
            type: 'error',
            payload: { message: `Unknown message type: ${message.type}` },
            timestamp: new Date().toISOString()
          });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Invalid message format' },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 处理订阅请求
   */
  private handleSubscribe(clientId: string, ws: WebSocketClient, payload: { channel: string }): void {
    const { channel } = payload;
    ws.subscriptions.add(channel);

    this.sendToClient(clientId, {
      type: 'subscribed',
      payload: { channel },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理取消订阅请求
   */
  private handleUnsubscribe(clientId: string, ws: WebSocketClient, payload: { channel: string }): void {
    const { channel } = payload;
    ws.subscriptions.delete(channel);

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      payload: { channel },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 启动心跳检查
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws, clientId) => {
        if (!ws.isAlive) {
          ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30秒心跳
  }

  /**
   * 停止服务器
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((ws) => {
      ws.close();
    });
    this.clients.clear();

    this.wss?.close();
  }

  /**
   * 发送消息到指定客户端
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * 发送消息到指定频道订阅者
   */
  broadcastToChannel(channel: string, message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
        client.send(data);
      }
    });
  }

  /**
   * 发送执行状态更新
   */
  notifyExecutionStatus(executionId: string, status: string, data?: Record<string, unknown>): void {
    this.broadcastToChannel(`executions:${executionId}`, {
      type: 'execution.status',
      payload: {
        executionId,
        status,
        ...data
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发送断点事件
   */
  notifyBreakpointEvent(event: string, breakpointId: string, data?: Record<string, unknown>): void {
    this.broadcastToChannel('breakpoints', {
      type: `breakpoint.${event}`,
      payload: {
        breakpointId,
        ...data
      },
      timestamp: new Date().toISOString()
    });

    // 也发送到具体断点频道
    this.broadcastToChannel(`breakpoints:${breakpointId}`, {
      type: `breakpoint.${event}`,
      payload: {
        breakpointId,
        ...data
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 发送工作流事件
   */
  notifyWorkflowEvent(workflowId: string, event: string, data?: Record<string, unknown>): void {
    this.broadcastToChannel(`workflows:${workflowId}`, {
      type: `workflow.${event}`,
      payload: {
        workflowId,
        ...data
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
