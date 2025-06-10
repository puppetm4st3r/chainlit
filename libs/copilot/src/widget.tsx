import { cn } from '@/lib/utils';
import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import Alert from '@chainlit/app/src/components/Alert';
import { Button } from '@chainlit/app/src/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@chainlit/app/src/components/ui/popover';

import Header from './components/Header';

import ChatWrapper from './chat';
import { IWidgetConfig } from './types';

interface Props {
  config: IWidgetConfig;
  error?: string;
}

const Widget = ({ config, error }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    window.toggleChainlitCopilot = () => setIsOpen((prev) => !prev);

    return () => {
      window.toggleChainlitCopilot = () => console.error('Widget not mounted.');
    };
  }, []);

  // Prevent background scroll when widget is open and hide background on mobile
  useEffect(() => {
    const injectMobileStyles = () => {
      const styleId = 'chainlit-copilot-mobile-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @media (max-width: 640px) {
            body.copilot-open > *:not([data-radix-portal]):not(script):not(style):not(noscript):not(#chainlit-copilot) {
              display: none !important;
            }
            
            body.copilot-open {
              overflow: hidden !important;
              position: fixed !important;
              width: 100% !important;
              height: 100% !important;
              top: 0 !important;
              left: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `;
        document.head.appendChild(style);
      }
    };

    if (isOpen) {
      // Disable scroll on body
      document.body.style.overflow = 'hidden';
      // Add class to body for additional styling
      document.body.classList.add('copilot-open');
      // Inject mobile styles to hide background
      injectMobileStyles();
    } else {
      // Re-enable scroll on body
      document.body.style.overflow = '';
      document.body.classList.remove('copilot-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('copilot-open');
    };
  }, [isOpen]);

  const customClassName = config?.button?.className || '';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id="chainlit-copilot-button"
          className={cn(
            'fixed h-16 w-16 rounded-full bottom-8 right-8 z-copilot-button',
            'transition-transform duration-300 ease-in-out',
            // Mobile: slightly larger and better positioned
            'sm:h-16 sm:w-16 h-14 w-14',
            'sm:bottom-8 sm:right-8 bottom-6 right-6',
            customClassName
          )}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {config?.button?.imageUrl ? (
              <img
                width="100%"
                src={config.button.imageUrl}
                alt="Chat bubble icon"
                className={cn(
                  'transition-opacity',
                  isOpen ? 'opacity-0' : 'opacity-100'
                )}
              />
            ) : (
              <MessageCircle
                className={cn(
                  '!size-7 transition-opacity',
                  isOpen ? 'opacity-0' : 'opacity-100'
                )}
              />
            )}
            <X
              className={cn(
                'absolute !size-7 transition-all',
                isOpen ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
              )}
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          // Prevent wheel events from bubbling to the document
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          // Prevent touch scroll events from bubbling
          e.stopPropagation();
        }}
        side="top"
        align="end"
        sideOffset={12}
        alignOffset={0}
        avoidCollisions={false}
        className={cn(
          'flex flex-col p-0',
          'transition-all duration-300 ease-in-out bg-background',
          // Mobile: full screen
          'sm:w-[min(400px,80vw)] w-full',
          expanded && 'sm:w-[80vw] w-full',
          // Mobile: full height
          'sm:h-[min(730px,calc(100vh-150px))] h-screen',
          // Mobile: no border radius, desktop: rounded
          'sm:rounded-xl rounded-none',
          'overflow-hidden',
          'shadow-lg',
          'z-copilot-popup',
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          expanded
            ? 'copilot-container-expanded'
            : 'copilot-container-collapsed'
        )}
      >
        <div id="chainlit-copilot" className="flex flex-col h-full w-full">
          {error ? (
            <Alert variant="error">{error}</Alert>
          ) : (
            <>
              <Header 
                expanded={expanded} 
                setExpanded={setExpanded}
                onClose={() => setIsOpen(false)}
              />
              <div className="flex flex-grow overflow-y-auto">
                <ChatWrapper isOpen={isOpen} />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default Widget;
