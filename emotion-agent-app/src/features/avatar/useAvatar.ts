import { useEffect } from 'react';
import { useAppStore } from '@/shared/store/appStore';

export function useAvatar() {
  const store = useAppStore();

  useEffect(() => {
    if (store.currentEmotion) {
      console.log('[useAvatar] Emotion:', store.currentEmotion);
    }
  }, [store.currentEmotion, store.emotionIntensity]);

  useEffect(() => {
    console.log('[useAvatar] Expression:', store.currentExpression);
  }, [store.currentExpression]);

  useEffect(() => {
    if (store.currentGesture) {
      console.log('[useAvatar] Gesture:', store.currentGesture);
    }
  }, [store.currentGesture]);
}
