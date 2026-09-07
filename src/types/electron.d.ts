export interface ElectronDisplay {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  isPrimary: boolean;
}

export interface PublicDisplayStatus {
  open: boolean;
  displayId: number | null;
  openDisplays?: number[];
}

export interface ElectronAPI {
  isElectron: true;
  secureStorageGet: (key: string) => Promise<string | null>;
  secureStorageSet: (key: string, value: string) => Promise<boolean>;
  secureStorageDelete: (key: string) => Promise<boolean>;

  broadcastMatchState: (state: unknown) => void;
  onMatchStateSync: (callback: (state: any) => void) => () => void;

  openPublicDisplay: (displayId?: number) => Promise<PublicDisplayStatus>;
  closePublicDisplay: (displayId?: number) => Promise<PublicDisplayStatus>;
  getPublicDisplayStatus: () => Promise<PublicDisplayStatus>;
  onPublicDisplayStatusChanged: (callback: (status: PublicDisplayStatus) => void) => () => void;
  onNewExternalDisplay: (callback: (display: ElectronDisplay) => void) => () => void;

  getDisplays: () => Promise<ElectronDisplay[]>;
  onDisplaysChanged: (callback: (displays: ElectronDisplay[]) => void) => () => void;
  selectDisplay: (displayId: number) => Promise<{ selectedDisplayId: number }>;
  getSelectedDisplay: () => Promise<{ selectedDisplayId: number | null }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
