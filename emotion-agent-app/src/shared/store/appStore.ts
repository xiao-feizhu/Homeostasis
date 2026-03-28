import { create } from 'zustand';
import type {
  Message,
  EmotionType,
  ExpressionType,
  GestureType,
  PhonemeData,
  LLMProvider,
} from '@/shared/types';

interface AppState {
  isConnected: boolean;
  messages: Message[];
  currentEmotion: EmotionType;
  emotionIntensity: number;
  currentExpression: ExpressionType;
  currentGesture: GestureType | null;
  lipSyncValue: number;
  headPose: { tilt: number; turn: number };
  bodyPosture: { lean: number; shift: number };
  isRecording: boolean;
  isPlaying: boolean;
  currentTranscript: string;
  phonemeData: PhonemeData[];
  llmProvider: LLMProvider;
  voiceType: string;
  avatarScale: number;

  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setEmotion: (emotion: EmotionType, intensity: number) => void;
  setExpression: (expression: ExpressionType) => void;
  setGesture: (gesture: GestureType | null) => void;
  setLipSyncValue: (value: number) => void;
  setHeadPose: (pose: { tilt: number; turn: number }) => void;
  setBodyPosture: (posture: { lean: number; shift: number }) => void;
  toggleRecording: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTranscript: (text: string) => void;
  setPhonemeData: (data: PhonemeData[]) => void;
  setConnected: (connected: boolean) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setAvatarScale: (scale: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isConnected: false,
  messages: [],
  currentEmotion: 'neutral',
  emotionIntensity: 0,
  currentExpression: 'NEUTRAL',
  currentGesture: null,
  lipSyncValue: 0,
  headPose: { tilt: 0, turn: 0 },
  bodyPosture: { lean: 0, shift: 0 },
  isRecording: false,
  isPlaying: false,
  currentTranscript: '',
  phonemeData: [],
  llmProvider: 'kimi',
  voiceType: 'zh-CN-XiaoxiaoNeural',
  avatarScale: 1.0,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [] }),

  setEmotion: (emotion, intensity) =>
    set({ currentEmotion: emotion, emotionIntensity: intensity }),

  setExpression: (expression) => set({ currentExpression: expression }),

  setGesture: (gesture) => set({ currentGesture: gesture }),

  setLipSyncValue: (value) => set({ lipSyncValue: value }),

  setHeadPose: (pose) => set({ headPose: pose }),

  setBodyPosture: (posture) => set({ bodyPosture: posture }),

  toggleRecording: () =>
    set((state) => ({ isRecording: !state.isRecording })),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentTranscript: (text) => set({ currentTranscript: text }),

  setPhonemeData: (data) => set({ phonemeData: data }),

  setConnected: (connected) => set({ isConnected: connected }),

  setLLMProvider: (provider) => set({ llmProvider: provider }),

  setAvatarScale: (scale) => set({ avatarScale: scale }),
}));
