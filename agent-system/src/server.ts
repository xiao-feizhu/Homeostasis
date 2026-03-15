/**
 * Agent System API 服务器
 *
 * 工作流引擎 REST API 服务入口
 */

import { ApiApplication } from './api';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = new ApiApplication({
    enableLogging: true,
    corsOrigin: process.env.CORS_ORIGIN || '*'
  });

  await app.start(PORT);

  // 优雅关闭
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });
}

main().catch(console.error);
