import { cn } from '@/lib/utils';
import { omit } from 'lodash';
import { type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { PluggableList } from 'react-markdown/lib';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

import { ChainlitContext, type IMessageElement } from '@chainlit/react-client';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

import BlinkingCursor from './BlinkingCursor';
import CodeSnippet from './CodeSnippet';
import { ElementRef } from './Elements/ElementRef';
import {
  type AlertProps,
  MarkdownAlert,
  alertComponents,
  normalizeAlertType
} from './MarkdownAlert';

interface Props {
  allowHtml?: boolean;
  latex?: boolean;
  renderMarkdown?: boolean;
  refElements?: IMessageElement[];
  children: string;
  className?: string;
}

type PluggableList = any[];

const REFERENCE_TOOLTIP_CARD_WIDTH = 280;
const REFERENCE_TOOLTIP_VIEWPORT_MARGIN = 16;
const REFERENCE_TOOLTIP_OFFSET = 12;
const REFERENCE_TOOLTIP_SCORE_SECTION_PREFIX = '__relevance_score__=';
const CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME = 'conversation-reference-tooltip';

function parseTooltipRelevanceScore(section: string) {
  const normalizedSection = String(section || '').trim();
  if (!normalizedSection.startsWith(REFERENCE_TOOLTIP_SCORE_SECTION_PREFIX)) {
    return null;
  }
  const rawValue = normalizedSection.slice(REFERENCE_TOOLTIP_SCORE_SECTION_PREFIX.length).trim();
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return Math.max(0, Math.min(1, numericValue));
}

function parseReferenceTooltip(rawTooltip: string) {
  const normalizedTooltip = String(rawTooltip || '').replace(/\r\n/g, '\n').trim();
  let sections = normalizedTooltip
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length <= 1) {
    sections = normalizedTooltip
      .split('\n')
      .map((section) => section.trim())
      .filter(Boolean);
  }

  const lastSection = sections.length ? sections[sections.length - 1] : '';
  const relevanceScore = parseTooltipRelevanceScore(lastSection);
  if (relevanceScore !== null) {
    sections = sections.slice(0, -1);
  }

  if (sections.length >= 3) {
    return {
      documentName: sections[0],
      path: sections[1],
      chunkName: sections[2],
      relevanceScore
    };
  }

  if (sections.length === 2) {
    return {
      documentName: sections[0],
      path: sections[1],
      chunkName: '',
      relevanceScore
    };
  }

  return {
    documentName: normalizedTooltip,
    path: '',
    chunkName: '',
    relevanceScore
  };
}

function computeReferenceTooltipViewportPosition(anchorRect: DOMRect | null, tooltipWidth: number, tooltipHeight: number) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const centerX = Number(anchorRect?.left || 0) + Number(anchorRect?.width || 0) / 2;
  const clampedLeft = Math.min(
    Math.max(centerX - tooltipWidth / 2, REFERENCE_TOOLTIP_VIEWPORT_MARGIN),
    Math.max(
      REFERENCE_TOOLTIP_VIEWPORT_MARGIN,
      viewportWidth - REFERENCE_TOOLTIP_VIEWPORT_MARGIN - tooltipWidth
    )
  );
  const preferredTop =
    Number(anchorRect?.top || 0) - REFERENCE_TOOLTIP_OFFSET - tooltipHeight;
  const preferredBottom = Number(anchorRect?.bottom || 0) + REFERENCE_TOOLTIP_OFFSET;
  const fitsAbove = preferredTop >= REFERENCE_TOOLTIP_VIEWPORT_MARGIN;
  const fitsBelow =
    preferredBottom + tooltipHeight <= viewportHeight - REFERENCE_TOOLTIP_VIEWPORT_MARGIN;

  if (fitsAbove || !fitsBelow) {
    return {
      left: clampedLeft,
      top: Math.max(REFERENCE_TOOLTIP_VIEWPORT_MARGIN, preferredTop)
    };
  }

  return {
    left: clampedLeft,
    top: Math.min(
      preferredBottom,
      Math.max(
        REFERENCE_TOOLTIP_VIEWPORT_MARGIN,
        viewportHeight - REFERENCE_TOOLTIP_VIEWPORT_MARGIN - tooltipHeight
      )
    )
  };
}

function ReferenceTooltipBody({ tooltip }: { tooltip: string }) {
  const parsedTooltip = parseReferenceTooltip(tooltip);

  return (
    <div
      className="w-[280px] max-w-[min(280px,calc(100vw-32px))] rounded-[12px_12px_12px_4px] border px-3 py-2.5 shadow-[0_10px_24px_rgba(120,113,108,0.24),0_2px_4px_rgba(120,113,108,0.18)]"
      style={{
        borderColor: 'rgba(120, 113, 108, 0.28)',
        background: 'linear-gradient(180deg, #fff7d6 0%, #fef3c7 100%)',
        color: '#292524'
      }}
    >
      <div
        className="text-[13px] font-bold leading-[1.35] break-words"
      >
        {parsedTooltip.documentName}
      </div>
      {parsedTooltip.path ? (
        <div
          className="mt-1.5 text-xs leading-[1.35] break-words"
          style={{ color: '#57534e' }}
        >
          {parsedTooltip.path}
        </div>
      ) : (
        <div style={{ height: 6 }} />
      )}
      {parsedTooltip.chunkName ? (
        <div
          className="mt-1.5 text-xs font-bold leading-[1.4] break-words"
          style={{ color: '#44403c' }}
        >
          {parsedTooltip.chunkName}
        </div>
      ) : null}
      {parsedTooltip.relevanceScore !== null ? (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <div
            className="self-end text-[11px] font-bold leading-none"
            style={{ color: '#047857' }}
          >
            {`${Math.round(parsedTooltip.relevanceScore * 100)}%`}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{
              background: 'rgba(16, 185, 129, 0.14)',
              boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.12)'
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, parsedTooltip.relevanceScore * 100))}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #059669 65%, #047857 100%)',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.28)'
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConversationReferenceTooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    tooltipKey: string;
    tooltip: string;
    anchorElement: HTMLElement;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });

  const updateTooltipPosition = () => {
    const anchorElement = activeTooltip?.anchorElement || null;
    if (!anchorElement || !anchorElement.isConnected) {
      return;
    }
    const anchorRect = anchorElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const nextPosition = computeReferenceTooltipViewportPosition(
      anchorRect,
      tooltipRect?.width || REFERENCE_TOOLTIP_CARD_WIDTH,
      tooltipRect?.height || 140
    );
    setTooltipPosition((currentPosition) =>
      currentPosition.left === nextPosition.left && currentPosition.top === nextPosition.top
        ? currentPosition
        : nextPosition
    );
  };

  useLayoutEffect(() => {
    if (!activeTooltip) {
      return;
    }
    updateTooltipPosition();
  }, [activeTooltip]);

  useEffect(() => {
    const handleTooltipEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        tooltipKey?: string;
        tooltip?: string;
        anchorElement?: HTMLElement;
      }>;
      const detail = customEvent.detail || {};
      const tooltipKey = String(detail.tooltipKey || '').trim();
      if (!tooltipKey) {
        return;
      }
      if (detail.action === 'show') {
        const anchorElement = detail.anchorElement;
        if (!(anchorElement instanceof HTMLElement)) {
          return;
        }
        setActiveTooltip((currentTooltip) => {
          if (
            currentTooltip &&
            currentTooltip.tooltipKey === tooltipKey &&
            currentTooltip.tooltip === String(detail.tooltip || '') &&
            currentTooltip.anchorElement === anchorElement
          ) {
            return currentTooltip;
          }
          return {
            tooltipKey,
            tooltip: String(detail.tooltip || ''),
            anchorElement,
          };
        });
        return;
      }
      if (detail.action === 'hide') {
        setActiveTooltip((currentTooltip) =>
          currentTooltip && currentTooltip.tooltipKey === tooltipKey ? null : currentTooltip
        );
      }
    };

    window.addEventListener(CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME, handleTooltipEvent);
    return () => {
      window.removeEventListener(CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME, handleTooltipEvent);
    };
  }, []);

  useEffect(() => {
    if (!activeTooltip) {
      return;
    }
    const handleViewportMutation = () => {
      if (!activeTooltip.anchorElement.isConnected) {
        setActiveTooltip(null);
        return;
      }
      updateTooltipPosition();
    };
    window.addEventListener('resize', handleViewportMutation);
    window.addEventListener('scroll', handleViewportMutation, true);
    return () => {
      window.removeEventListener('resize', handleViewportMutation);
      window.removeEventListener('scroll', handleViewportMutation, true);
    };
  }, [activeTooltip]);

  if (!activeTooltip || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: tooltipPosition.left,
        top: tooltipPosition.top,
        zIndex: 2147483647,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      <ReferenceTooltipBody tooltip={activeTooltip.tooltip} />
    </div>,
    document.body
  );
}

function ConversationReferenceLink({
  href,
  tooltip,
  tooltipKey,
  children
}: {
  href: string;
  tooltip: string;
  tooltipKey: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const dispatchTooltipEvent = (action: 'show' | 'hide') => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(
      new CustomEvent(CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME, {
        detail: {
          action,
          tooltipKey,
          tooltip,
          anchorElement: anchorRef.current
        }
      })
    );
  };

  return (
    <a
      ref={anchorRef}
      href={href}
      aria-label={tooltip}
      className=""
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => {
        if (anchorRef.current) {
          dispatchTooltipEvent('show');
        }
      }}
      onMouseLeave={() => dispatchTooltipEvent('hide')}
      onFocus={() => {
        if (anchorRef.current) {
          dispatchTooltipEvent('show');
        }
      }}
      onBlur={() => dispatchTooltipEvent('hide')}
    >
      {children}
    </a>
  );
}

const cursorPlugin = () => {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      const placeholderPattern = /\u200B/g;
      const matches = [...(node.value?.matchAll(placeholderPattern) || [])];

      if (matches.length > 0) {
        const newNodes: any[] = [];
        let lastIndex = 0;

        matches.forEach((match) => {
          const [fullMatch] = match;
          const startIndex = match.index!;
          const endIndex = startIndex + fullMatch.length;

          if (startIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: node.value!.slice(lastIndex, startIndex)
            });
          }

          newNodes.push({
            type: 'blinkingCursor',
            data: {
              hName: 'blinkingCursor',
              hProperties: { text: 'Blinking Cursor' }
            }
          });

          lastIndex = endIndex;
        });

        if (lastIndex < node.value!.length) {
          newNodes.push({
            type: 'text',
            value: node.value!.slice(lastIndex)
          });
        }

        parent!.children.splice(index, 1, ...newNodes);
      }
    });
  };
};

const Markdown = ({
  allowHtml,
  latex,
  renderMarkdown,
  refElements,
  className,
  children
}: Props) => {
  const apiClient = useContext(ChainlitContext);

  if (renderMarkdown === false) {
    return (
      <pre
        className={cn('whitespace-pre-wrap break-words', className)}
        style={{ fontFamily: 'inherit' }}
      >
        {children}
      </pre>
    );
  }

  const referenceElementsByName = useMemo(() => {
    const nextMap = new Map<string, IMessageElement>();
    (refElements || []).forEach((element) => {
      if (!nextMap.has(element.name)) {
        nextMap.set(element.name, element);
      }
    });
    return nextMap;
  }, [refElements]);

  const referenceLinkElementsByKey = useMemo(() => {
    const nextMap = new Map<string, IMessageElement>();
    (refElements || []).forEach((element: any) => {
      if (element?.type !== 'link') {
        return;
      }
      const chainlitKey = String(element.chainlitKey || '').trim();
      if (chainlitKey && !nextMap.has(chainlitKey)) {
        nextMap.set(chainlitKey, element);
      }
    });
    return nextMap;
  }, [refElements]);

  const rehypePlugins = useMemo(() => {
    let rehypePlugins: PluggableList = [];
    if (allowHtml) {
      rehypePlugins = [rehypeRaw as any, ...rehypePlugins];
    }
    if (latex) {
      rehypePlugins = [rehypeKatex as any, ...rehypePlugins];
    }
    return rehypePlugins;
  }, [allowHtml, latex]);

  const remarkPlugins = useMemo(() => {
    let remarkPlugins: PluggableList = [
      cursorPlugin,
      remarkGfm as any,
      remarkDirective as any,
      MarkdownAlert
    ];

    if (latex) {
      remarkPlugins = [...remarkPlugins, remarkMath as any];
    }
    return remarkPlugins;
  }, [latex]);

  return (
    <>
      <ConversationReferenceTooltipLayer />
      <div className={cn('prose lg:prose-xl', className)}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={{
        ...alertComponents, // add alert components
        code(props) {
          return (
            <code
              {...omit(props, ['node'])}
              className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
            />
          );
        },
        pre({ children, ...props }: any) {
          return <CodeSnippet {...props} />;
        },
        a({ children, href, ...props }) {
          const name = children as string;
          // Try match by name; if href looks like #link:KEY, try to match by chainlitKey
          let element = referenceElementsByName.get(name);
          if (!element && typeof href === 'string' && href.startsWith('#link:')) {
            const key = href.replace('#link:', '');
            element = referenceLinkElementsByKey.get(key);
          }
          if (element) {
            if ((element as any).type === 'link') {
              const anyEl = element as any;
              const href = anyEl.url || (anyEl as any).props?.url || '#';
              const title = (anyEl as any).props?.tooltip || name;
              // Normalize path arrows in tooltip to line breaks. Supports both "- >" and unicode "→" with optional spaces.
              const formattedTitle = typeof title === 'string'
                ? title.replace(/\s*(-\s*>|→)\s*/g, '\n')
                : title;
              const showIcon = (anyEl as any).props?.show_icon === true;
              const contentNode = showIcon ? (
                <span
                  className="chainlink inline-flex items-center justify-center rounded-full bg-muted text-foreground border align-middle leading-none hover:bg-muted/80 transition-colors"
                  style={{ width: 18, height: 18, verticalAlign: 'middle', borderColor: '#656565', borderWidth: '1px' }}
                >
                  {/* Lucide link icon, rotated ~25deg */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 block"
                    style={{ transform: 'rotate(30deg)' }}
                  >
                    {/* Lucide "link-2" simplified */}
                    <path d="M15 7h3a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-3" />
                    <path d="M9 17H6a5 5 0 0 1-5-5v0a5 5 0 0 1 5-5h3" />
                    <path d="M8 12h8" />
                  </svg>
                </span>
              ) : (
                <span 
                  className="chainlink bg-muted text-foreground px-1.5 py-0.5 rounded border hover:bg-muted/80 transition-colors"
                  style={{ borderColor: '#656565', borderWidth: '1px' }}
                >{children}</span>
              );

              return (
                <ConversationReferenceLink
                  href={href}
                  tooltip={String(title)}
                  tooltipKey={String((anyEl as any).chainlitKey || href || title || name)}
                >
                  {contentNode}
                </ConversationReferenceLink>
              );
            }
            return <ElementRef element={element} />;
          } else {
            return (
              <a
                {...props}
                className="text-primary hover:underline"
                target="_blank"
              >
                {children}
              </a>
            );
          }
        },
        img: (image: any) => {
          // Check if the image source is actually a video file
          const src = image.src.startsWith('/public')
            ? apiClient.buildEndpoint(image.src)
            : image.src;

          const videoExtensions = [
            '.mp4',
            '.webm',
            '.mov',
            '.avi',
            '.ogv',
            '.m4v'
          ];
          const isVideo = videoExtensions.some((ext) =>
            src.toLowerCase().split(/[?#]/)[0].endsWith(ext)
          );

          if (isVideo) {
            return (
              <div className="sm:max-w-sm md:max-w-md">
                <video
                  src={src}
                  controls
                  className="w-full h-auto rounded-md"
                  style={{ maxWidth: '100%' }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            );
          }

          return (
            <div className="sm:max-w-sm md:max-w-md">
              <AspectRatio
                ratio={16 / 9}
                className="bg-muted rounded-md overflow-hidden"
              >
                <img
                  src={src}
                  alt={image.alt}
                  className="h-full w-full object-contain"
                />
              </AspectRatio>
            </div>
          );
        },
        blockquote(props) {
          return (
            <blockquote
              {...omit(props, ['node'])}
              className="mt-6 border-l-2 pl-6 italic"
            />
          );
        },
        em(props) {
          return <span {...omit(props, ['node'])} className="italic" />;
        },
        strong(props) {
          return <span {...omit(props, ['node'])} className="font-bold" />;
        },
        hr() {
          return <Separator />;
        },
        ul(props) {
          return (
            <ul
              {...omit(props, ['node'])}
              className="my-3 ml-3 list-disc pl-2 [&>li]:mt-1"
            />
          );
        },
        ol(props) {
          return (
            <ol
              {...omit(props, ['node'])}
              className="my-3 ml-3 list-decimal pl-2 [&>li]:mt-1"
            />
          );
        },
        h1(props) {
          return (
            <h1
              {...omit(props, ['node'])}
              className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mt-8 first:mt-0"
            />
          );
        },
        h2(props) {
          return (
            <h2
              {...omit(props, ['node'])}
              className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mt-8 first:mt-0"
            />
          );
        },
        h3(props) {
          return (
            <h3
              {...omit(props, ['node'])}
              className="scroll-m-20 text-2xl font-semibold tracking-tight mt-6 first:mt-0"
            />
          );
        },
        h4(props) {
          return (
            <h4
              {...omit(props, ['node'])}
              className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 first:mt-0"
            />
          );
        },
        p(props) {
          return (
            <div
              {...omit(props, ['node'])}
              className="leading-7 [&:not(:first-child)]:mt-4 whitespace-pre-wrap break-words"
              role="article"
            />
          );
        },
        table({ children, ...props }) {
          return (
            <Card className="[&:not(:first-child)]:mt-2 [&:not(:last-child)]:mb-2">
              <Table {...(props as any)}>{children}</Table>
            </Card>
          );
        },
        thead({ children, ...props }) {
          return <TableHeader {...(props as any)}>{children}</TableHeader>;
        },
        tr({ children, ...props }) {
          return <TableRow {...(props as any)}>{children}</TableRow>;
        },
        th({ children, ...props }) {
          return <TableHead {...(props as any)}>{children}</TableHead>;
        },
        td({ children, ...props }) {
          return <TableCell {...(props as any)}>{children}</TableCell>;
        },
        tbody({ children, ...props }) {
          return <TableBody {...(props as any)}>{children}</TableBody>;
        },
        // @ts-expect-error custom plugin
        blinkingCursor: () => <BlinkingCursor whitespace />,
        alert: ({
          type,
          children,
          ...props
        }: AlertProps & { type?: string }) => {
          const alertType = normalizeAlertType(type || props.variant || 'info');
          return alertComponents.Alert({ variant: alertType, children });
        }
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    </>
  );
};

export { Markdown };
