import type { APIBase, ChatProfile, IChainlitConfig } from '@chainlit/react-client';

interface ResolveAssistantAvatarParams {
  apiClient?: APIBase | null;
  config?: IChainlitConfig;
  chatProfile?: string;
  author?: string;
}

export function getSelectedChatProfile(
  config?: IChainlitConfig,
  chatProfile?: string
): ChatProfile | undefined {
  return config?.chatProfiles.find((profile) => profile.name === chatProfile);
}

export function resolveAvatarAssetUrl(
  assetUrl?: string,
  apiClient?: APIBase | null
): string | undefined {
  if (!assetUrl) {
    return undefined;
  }

  if (assetUrl.includes('/public')) {
    return apiClient?.buildEndpoint(assetUrl) ?? assetUrl;
  }

  return assetUrl;
}

export function resolveAssistantAvatarUrl({
  apiClient,
  config,
  chatProfile,
  author
}: ResolveAssistantAvatarParams): string | undefined {
  const defaultAvatarUrl = resolveAvatarAssetUrl(
    config?.ui?.default_avatar_file_url,
    apiClient
  );

  if (defaultAvatarUrl) {
    return defaultAvatarUrl;
  }

  const isAssistant = !author || author === config?.ui?.name;
  if (isAssistant) {
    const selectedChatProfile = getSelectedChatProfile(config, chatProfile);
    const profileIconUrl = resolveAvatarAssetUrl(
      selectedChatProfile?.icon,
      apiClient
    );

    if (profileIconUrl) {
      return profileIconUrl;
    }
  }

  return apiClient?.buildEndpoint(`/avatars/${author || 'default'}`);
}

export function resolveAssistantDisplayName(
  config?: IChainlitConfig,
  chatProfile?: string
): string {
  const selectedChatProfile = getSelectedChatProfile(config, chatProfile);

  return (
    selectedChatProfile?.display_name ||
    selectedChatProfile?.name ||
    config?.ui?.name ||
    ''
  );
}
