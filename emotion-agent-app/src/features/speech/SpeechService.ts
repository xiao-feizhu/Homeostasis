import type { PhonemeData, Phoneme } from '@/shared/types';

interface SpeechServiceConfig {
  azureKey?: string;
  azureRegion?: string;
  voiceName?: string;
}

interface VisemeData {
  visemeId: number;
  audioOffset: number;
}

export class SpeechService {
  private config: SpeechServiceConfig;
  private isRec = false;
  private isPlay = false;

  constructor(config: SpeechServiceConfig = {}) {
    this.config = {
      voiceName: 'zh-CN-XiaoxiaoNeural',
      ...config,
    };
  }

  validateConfig(): void {
    if (!this.config.azureKey || !this.config.azureRegion) {
      throw new Error('Azure Speech configuration required');
    }
  }

  isRecording(): boolean {
    return this.isRec;
  }

  isPlaying(): boolean {
    return this.isPlay;
  }

  visemeToPhoneme(visemeId: number): Phoneme {
    const map: Record<number, Phoneme> = {
      0: 'sil', 1: 'a', 2: 'a', 3: 'i', 4: 'u', 5: 'e', 6: 'o',
      7: 'u', 8: 'n', 9: 'n', 10: 'n', 11: 'i', 12: 'n',
      13: 'i', 14: 'n', 15: 'a', 16: 'i',
    };
    return map[visemeId] || 'sil';
  }

  async startRecording(): Promise<void> {
    this.isRec = true;
    console.log('[Speech] Started recording');
  }

  async stopRecording(): Promise<string> {
    this.isRec = false;
    console.log('[Speech] Stopped recording');
    return '';
  }

  async synthesize(text: string): Promise<{ audio: Blob; phonemes: PhonemeData[] }> {
    this.validateConfig();
    const ssml = this.buildSSML(text);
    const response = await this.callAzureTTS(ssml);
    this.isPlay = true;
    return { audio: response.audio, phonemes: response.phonemes };
  }

  private buildSSML(text: string): string {
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
             xmlns:mstts="https://www.w3.org/2001/mstts"
             xml:lang="zh-CN">
        <voice name="${this.config.voiceName}">
          <mstts:viseme type="redlips_front"/>
          ${text}
        </voice>
      </speak>
    `;
  }

  private async callAzureTTS(ssml: string): Promise<{ audio: Blob; phonemes: PhonemeData[] }> {
    const url = `https://${this.config.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.azureKey!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
        'Viseme-ID': 'true',
      },
      body: ssml,
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const visemeHeader = response.headers.get('Viseme-IDs');
    const phonemes = this.parseVisemeData(visemeHeader);
    const audio = await response.blob();

    return { audio, phonemes };
  }

  private parseVisemeData(visemeHeader: string | null): PhonemeData[] {
    if (!visemeHeader) return [];

    try {
      const visemes: VisemeData[] = JSON.parse(visemeHeader);
      return visemes.map((v, index, array) => {
        const nextOffset = array[index + 1]?.audioOffset || v.audioOffset + 10000000;
        return {
          phoneme: this.visemeToPhoneme(v.visemeId),
          offset: v.audioOffset / 10000,
          duration: (nextOffset - v.audioOffset) / 10000,
        };
      });
    } catch {
      return [];
    }
  }

  stopPlayback(): void {
    this.isPlay = false;
  }
}
