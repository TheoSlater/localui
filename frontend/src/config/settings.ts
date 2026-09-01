export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  theme: Theme;
  name: string;
  userBubbleColor: string;
}

export const defaultSettings: Settings = {
  theme: 'system',
  name: '',
  userBubbleColor: '#6d3bb8',
};
