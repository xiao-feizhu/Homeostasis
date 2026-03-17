/**
 * Telegram Service Module
 * Telegram Bot 服务 - 多平台服务集成
 */

// Bot
export { TelegramBot } from './bot';
export type {
  TelegramConfig,
  TelegramMessage,
  TelegramSession,
  SendMessageOptions,
  SendMessageResult,
  MessageHandler,
  CommandHandler,
} from './bot';

// Agent Bridge
export { TelegramAgentBridge } from './agent/agent-bridge';
export type {
  AgentBridgeConfig,
  AgentResponse,
} from './agent/agent-bridge';

// LLM Connector
export { LLMConnector } from './llm/llm-connector';
export type {
  LLMConfig,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from './llm/llm-connector';
