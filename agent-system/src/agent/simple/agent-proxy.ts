/**
 * Kimi Agent 代理服务器
 * 前端 WebSocket → 后端代理 → Kimi Coding API
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Anthropic from '@anthropic-ai/sdk';

// Kimi Coding API 配置
const KIMI_BASE_URL = 'https://api.kimi.com/coding';
const KIMI_MODEL = 'k2p5';

// 从环境变量获取 API Key (使用 MOONSHOT_API_KEY 作为变量名)
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || '';

if (!MOONSHOT_API_KEY) {
  console.error('❌ 错误: 请设置 MOONSHOT_API_KEY 环境变量');
  process.exit(1);
}

// 初始化 Anthropic 客户端
const client = new Anthropic({
  apiKey: MOONSHOT_API_KEY,
  baseURL: KIMI_BASE_URL,
});

// WebSocket 服务器
const PORT = process.env.AGENT_WS_PORT || 3001;

const server = createServer();
const wss = new WebSocketServer({ server });

// 会话管理
interface Session {
  ws: WebSocket;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const sessions = new Map<string, Session>();

// 系统提示词
const SYSTEM_PROMPT = `你是 Sofia，一个活泼可爱的 AI 助手。请用简短友好的中文回复用户。

回复时，请严格按照以下 JSON 格式输出：
{
  "reply": "你的回复内容",
  "emotion": "happy|sad|excited|singing|angry|playful|neutral"
}

emotion 说明：
- happy: 开心、高兴
- sad: 难过、伤心
- excited: 兴奋、惊讶
- singing: 想唱歌、说话
- angry: 生气
- playful: 调皮、可爱
- neutral: 普通、平静`;

wss.on('connection', (ws: WebSocket) => {
  const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔗 新连接: ${sessionId}`);

  sessions.set(sessionId, { ws, history: [] });

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📩 收到消息 [${sessionId}]:`, message.type);

      if (message.type === 'chat') {
        const session = sessions.get(sessionId);
        if (!session) return;

        // 发送 typing 状态
        ws.send(JSON.stringify({ type: 'typing', status: 'start' }));

        try {
          // 构建消息
          const messages = [
            ...session.history.slice(-10), // 最近 10 轮
            { role: 'user' as const, content: message.text }
          ];

          // 调用 Kimi Coding API (Anthropic SDK)
          const response = await client.messages.create({
            model: KIMI_MODEL,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: messages,
            temperature: 0.7,
          });

          const content = response.content[0].text;
          console.log(`🤖 Kimi 回复:`, content.substring(0, 100) + '...');

          // 解析 JSON 回复
          let result: { reply: string; emotion: string };
          try {
            // 尝试直接解析
            result = JSON.parse(content);
          } catch {
            // 尝试从 Markdown 代码块中提取
            const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*})\s*```/) ||
                             content.match(/({[\s\S]*})/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[1]);
            } else {
              // 如果解析失败，直接使用文本作为回复
              result = { reply: content, emotion: 'neutral' };
            }
          }

          // 保存到历史
          session.history.push(
            { role: 'user', content: message.text },
            { role: 'assistant', content: content }
          );

          // 限制历史长度
          if (session.history.length > 20) {
            session.history.splice(0, 2);
          }

          // 发送回复
          ws.send(JSON.stringify({
            type: 'response',
            reply: result.reply,
            emotion: result.emotion,
          }));

        } catch (error) {
          console.error('❌ API 调用失败:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: '抱歉，我遇到了一点问题，请稍后再试。',
          }));
        }

        ws.send(JSON.stringify({ type: 'typing', status: 'end' }));
      }
    } catch (error) {
      console.error('❌ 消息处理错误:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: '消息格式错误',
      }));
    }
  });

  ws.on('close', () => {
    console.log(`👋 连接关闭: ${sessionId}`);
    sessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error(`❌ WebSocket 错误 [${sessionId}]:`, error);
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'connected',
    message: '已连接到 Yumi Agent',
  }));
});

server.listen(PORT, () => {
  console.log(`🚀 Agent 代理服务器已启动`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔑 API Key: ${MOONSHOT_API_KEY.substring(0, 10)}...`);
});
