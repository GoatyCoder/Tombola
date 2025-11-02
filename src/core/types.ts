export interface TombolaEntry {
  number: number;
  italian: string;
  dialect?: string | null;
  image?: string | null;
}

export interface SponsorEntry {
  logo: string;
  url: string;
  name?: string;
  description?: string;
}

export interface DrawHistoryEntry {
  number: number;
  drawnAt: string;
  sponsor?: SponsorEntry | null;
}

export interface TombolaState {
  entries: TombolaEntry[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  sponsorStatus: 'idle' | 'loading' | 'ready' | 'error';
  drawnNumbers: number[];
  selectedNumber: number | null;
  audioEnabled: boolean;
  isDrawing: boolean;
  historyOpen: boolean;
  lastError?: string;
  sponsors: SponsorEntry[];
  activeSponsor: SponsorEntry | null;
  history: DrawHistoryEntry[];
}

export interface AppConfig {
  dataUrl: string;
  sponsorsUrl: string;
  storageKey: string;
  audioStorageKey: string;
}

export interface TombolaEventDetail {
  number: number;
  sponsor?: SponsorEntry | null;
  entry?: TombolaEntry;
}

export interface StoreSubscriber<T> {
  (state: Readonly<T>): void;
}

export interface Disposable {
  dispose(): void;
}

export interface CleanupTask {
  (): void;
}

export interface DrawResult {
  entry: TombolaEntry;
  sponsor: SponsorEntry | null;
}

export interface SpeechMessage {
  text: string;
  locale: string;
}

export interface SpeechConfig {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
}

export interface SpeechRequest {
  messages: SpeechMessage[];
  config?: SpeechConfig;
}
