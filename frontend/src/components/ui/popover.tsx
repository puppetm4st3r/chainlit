import { cn } from '@/lib/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => {
  // Check if we're on mobile and if this is the copilot popover
  const [isMobile, setIsMobile] = React.useState(false);
  const isCopilotPopover = className?.includes('copilot') || 
                           className?.includes('z-copilot-popup') ||
                           props?.id === 'chainlit-copilot' ||
                           className?.includes('chainlit-copilot');

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // For mobile copilot, disable Radix positioning and use fixed positioning
  if (isMobile && isCopilotPopover) {
    return (
      <PopoverPrimitive.Portal
        container={
          window.cl_shadowRootElement ? window.cl_shadowRootElement : undefined
        }
      >
        <div
          ref={ref}
          className={cn(
            'fixed inset-0 z-[20100] bg-background outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
          )}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: 'none',
            margin: 0,
            width: '100vw',
            height: '100vh'
          }}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  }

  // Default behavior for desktop and non-copilot popovers
  return (
    <PopoverPrimitive.Portal
      container={
        window.cl_shadowRootElement ? window.cl_shadowRootElement : undefined
      }
    >
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
