import { Injectable } from '@nestjs/common';
import type { SpeechToTextProvider } from './ai.types.js';

@Injectable()
export class LocalSpeechProvider implements SpeechToTextProvider {
  async transcribe(audio: Buffer): Promise<string> {
    const transcript = audio.toString('utf8').trim();
    return transcript ? transcript.split(/\n+/).map((line, index) => `Speaker ${index % 2 + 1}: ${line}`).join('\n') : '[No transcript returned; configure Whisper or faster-whisper adapter]';
  }
}