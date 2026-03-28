import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/shared/store/appStore';
import { emotionActionMap } from '@/features/agent/emotionActionMap';

interface Live2DViewProps {
  modelPath?: string;
  className?: string;
}

export function Live2DView({
  modelPath: _modelPath = 'live2d/yumi/yumi.model3.json',
  className = '',
}: Live2DViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const store = useAppStore();

  // Apply emotion actions when emotion changes
  useEffect(() => {
    if (!store.currentEmotion) return;

    console.log('[Live2DView] Emotion changed:', store.currentEmotion, 'intensity:', store.emotionIntensity);

    const config = emotionActionMap[store.currentEmotion];
    if (config) {
      console.log('[Live2DView] Applying expression:', config.expression);
    }
  }, [store.currentEmotion, store.emotionIntensity]);

  // Apply expression changes
  useEffect(() => {
    console.log('[Live2DView] Expression changed:', store.currentExpression);
  }, [store.currentExpression]);

  // Apply gesture changes
  useEffect(() => {
    if (!store.currentGesture) return;
    console.log('[Live2DView] Gesture triggered:', store.currentGesture);
  }, [store.currentGesture]);

  // Apply lip sync from phoneme data
  useEffect(() => {
    if (store.phonemeData.length === 0) return;

    const phoneme = store.phonemeData[0];
    if (phoneme) {
      console.log('[Live2DView] Lip sync phoneme:', phoneme.phoneme);
    }
  }, [store.phonemeData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`live2d-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: isLoading ? 'none' : 'block',
        }}
      />

      {!isLoading && (
        <div
          style={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '80px',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
          }}
        >
          🤖
        </div>
      )}

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          Loading Live2D...
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '12px',
        }}
      >
        <div>Expression: {store.currentExpression}</div>
        <div>Emotion: {store.currentEmotion}</div>
        {store.currentGesture && <div>Gesture: {store.currentGesture}</div>}
        {store.phonemeData.length > 0 && (
          <div>LipSync: {store.phonemeData[0]?.phoneme}</div>
        )}
      </div>
    </div>
  );
}

export default Live2DView;
