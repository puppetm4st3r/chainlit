import { cn } from '@/lib/utils';
import { omit } from 'lodash';
import {
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
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

const REFERENCE_TOOLTIP_CARD_WIDTH = 420;
const REFERENCE_TOOLTIP_VIEWPORT_MARGIN = 16;
const REFERENCE_TOOLTIP_OFFSET = 12;
const REFERENCE_TOOLTIP_SCORE_SECTION_PREFIX = '__relevance_score__=';
const CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME = 'conversation-reference-tooltip';
const REFERENCE_TOOLTIP_CLOSE_DELAY_MS = 1000;
const REFERENCE_TOOLTIP_MAX_VISIBLE_ITEMS = 5;
const REFERENCE_TOOLTIP_SCROLL_MAX_HEIGHT = 296;

interface ParsedTooltipReference {
  label: string;
  url?: string;
  documentName: string;
  path: string;
  chunkName: string;
  relevanceScore: number | null;
}

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

function parseLegacyReferenceTooltip(rawTooltip: string): ParsedTooltipReference {
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
      label: sections[0],
      documentName: sections[0],
      path: sections[1],
      chunkName: sections[2],
      relevanceScore
    };
  }

  if (sections.length === 2) {
    return {
      label: sections[0],
      documentName: sections[0],
      path: sections[1],
      chunkName: '',
      relevanceScore
    };
  }

  return {
    label: normalizedTooltip,
    documentName: normalizedTooltip,
    path: '',
    chunkName: '',
    relevanceScore
  };
}

function normalizeTooltipReferenceItem(rawItem: unknown): ParsedTooltipReference | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null;
  }
  const item = rawItem as Record<string, unknown>;
  const label = String(item.label || '').trim();
  const documentName = String(item.document_name || item.documentName || label).trim();
  const path = String(item.path || '').trim();
  const chunkName = String(item.chunk_name || item.chunkName || '').trim();
  const url = String(item.url || '').trim() || undefined;
  const rawScore = item.relevance_score ?? item.relevanceScore ?? null;
  const numericScore =
    rawScore === null || rawScore === undefined || rawScore === ''
      ? null
      : Number(rawScore);
  const normalizedScore =
    typeof numericScore === 'number' && Number.isFinite(numericScore)
      ? Math.max(0, Math.min(1, numericScore))
      : null;

  return {
    label: label || documentName,
    url,
    documentName: documentName || label,
    path,
    chunkName,
    relevanceScore: normalizedScore
  };
}

function sortTooltipReferences(references: ParsedTooltipReference[]) {
  return [...references].sort((left, right) => {
    const leftScore = left.relevanceScore;
    const rightScore = right.relevanceScore;
    if (leftScore !== null && rightScore !== null && leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (leftScore !== null) {
      return -1;
    }
    if (rightScore !== null) {
      return 1;
    }
    return (left.documentName || left.label).localeCompare(right.documentName || right.label);
  });
}

function resolveTooltipReferences(rawReferences: unknown, rawTooltip: string): ParsedTooltipReference[] {
  if (Array.isArray(rawReferences)) {
    const normalizedReferences = rawReferences
      .map((item) => normalizeTooltipReferenceItem(item))
      .filter((item): item is ParsedTooltipReference => Boolean(item));
    if (normalizedReferences.length) {
      return sortTooltipReferences(normalizedReferences);
    }
  }

  const normalizedTooltip = String(rawTooltip || '').trim();
  if (!normalizedTooltip) {
    return [];
  }

  return [parseLegacyReferenceTooltip(normalizedTooltip)];
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

function ReferenceTooltipBody({ references }: { references: ParsedTooltipReference[] }) {
  if (!references.length) {
    return null;
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrollableOverflow, setHasScrollableOverflow] = useState(false);
  const [showTopScrollFade, setShowTopScrollFade] = useState(false);
  const [showBottomScrollFade, setShowBottomScrollFade] = useState(false);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const hasOverflow = container.scrollHeight > container.clientHeight + 1;
    setHasScrollableOverflow(hasOverflow);
    setShowTopScrollFade(container.scrollTop > 1);
    setShowBottomScrollFade(container.scrollTop + container.clientHeight < container.scrollHeight - 1);
  }, [references]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const updateScrollAffordances = () => {
      setHasScrollableOverflow(container.scrollHeight > container.clientHeight + 1);
      setShowTopScrollFade(container.scrollTop > 1);
      setShowBottomScrollFade(
        container.scrollTop + container.clientHeight < container.scrollHeight - 1
      );
    };

    updateScrollAffordances();
    container.addEventListener('scroll', updateScrollAffordances, { passive: true });
    window.addEventListener('resize', updateScrollAffordances);

    return () => {
      container.removeEventListener('scroll', updateScrollAffordances);
      window.removeEventListener('resize', updateScrollAffordances);
    };
  }, [references]);

  return (
    <div
      className="w-[420px] max-w-[min(420px,calc(100vw-32px))] rounded-[12px_12px_12px_4px] border border-[rgba(120,113,108,0.28)] bg-[linear-gradient(180deg,#fff7d6_0%,#fef3c7_100%)] px-3.5 py-3 text-[12px] uppercase text-stone-800 dark:border-zinc-600 dark:bg-[linear-gradient(180deg,#3f3f46_0%,#52525b_100%)] dark:text-zinc-100"
    >
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-col gap-2 overflow-y-auto pr-1"
          style={{
            maxHeight:
              references.length > REFERENCE_TOOLTIP_MAX_VISIBLE_ITEMS
                ? REFERENCE_TOOLTIP_SCROLL_MAX_HEIGHT
                : undefined,
            scrollbarWidth: 'thin'
          }}
        >
          {references.map((reference, index) => (
            <div
              key={`${reference.documentName || reference.label}-${reference.path}-${reference.chunkName}-${index}`}
              className={index > 0 ? 'border-t border-stone-400/30 pt-2 dark:border-zinc-400/25' : ''}
            >
              {reference.url ? (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group -mx-1 block rounded-md px-1 py-1 transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500/40 dark:hover:bg-white/5 dark:focus-visible:ring-zinc-300/30"
                  title={reference.documentName || reference.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 truncate text-[12px] font-bold leading-[1.15] text-stone-800 underline-offset-2 group-hover:underline dark:text-zinc-100"
                    >
                      {reference.documentName || reference.label}
                    </div>
                  </div>
                  {reference.path ? (
                    <div
                      className="mt-1 truncate text-[12px] leading-[1.15] text-stone-600 dark:text-zinc-300"
                      title={reference.path}
                    >
                      {reference.path}
                    </div>
                  ) : null}
                  {reference.chunkName ? (
                    <div
                      className="mt-1 truncate text-[12px] font-bold leading-[1.15] text-stone-700 dark:text-zinc-200"
                      title={reference.chunkName}
                    >
                      {reference.chunkName}
                    </div>
                  ) : null}
                  {reference.relevanceScore !== null ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{
                          background: 'rgba(16, 185, 129, 0.14)',
                          boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.12)'
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, reference.relevanceScore * 100))}%`,
                            background:
                              'linear-gradient(90deg, #7f9b8a 0%, #7f9b8a 10%, #059669 58%, #047857 100%)',
                            backgroundSize: `${100 / Math.max(reference.relevanceScore, 0.0001)}% 100%`,
                            backgroundPosition: 'left top',
                            backgroundRepeat: 'no-repeat',
                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.28)'
                          }}
                        />
                      </div>
                      <div
                        className="shrink-0 border border-stone-400/15 bg-[#f8edbf] px-1.5 py-0.5 text-[12px] font-bold leading-none text-stone-800 dark:border-zinc-300/10 dark:bg-zinc-600/60 dark:text-zinc-100"
                        style={{ borderRadius: 4 }}
                      >
                        {`${Math.round(reference.relevanceScore * 100)}%`}
                      </div>
                    </div>
                  ) : null}
                </a>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 truncate text-[12px] font-bold leading-[1.15] text-stone-800 dark:text-zinc-100"
                      title={reference.documentName || reference.label}
                    >
                      {reference.documentName || reference.label}
                    </div>
                  </div>
                  {reference.path ? (
                    <div
                      className="mt-1 truncate text-[12px] leading-[1.15] text-stone-600 dark:text-zinc-300"
                      title={reference.path}
                    >
                      {reference.path}
                    </div>
                  ) : null}
                  {reference.chunkName ? (
                    <div
                      className="mt-1 truncate text-[12px] font-bold leading-[1.15] text-stone-700 dark:text-zinc-200"
                      title={reference.chunkName}
                    >
                      {reference.chunkName}
                    </div>
                  ) : null}
                  {reference.relevanceScore !== null ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{
                          background: 'rgba(16, 185, 129, 0.14)',
                          boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.12)'
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, reference.relevanceScore * 100))}%`,
                            background:
                              'linear-gradient(90deg, #7f9b8a 0%, #7f9b8a 10%, #059669 58%, #047857 100%)',
                            backgroundSize: `${100 / Math.max(reference.relevanceScore, 0.0001)}% 100%`,
                            backgroundPosition: 'left top',
                            backgroundRepeat: 'no-repeat',
                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.28)'
                          }}
                        />
                      </div>
                      <div
                        className="shrink-0 border border-stone-400/15 bg-[#f8edbf] px-1.5 py-0.5 text-[12px] font-bold leading-none text-stone-800 dark:border-zinc-300/10 dark:bg-zinc-600/60 dark:text-zinc-100"
                        style={{ borderRadius: 4 }}
                      >
                        {`${Math.round(reference.relevanceScore * 100)}%`}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
        {hasScrollableOverflow && showTopScrollFade ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-5 rounded-t-[10px] bg-[linear-gradient(180deg,rgba(255,247,214,0.96)_0%,rgba(255,247,214,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(63,63,70,0.96)_0%,rgba(63,63,70,0)_100%)]"
          />
        ) : null}
        {hasScrollableOverflow && showBottomScrollFade ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end justify-center rounded-b-[10px] bg-[linear-gradient(180deg,rgba(254,243,199,0)_0%,rgba(254,243,199,0.96)_100%)] pb-1 dark:bg-[linear-gradient(180deg,rgba(82,82,91,0)_0%,rgba(82,82,91,0.96)_100%)]"
          >
            <div
              className="h-1 w-10 rounded-full bg-stone-500/30 dark:bg-zinc-300/20"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConversationReferenceTooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    tooltipKey: string;
    tooltip: string;
    references: ParsedTooltipReference[];
    anchorElement: HTMLElement;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = (tooltipKey: string) => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setActiveTooltip((currentTooltip) =>
        currentTooltip && currentTooltip.tooltipKey === tooltipKey ? null : currentTooltip
      );
      closeTimerRef.current = null;
    }, REFERENCE_TOOLTIP_CLOSE_DELAY_MS);
  };

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
        references?: unknown;
        anchorElement?: HTMLElement;
      }>;
      const detail = customEvent.detail || {};
      const tooltipKey = String(detail.tooltipKey || '').trim();
      if (!tooltipKey) {
        return;
      }
      if (detail.action === 'show') {
        clearCloseTimer();
        const anchorElement = detail.anchorElement;
        if (!(anchorElement instanceof HTMLElement)) {
          return;
        }
        const resolvedReferences = resolveTooltipReferences(detail.references, String(detail.tooltip || ''));
        if (!resolvedReferences.length) {
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
            references: resolvedReferences,
            anchorElement,
          };
        });
        return;
      }
      if (detail.action === 'hide') {
        scheduleClose(tooltipKey);
      }
    };

    window.addEventListener(CONVERSATION_REFERENCE_TOOLTIP_EVENT_NAME, handleTooltipEvent);
    return () => {
      clearCloseTimer();
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
    const handlePointerDownOutside = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) {
        return;
      }
      if (tooltipRef.current?.contains(eventTarget)) {
        return;
      }
      if (activeTooltip.anchorElement.contains(eventTarget)) {
        return;
      }
      clearCloseTimer();
      setActiveTooltip(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      clearCloseTimer();
      setActiveTooltip(null);
    };
    window.addEventListener('resize', handleViewportMutation);
    window.addEventListener('scroll', handleViewportMutation, true);
    document.addEventListener('mousedown', handlePointerDownOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', handleViewportMutation);
      window.removeEventListener('scroll', handleViewportMutation, true);
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
      document.removeEventListener('keydown', handleEscape);
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
        pointerEvents: 'auto',
        userSelect: 'text'
      }}
      onMouseEnter={() => clearCloseTimer()}
      onMouseLeave={() => scheduleClose(activeTooltip.tooltipKey)}
      onFocusCapture={() => clearCloseTimer()}
      onBlurCapture={() => scheduleClose(activeTooltip.tooltipKey)}
    >
      <ReferenceTooltipBody references={activeTooltip.references} />
    </div>,
    document.body
  );
}

function ConversationReferenceLink({
  tooltip,
  references,
  tooltipKey,
  children
}: {
  tooltip: string;
  references: unknown;
  tooltipKey: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
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
          references,
          anchorElement: anchorRef.current
        }
      })
    );
  };

  return (
    <button
      type="button"
      ref={anchorRef}
      aria-label={tooltip}
      aria-haspopup="dialog"
      className="cursor-default"
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
      style={{ background: 'transparent', border: 'none', padding: 0 }}
    >
      {children}
    </button>
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
              const title = (anyEl as any).props?.tooltip || name;
              const showIcon = (anyEl as any).props?.show_icon === true;
              const contentNode = showIcon ? (
                <span
                  className="chainlink inline-flex items-center justify-center rounded-full border border-[hsl(var(--reference-link-border))] bg-[hsl(var(--reference-link-bg))] text-[hsl(var(--reference-link-fg))] align-middle leading-none transition-colors hover:bg-[hsl(var(--reference-link-hover))]"
                  style={{ width: 16, height: 16, verticalAlign: 'middle' }}
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
                    className="h-3 w-3 block"
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
                  className="chainlink rounded border border-[hsl(var(--reference-link-border))] bg-[hsl(var(--reference-link-bg))] px-1.5 py-0.5 text-[hsl(var(--reference-link-fg))] transition-colors hover:bg-[hsl(var(--reference-link-hover))]"
                >{children}</span>
              );

              return (
                <ConversationReferenceLink
                  tooltip={String(title)}
                  references={(anyEl as any).props?.references}
                  tooltipKey={String((anyEl as any).chainlitKey || title || name)}
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
