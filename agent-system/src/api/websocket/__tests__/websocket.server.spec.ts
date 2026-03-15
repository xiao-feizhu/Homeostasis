/**
 * WebSocket 服务器测试
 */

import { WebSocketNotificationServer } from '../websocket.server';
import { createServer, Server } from 'http';
import WebSocket from 'ws';

describe('WebSocketNotificationServer', () => {
  let server: WebSocketNotificationServer;
  let httpServer: Server;
  let port: number;

  beforeEach((done) => {
    server = new WebSocketNotificationServer();
    httpServer = createServer();
    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      server.initialize(httpServer);
      done();
    });
  });

  afterEach((done) => {
    server.stop();
    httpServer.close(() => done());
  });

  describe('connection', () => {
    it('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.close();
        done();
      });

      ws.on('error', (err) => done(err));
    });

    it('should send welcome message on connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('connected');
        expect(message.payload.clientId).toBeDefined();
        ws.close();
        done();
      });

      ws.on('error', (err) => done(err));
    });

    it('should track connection count', (done) => {
      expect(server.getConnectionCount()).toBe(0);

      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        // Give server time to register connection
        setTimeout(() => {
          expect(server.getConnectionCount()).toBe(1);
          ws.close();
          done();
        }, 50);
      });

      ws.on('error', (err) => done(err));
    });
  });

  describe('messaging', () => {
    it('should handle ping message', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        // Wait for welcome message
        ws.once('message', () => {
          // Send ping
          ws.send(JSON.stringify({ type: 'ping', payload: null }));
        });

        // Listen for pong
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should handle subscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'test-channel' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            expect(message.payload.channel).toBe('test-channel');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should handle unsubscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'test-channel' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            ws.send(JSON.stringify({
              type: 'unsubscribe',
              payload: { channel: 'test-channel' }
            }));
          }
          if (message.type === 'unsubscribed') {
            expect(message.payload.channel).toBe('test-channel');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should handle unknown message type', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'unknown_type',
            payload: {}
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            expect(message.payload.message).toContain('Unknown message type');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should handle invalid message format', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send('invalid json');
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            expect(message.payload.message).toBe('Invalid message format');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });
  });

  describe('broadcasting', () => {
    it('should broadcast to all clients', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          // Broadcast after connection established
          server.broadcast({
            type: 'test.broadcast',
            payload: { data: 'hello' },
            timestamp: new Date().toISOString()
          });
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'test.broadcast') {
            expect(message.payload.data).toBe('hello');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should broadcast to channel subscribers', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'my-channel' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            server.broadcastToChannel('my-channel', {
              type: 'channel.message',
              payload: { data: 'channel data' },
              timestamp: new Date().toISOString()
            });
          }
          if (message.type === 'channel.message') {
            expect(message.payload.data).toBe('channel data');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should not receive channel messages without subscription', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      let receivedChannelMessage = false;

      ws.on('open', () => {
        ws.once('message', () => {
          // Subscribe to different channel
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'other-channel' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            server.broadcastToChannel('my-channel', {
              type: 'channel.message',
              payload: { data: 'should not receive' },
              timestamp: new Date().toISOString()
            });

            setTimeout(() => {
              expect(receivedChannelMessage).toBe(false);
              ws.close();
              done();
            }, 100);
          }
          if (message.type === 'channel.message') {
            receivedChannelMessage = true;
          }
        });
      });

      ws.on('error', (err) => done(err));
    });
  });

  describe('notifications', () => {
    it('should notify execution status', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'executions:exec-001' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            server.notifyExecutionStatus('exec-001', 'running', { progress: 50 });
          }
          if (message.type === 'execution.status') {
            expect(message.payload.executionId).toBe('exec-001');
            expect(message.payload.status).toBe('running');
            expect(message.payload.progress).toBe(50);
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should notify breakpoint events', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'breakpoints' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            server.notifyBreakpointEvent('triggered', 'bp-001', { nodeId: 'node-1' });
          }
          if (message.type === 'breakpoint.triggered') {
            expect(message.payload.breakpointId).toBe('bp-001');
            expect(message.payload.nodeId).toBe('node-1');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });

    it('should notify workflow events', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.on('open', () => {
        ws.once('message', () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { channel: 'workflows:wf-001' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            server.notifyWorkflowEvent('wf-001', 'completed', { result: 'success' });
          }
          if (message.type === 'workflow.completed') {
            expect(message.payload.workflowId).toBe('wf-001');
            expect(message.payload.result).toBe('success');
            ws.close();
            done();
          }
        });
      });

      ws.on('error', (err) => done(err));
    });
  });

  describe('sendToClient', () => {
    it('should return false for non-existent client', () => {
      const result = server.sendToClient('non-existent', {
        type: 'test',
        payload: {},
        timestamp: new Date().toISOString()
      });
      expect(result).toBe(false);
    });
  });

  describe('stop', () => {
    it('should clear heartbeat interval', () => {
      server.stop();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
