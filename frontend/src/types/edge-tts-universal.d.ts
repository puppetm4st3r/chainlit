declare module '@edge-tts/universal/browser' {
  export interface ProsodyOptions {
    rate?: string;
    volume?: string;
    pitch?: string;
  }

  export interface WordBoundary {
    offset: number;
    duration: number;
    text: string;
  }

  export interface SynthesisResult {
    audio: Blob;
    subtitle: WordBoundary[];
  }

  export class EdgeTTS {
    constructor(text: string, voice?: string, options?: ProsodyOptions);
    synthesize(): Promise<SynthesisResult>;
  }
}


