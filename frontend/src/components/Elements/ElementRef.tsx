import { MessageContext } from '@/contexts/MessageContext';
import { useContext } from 'react';

import type { IMessageElement } from '@chainlit/react-client';

import { resolveFloatingElementTitle } from '@/lib/floatingElementTitle';
import { shouldShowFloatingReopenChip } from '@/lib/floatingReopenChip';
import { cn } from '@/lib/utils';

const FLOATING_CHIP_STYLE = {
  backgroundColor: '#045f3f',
  color: '#ffffff',
  borderColor: '#045f3f'
} as const;

interface ElementRefProps {
  element: IMessageElement;
}

const ElementRef = ({ element }: ElementRefProps) => {
  const { onElementRefClick } = useContext(MessageContext);

  // For inline elements, return a styled span
  if (element.display === 'inline') {
    return <span className="font-bold">{element.name}</span>;
  }

  // Floating CustomElements use the FileCommand chip geometry in brand green.
  // Motd and other one-shot notices set showReopenChip=false and must not render.
  if (element.display === 'floating') {
    if (!shouldShowFloatingReopenChip(element)) {
      return null;
    }
    return (
      <a
        href="#"
        className={cn(
          'inline-flex max-w-full items-center rounded-[4px] border border-solid px-2.5 py-1 text-sm font-medium cursor-pointer element-link element-link-floating'
        )}
        style={FLOATING_CHIP_STYLE}
        onClick={(event) => {
          event.preventDefault();
          onElementRefClick?.(element);
        }}
      >
        {resolveFloatingElementTitle(element)}
      </a>
    );
  }

  // For side/page elements, return a clickable muted pill
  return (
    <a
      href="#"
      className="cursor-pointer uppercase -translate-y-px inline-flex items-center rounded-xl bg-muted px-1.5 text-[0.7rem] font-medium text-muted-foreground element-link hover:bg-primary hover:text-primary-foreground"
      onClick={() => onElementRefClick?.(element)}
    >
      {element.name}
    </a>
  );
};

export { ElementRef };
