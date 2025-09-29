import { cn } from '@/lib/utils';
import { omit } from 'lodash';
import { useContext, useMemo } from 'react';
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
  refElements?: IMessageElement[];
  children: string;
  className?: string;
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
  refElements,
  className,
  children
}: Props) => {
  const apiClient = useContext(ChainlitContext);

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
    <ReactMarkdown
      className={cn('prose lg:prose-xl', className)}
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
          let element = refElements?.find((e) => e.name === name);
          if (!element && typeof href === 'string' && href.startsWith('#link:')) {
            const key = href.replace('#link:', '');
            element = refElements?.find((e: any) => e.type === 'link' && e.chainlitKey === key);
          }
          if (element) {
            if ((element as any).type === 'link') {
              const anyEl = element as any;
              const href = anyEl.url || (anyEl as any).props?.url || '#';
              const title = (anyEl as any).props?.tooltip || name;
              const showIcon = (anyEl as any).props?.show_icon === true;
              const contentNode = showIcon ? (
                <span
                  className="chainlink inline-flex items-center justify-center rounded-full bg-primary/20 dark:bg-primary/30 text-primary align-middle leading-none"
                  style={{ width: 18, height: 18, verticalAlign: 'middle' }}
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
                <span className="chainlink text-primary hover:underline">{children}</span>
              );

              return (
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <a
                        href={href}
                        aria-label={title}
                        className=""
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {contentNode}
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>{title}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
          return (
            <div className="sm:max-w-sm md:max-w-md">
              <AspectRatio
                ratio={16 / 9}
                className="bg-muted rounded-md overflow-hidden"
              >
                <img
                  src={
                    image.src.startsWith('/public')
                      ? apiClient.buildEndpoint(image.src)
                      : image.src
                  }
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
  );
};

export { Markdown };
