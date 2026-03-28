type EventHandler = (data: any) => void;

export class WebSocketManager {
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  hasHandler(event: string): boolean {
    return this.eventHandlers.has(event) &&
           (this.eventHandlers.get(event)?.length || 0) > 0;
  }

  buildUrl(params: Record<string, string>): string {
    const query = new URLSearchParams(params).toString();
    return query ? `${this.url}?${query}` : this.url;
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  connect(params: Record<string, string> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const fullUrl = this.buildUrl(params);
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected', null);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('message', data);
            if (data.type) {
              this.emit(data.type, data);
            }
          } catch {
            this.emit('message', event.data);
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected', null);
          this.attemptReconnect(params);
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(params: Record<string, string>): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed', null);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect(params);
    }, delay);
  }

  send(data: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;
  }
}
