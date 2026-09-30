export type RecognitionResultLike = {
  0: { transcript: string };
  isFinal?: boolean;
};

export type RecognitionEventLike = Event & {
  results: ArrayLike<RecognitionResultLike>;
};

export type RecognitionErrorLike = Event & { error?: string };

export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type RecognitionCtor = new () => RecognitionLike;

export type VoiceOptions = {
  onCommand: (text: string) => Promise<string | undefined>;
  onOpen: () => void;
  onLiveText: (text: string) => void;
  onStatus: (text: string) => void;
};

export type CaptureMode = 'manual' | 'wake';
export type VoiceMode = 'idle' | 'manual' | 'wake' | 'processing' | 'speaking';
