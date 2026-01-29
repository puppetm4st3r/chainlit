export interface IWidgetConfig {
  chainlitServer: string;
  showCot?: boolean;
  accessToken?: string;
  theme?: 'light' | 'dark';
  button?: {
    containerId?: string;
    imageUrl?: string;
    className?: string;
  };
  customCssUrl?: string;
  additionalQueryParamsForAPI?: Record<string, string>;
  // Persist copilot thread id across mounts
  // Defaults to true
  persistThreadId?: boolean;
  expanded?: boolean;
  language?: string;
  opened?: boolean;
}
