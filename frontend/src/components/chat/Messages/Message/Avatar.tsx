import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { useContext, useMemo } from 'react';

import {
  ChainlitContext,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

import Icon from '@/components/Icon';
import { resolveAssistantAvatarUrl } from '@/lib/assistantAvatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface Props {
  author?: string;
  hide?: boolean;
  isError?: boolean;
  iconName?: string;
}

const MessageAvatar = ({ author, hide, isError, iconName }: Props) => {
  const apiClient = useContext(ChainlitContext);
  const { chatProfile } = useChatSession();
  const { config } = useConfig();

  const avatarUrl = useMemo(() => {
    return resolveAssistantAvatarUrl({
      apiClient,
      config,
      chatProfile,
      author
    });
  }, [apiClient, chatProfile, config, author]);

  const avatarSize = config?.ui?.avatar_size;
  const avatarContainerSize = avatarSize ?? 48;
  const sizeStyle = {
    width: `${avatarContainerSize}px`,
    height: `${avatarContainerSize}px`,
    minWidth: `${avatarContainerSize}px`,
    minHeight: `${avatarContainerSize}px`
  };
  const errorIconSize = Math.min(avatarContainerSize, 32);

  if (isError) {
    return (
      <span
        className={cn('inline-flex flex-shrink-0 items-center justify-center', hide && 'invisible')}
        style={sizeStyle}
      >
        <AlertCircle
          className="fill-destructive text-destructive-foreground"
          style={{ width: `${errorIconSize}px`, height: `${errorIconSize}px` }}
        />
      </span>
    );
  }

  // Render icon or avatar based on iconName
  const avatarContent = iconName ? (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center"
      style={sizeStyle}
    >
      <Icon name={iconName} size={avatarSize ?? 20} /> {/* 20 => h-5 w-5 */}
    </span>
  ) : (
    <Avatar
      className="flex-shrink-0"
      style={sizeStyle}
    >
      <AvatarImage
        src={avatarUrl}
        alt={`Avatar for ${author || 'default'}`}
        className="bg-transparent"
      />
      <AvatarFallback className="bg-transparent">
        <Skeleton className="h-full w-full rounded-full" />
      </AvatarFallback>
    </Avatar>
  );

  return (
    <span className={cn('inline-block', hide && 'invisible')}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{avatarContent}</TooltipTrigger>
          <TooltipContent>
            <p>{author}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
};

export { MessageAvatar };
