import { atom } from 'recoil';

export const chatSettingsOpenState = atom<boolean>({
  key: 'chatSettingsOpen',
  default: false
});

export const chatSettingsSidebarOpenState = atom<boolean>({
  key: 'chatSettingsSidebarOpen',
  default: false
});

export const dismissedSideViewSignatureState = atom<string | undefined>({
  key: 'dismissedSideViewSignature',
  default: undefined
});
