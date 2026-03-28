import type { FC } from 'react';
import { Live2DView } from './features/avatar/Live2DView';
import { useAppStore } from './shared/store/appStore';
import type { EmotionType, ExpressionType, GestureType } from './shared/types';
import './App.css';

const emotions: EmotionType[] = ['happy', 'sad', 'excited', 'thinking', 'angry', 'playful', 'neutral'];

const expressions: ExpressionType[] = [
  'NEUTRAL', 'HEART_EYES', 'BLACK_FACE', 'TEARY_EYES',
  'STAR_EYES', 'CAT_MOUTH', 'HOLD_MIC', 'BLUSH'
];

const gestures: GestureType[] = [
  'WAVE', 'POINT', 'CHIN_RUB', 'CLAP',
  'SHRUG', 'SELF_HUG', 'PEACE_SIGN', 'THUMBS_UP'
];

const App: FC = () => {
  const store = useAppStore();

  const testEmotion = (emotion: EmotionType) => {
    store.setEmotion(emotion, Math.random() * 0.5 + 0.5);
  };

  const testExpression = (expression: ExpressionType) => {
    store.setExpression(expression);
  };

  const testGesture = (gesture: GestureType) => {
    store.setGesture(gesture);
    setTimeout(() => store.setGesture(null), 2000);
  };

  const testPhoneme = () => {
    const phonemes: Array<'a' | 'i' | 'u' | 'e' | 'o' | 'n'> = ['a', 'i', 'u', 'e', 'o', 'n'];
    const randomPhoneme = phonemes[Math.floor(Math.random() * phonemes.length)];
    store.setPhonemeData([{
      phoneme: randomPhoneme,
      offset: 0,
      duration: 100
    }]);
    setTimeout(() => store.setPhonemeData([]), 500);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Emotion Agent</h1>
        <div className="connection-status">
          {store.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <main className="app-main">
        <div className="avatar-container">
          <Live2DView />
        </div>

        <div className="controls">
          <div className="emotion-section">
            <h3>Emotions</h3>
            <div className="button-grid">
              {emotions.map(e => (
                <button
                  key={e}
                  className={`test-btn ${store.currentEmotion === e ? 'active' : ''}`}
                  onClick={() => testEmotion(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="expression-section">
            <h3>Expressions</h3>
            <div className="button-grid">
              {expressions.map(e => (
                <button
                  key={e}
                  className={`test-btn ${store.currentExpression === e ? 'active' : ''}`}
                  onClick={() => testExpression(e)}
                >
                  {e.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="gesture-section">
            <h3>Gestures</h3>
            <div className="button-grid">
              {gestures.map(g => (
                <button
                  key={g}
                  className="test-btn"
                  onClick={() => testGesture(g)}
                >
                  {g.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="action-section">
            <button
              className={`record-btn ${store.isRecording ? 'recording' : ''}`}
              onClick={() => store.toggleRecording()}
            >
              {store.isRecording ? '⏹ Stop' : '🎤 Record'}
            </button>
            <button className="test-btn" onClick={testPhoneme}>
              Test LipSync
            </button>
          </div>

          <div className="status-display">
            <div>Emotion: <strong>{store.currentEmotion}</strong> ({store.emotionIntensity.toFixed(2)})</div>
            <div>Expression: <strong>{store.currentExpression}</strong></div>
            <div>Transcript: {store.currentTranscript || '(none)'}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
