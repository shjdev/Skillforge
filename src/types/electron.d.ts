export interface IElectronAPI {
  sendNotification: (data: { title: string; body: string }) => Promise<{ success: boolean; reason?: string }>;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
