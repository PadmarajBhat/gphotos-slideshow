export interface AmbientSnapshot {
  phase: string;
  message: string | null;
  userCode: string | null;
  verificationUrl: string | null;
  settingsUri: string | null;
  mediaSourcesSet: boolean;
  itemCount: number;
  lastRefreshedAt: string | null;
  requestsToday: number;
  deviceName: string;
}

export function createAmbientState(): {
  snapshot(): AmbientSnapshot;
  beginPairing(): Promise<AmbientSnapshot>;
  disconnect(): Promise<AmbientSnapshot>;
  resume(): Promise<void>;
  getMedia(): unknown[];
  stop(): void;
};
