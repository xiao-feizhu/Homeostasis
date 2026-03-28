/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_SERVER_URL: string
  readonly VITE_AZURE_SPEECH_KEY: string
  readonly VITE_AZURE_SPEECH_REGION: string
  readonly VITE_LLM_PROVIDER: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
