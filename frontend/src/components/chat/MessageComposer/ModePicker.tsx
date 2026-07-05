import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@radix-ui/react-popover';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useContext, useLayoutEffect, useRef, useState } from 'react';

import { ChainlitContext, IMode, IModeOption } from '@chainlit/react-client';

import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItemAnimated,
  CommandListScrollable
} from '@/components/ui/command';

interface Props {
  mode: IMode;
  disabled?: boolean;
  selectedOptionIds?: string[];
  onOptionSelect: (modeId: string, optionId: string) => void;
}

/**
 * ModePicker displays a single mode category and allows selection from its options.
 * Multiple ModePicker instances can be rendered for different mode categories.
 */
export const ModePicker = ({
  mode,
  disabled = false,
  selectedOptionIds = [],
  onOptionSelect
}: Props) => {
  const apiClient = useContext(ChainlitContext);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeSource, setActiveSource] = useState<'keyboard' | 'pointer' | null>(
    null
  );
  const [hasWrappedOptionName, setHasWrappedOptionName] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionNameRefs = useRef<Array<HTMLDivElement | null>>([]);

  const options = mode.options;
  const selectedIds = new Set(selectedOptionIds);
  const selectedOptions = options.filter((option) => selectedIds.has(option.id));
  const selectedOption = selectedOptions[0] || options[0];
  const selectedOptionIndex = Math.max(
    0,
    options.findIndex((option) => option.id === selectedOption?.id)
  );
  const selectedCount = selectedOptions.length;
  const triggerLabel = `${mode.name} (${selectedCount})`;
  const triggerTitle =
    [
      mode.description || mode.name,
      ...selectedOptions.map((option) => option.name)
    ]
      .filter(Boolean)
      .join('\n') || mode.name;

  const handleOptionSelect = (option: IModeOption) => {
    onOptionSelect(mode.id, option.id);
    if (!mode.multi) {
      setOpen(false);
    }
    setActiveIndex(null);
    setActiveSource(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setActiveIndex(null);
      setActiveSource(null);
      return;
    }
    // Opening the picker should reflect only persisted selections, not stale hover state.
    setActiveIndex(null);
    setActiveSource(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        setOpen(true);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setActiveIndex(selectedOptionIndex);
          setActiveSource('keyboard');
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => {
          const baseIndex = prev ?? selectedOptionIndex;
          return (baseIndex + 1) % options.length;
        });
        setActiveSource('keyboard');
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => {
          const baseIndex = prev ?? selectedOptionIndex;
          return (baseIndex - 1 + options.length) % options.length;
        });
        setActiveSource('keyboard');
        break;
      case 'Enter':
        e.preventDefault();
        if (options[activeIndex ?? selectedOptionIndex]) {
          handleOptionSelect(options[activeIndex ?? selectedOptionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(null);
        setActiveSource(null);
        break;
    }
  };

  const handleMouseEnter = (index: number) => {
    setActiveIndex(index);
    setActiveSource('pointer');
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
    setActiveSource(null);
  };

  useLayoutEffect(() => {
    if (!open) {
      setHasWrappedOptionName(false);
      return;
    }

    const measureWrappedOptionNames = () => {
      const hasWrappedName = optionNameRefs.current.some((element) => {
        if (!element) {
          return false;
        }

        const lineHeight = Number.parseFloat(
          window.getComputedStyle(element).lineHeight
        );

        if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
          return false;
        }

        return element.scrollHeight > lineHeight + 1;
      });

      setHasWrappedOptionName(hasWrappedName);
    };

    measureWrappedOptionNames();

    const observer = new ResizeObserver(() => {
      measureWrappedOptionNames();
    });

    optionNameRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [open, options]);

  // Helper to render icon - supports Lucide names, local paths, and URLs
  const renderIcon = (icon: string | undefined, className: string) => {
    if (!icon) return null;

    // Local public file path
    if (icon.startsWith('/public')) {
      return (
        <img
          className={cn('rounded-md', className)}
          src={apiClient.buildEndpoint(icon)}
          alt="Mode option icon"
        />
      );
    }

    // Remote URL
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return (
        <img
          className={cn('rounded-md', className)}
          src={icon}
          alt="Mode option icon"
        />
      );
    }

    // Lucide icon name
    return <Icon name={icon} className={className} />;
  };

  if (!options.length) return null;

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div
      className="mode-picker-wrapper inline-flex items-center"
      ref={popoverRef}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={`mode-picker-trigger-${mode.id}`}
            variant="ghost"
            size="sm"
            disabled={disabled}
            title={triggerTitle}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2 rounded-md',
              'text-xs font-medium',
              'hover:bg-muted transition-colors',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              open && 'bg-muted'
            )}
            onKeyDown={handleKeyDown}
          >
            {renderIcon(selectedOption?.icon, '!size-4')}
            <span className="max-w-[120px] truncate">
              {triggerLabel}
            </span>
            <Chevron className="!size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          id={`mode-picker-popover-${mode.id}`}
          align="start"
          side="top"
          sideOffset={4}
          className={cn(
            'p-1 rounded-md border shadow-lg bg-popover',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'w-[560px] max-w-[calc(100vw-2rem)]'
          )}
          onKeyDown={handleKeyDown}
          onMouseLeave={handleMouseLeave}
        >
          <Command className="overflow-hidden bg-transparent">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {mode.name}
            </div>
            <CommandListScrollable maxItems={6} className="custom-scrollbar">
              <CommandGroup className="p-0">
                {options.map((option, index) => (
                  <CommandItemAnimated
                    key={option.id}
                    index={index}
                    isSelected={false}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onSelect={() => handleOptionSelect(option)}
                    className={cn(
                      'flex items-start gap-2 px-2 py-1.5 cursor-pointer hover:scale-100',
                      hasWrappedOptionName && 'min-h-[64px]',
                      activeSource === 'pointer' &&
                        activeIndex === index &&
                        !selectedIds.has(option.id) &&
                        'bg-muted/70 text-foreground',
                      activeSource === 'keyboard' &&
                        activeIndex === index &&
                        !selectedIds.has(option.id) &&
                        'bg-muted text-foreground',
                      selectedIds.has(option.id) &&
                        'bg-secondary/80 text-secondary-foreground'
                    )}
                  >
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center">
                      <Check
                        className={cn(
                          'size-4 text-primary transition-opacity',
                          selectedIds.has(option.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </div>
                    {renderIcon(
                      option.icon,
                      cn(
                        '!size-5 mt-0.5 text-muted-foreground flex-shrink-0',
                        (selectedIds.has(option.id) || activeIndex === index) &&
                          'text-foreground'
                      )
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center self-stretch">
                      <div
                        ref={(node) => {
                          optionNameRefs.current[index] = node;
                        }}
                        className={cn(
                          'line-clamp-2 font-medium text-sm leading-tight',
                          hasWrappedOptionName &&
                            'min-h-[calc(0.875rem*1.25*2)]'
                        )}
                      >
                        {option.name}
                      </div>
                      {(option.description || option.tooltip) && (
                        <div className="mt-0.5 line-clamp-1 text-xs leading-tight text-muted-foreground">
                          {option.description || option.tooltip}
                        </div>
                      )}
                    </div>
                  </CommandItemAnimated>
                ))}
              </CommandGroup>
            </CommandListScrollable>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ModePicker;
