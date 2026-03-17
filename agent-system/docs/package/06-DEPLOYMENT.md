# 部署文档

## 概述

本文档描述 AI Agent System 的部署方案，包括开发环境、生产环境和 Docker 部署。

## 环境要求

### 最低要求

- Node.js 18+
- npm 9+
- 2GB RAM
- 1GB 磁盘空间

### 推荐配置

- Node.js 20 LTS
- 4GB+ RAM
- SSD 存储
- 稳定的网络连接

## 开发环境部署

### 1. 克隆项目

```bash
cd /Users/xxx/claude-workspace/ecomop/agent-system
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env

# 编辑 .env
TELEGRAM_BOT_TOKEN=your_token_here
LLM_API_KEY=your_key_here
```

### 4. 运行测试

```bash
npm test
# 预期: 149 tests passed
```

### 5. 启动开发服务器

```bash
# 方式 1: 简单 HTTP 服务器
npx serve src/console/public -p 8080

# 方式 2: 开发模式 (如配置了)
npm run dev
```

访问: http://localhost:8080

## 生产环境部署

### 构建

```bash
# 安装生产依赖
npm ci --production

# 构建项目
npm run build
```

### 环境配置

```bash
# .env.production
NODE_ENV=production
PORT=8080
LOG_LEVEL=warn

# Telegram
TELEGRAM_BOT_TOKEN=your_production_token

# LLM
LLM_PROVIDER=openai
LLM_API_KEY=your_production_key
LLM_MODEL=gpt-4

# TTS
TTS_PROVIDER=system
TTS_CACHE_ENABLED=true

# 安全
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
```

### 进程管理

使用 PM2 管理 Node.js 进程：

```bash
# 安装 PM2
npm install -g pm2

# 创建配置文件 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-agent-system',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G'
  }]
};

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 重启
pm2 restart ai-agent-system

# 停止
pm2 stop ai-agent-system
```

## Docker 部署

### Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/console/public ./public

# 非 root 用户运行
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  ai-agent:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - LLM_API_KEY=${LLM_API_KEY}
    volumes:
      - ./logs:/app/logs
      - ./cache:/app/cache
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 部署命令

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## Nginx 反向代理

### 配置文件

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL 证书
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 静态文件
    location / {
        root /var/www/ai-agent/public;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## 监控和日志

### 日志配置

```typescript
// 日志级别
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// 日志格式
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "module": "ConsoleBridge",
  "message": "Message processed",
  "data": { ... }
}
```

### 健康检查

```typescript
// /health 端点
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      live2d: live2dStatus,
      telegram: telegramStatus,
      llm: llmStatus
    }
  };

  res.status(200).json(health);
});
```

### 性能监控

```typescript
// 指标收集
const metrics = {
  // Live2D
  fps: 0,

  // 音频
  audioLatency: 0,

  // Pipeline
  pipelineTime: 0,

  // TTS
  ttsTime: 0,

  // 系统
  memoryUsage: 0,
  cpuUsage: 0
};

// 暴露 /metrics 端点 (Prometheus 格式)
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP ai_agent_fps Live2D FPS
# TYPE ai_agent_fps gauge
ai_agent_fps ${metrics.fps}

# HELP ai_agent_memory_usage Memory usage in MB
# TYPE ai_agent_memory_usage gauge
ai_agent_memory_usage ${metrics.memoryUsage}
  `);
});
```

## 备份和恢复

### 备份策略

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/ai-agent"

# 创建备份
mkdir -p $BACKUP_DIR/$DATE

# 备份配置
cp .env $BACKUP_DIR/$DATE/
cp config.json $BACKUP_DIR/$DATE/

# 备份数据 (如果有)
cp -r data/ $BACKUP_DIR/$DATE/

# 备份缓存
cp -r cache/ $BACKUP_DIR/$DATE/

# 压缩
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR $DATE

# 保留最近 7 个备份
ls -t $BACKUP_DIR/backup_*.tar.gz | tail -n +8 | xargs rm -f
```

### 自动备份 (Cron)

```bash
# 每天凌晨 3 点备份
0 3 * * * /path/to/backup.sh
```

## 安全加固

### 1. 防火墙配置

```bash
# 允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 启用防火墙
sudo ufw enable
```

### 2. 安全头配置

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3. 速率限制

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15 分钟
  max: 100,                       // 每个 IP 最多 100 次请求
  message: 'Too many requests'
});

app.use('/api/', limiter);
```

## 故障恢复

### 自动重启

```bash
# 使用 systemd
sudo systemctl enable ai-agent
sudo systemctl start ai-agent

# 查看状态
sudo systemctl status ai-agent

# 查看日志
sudo journalctl -u ai-agent -f
```

### systemd 配置

```ini
# /etc/systemd/system/ai-agent.service
[Unit]
Description=AI Agent System
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/var/www/ai-agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 升级流程

### 滚动更新

```bash
# 1. 拉取新代码
git pull origin main

# 2. 安装依赖
npm ci --production

# 3. 运行测试
npm test

# 4. 构建
npm run build

# 5. 重启服务
pm2 restart ai-agent-system

# 6. 验证健康检查
curl http://localhost:8080/health
```

### 回滚

```bash
# 使用 PM2 回滚
pm2 restart ai-agent-system --name ai-agent-system-old

# 或使用 Git 回滚
git revert HEAD
npm run build
pm2 restart ai-agent-system
```

## CDN 部署 (静态资源)

### 配置

```typescript
// 静态资源使用 CDN
const CDN_URL = 'https://cdn.yourdomain.com';

// 加载 Live2D 模型
await bridge.loadLive2DModel(`${CDN_URL}/live2d/model.json`);
```

### 缓存策略

```nginx
# Nginx 缓存配置
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|json)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```
