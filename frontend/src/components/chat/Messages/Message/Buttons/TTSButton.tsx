import { useCallback, useRef, useState } from 'react';

import { IMessageElement, IStep, useConfig } from '@chainlit/react-client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { Volume2, Square } from 'lucide-react';
import { Loader } from '@/components/Loader';
import Translator from '@/components/i18n/Translator';

// Import the browser-optimized API to avoid Node.js dependencies in the bundle
import { EdgeTTS } from '@edge-tts/universal/browser';

// Convert Markdown to a speech-friendly plain text.
// Removes formatting tokens and URLs while preserving readable content.
const markdownToSpeechText = (input: string, elements: IMessageElement[] = []): string => {
  let text = input;

  // Remove HTML anchor tags completely (including their content)
  text = text.replace(/<a\b[^>]*>.*?<\/a>/gi, '');

  // Remove button tags completely (including content)
  text = text.replace(/<button\b[^>]*>.*?<\/button>/gi, '');

  // Remove other HTML tags but keep their content
  text = text.replace(/<(?!a\b|button\b)[^>]+>/gi, '');

  // Remove fenced code block fences (keep inner content)
  text = text.replace(/^```[\w-]*\s*$/gm, '');
  text = text.replace(/^```$/gm, '');

  // Inline code -> keep inner text
  text = text.replace(/`([^`]+)`/g, '$1');

  // Images: drop completely (alt text usually not useful for speech)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');

  // Links: drop completely (both label and URL)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '');
  // Reference-style links: drop completely
  text = text.replace(/\[([^\]]+)\]\s*\[[^\]]*\]/g, '');
  // Autolinks: drop entirely
  text = text.replace(/<https?:\/\/[^>]+>/gi, '');

  // Strip element references by name
  if (elements.length) {
    for (const element of elements) {
      if (!element.name) continue;
      // Escape regex characters in element name
      const escapedName = element.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Remove matches (exact name or bracketed name)
      // Match [Name] or just Name if it's surrounded by whitespace/boundaries?
      // Chainlit usually renders element references from [Name] or just plain name if configured.
      // We'll remove bracketed [Name] aggressively, and exact text matches if likely a link.
      
      // Remove [ElementName]
      const bracketPattern = new RegExp(`\\[${escapedName}\\]`, 'g');
      text = text.replace(bracketPattern, '');
      
      // Also handle cases where the element name appears verbatim as a link label
      // But we already stripped links above.
      // If Chainlit auto-links plain text names, they are just text in markdown.
      // If we want to skip reading them, we can remove the name itself?
      // "Here is document.pdf" -> "Here is "
      // Use caution: only remove if it looks like a standalone reference?
      // For now, removing [Name] is safest. If the user sees a button, it was likely [Name] in markdown.
    }
  }

  // Emphasis and strike: keep inner text
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Headings, blockquotes
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/^\s{0,3}>\s?/gm, '');

  // Lists and hrules
  text = text.replace(/^\s*[-+*]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*([-*_]\s*){3,}\s*$/gm, '');

  // Link reference definitions
  text = text.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '');

  // Clean up citation-style brackets that may remain (e.g., [1], [CITATION])
  text = text.replace(/\s*\[[^\]]+\]\s*/g, ' ');

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text
    .split('\n')
    .map((l) => l.trim())
    .join('\n');

  return text.trim();
};

interface Props {
  message: IStep;
  voiceName?: string;
  elements?: IMessageElement[];
  messages?: IStep[];
  index?: number;
}

/**
 * Play Text-to-Speech for an assistant message using Microsoft Edge TTS.
 * Uses the browser entrypoint from @edge-tts/universal to prevent bundler conflicts.
 */
export function TTSButton({ message, voiceName, elements, messages, index }: Props) {
  const { config } = useConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queuedUrlsRef = useRef<string[]>([]);
  const createdUrlsRef = useRef<string[]>([]);
  const cancelledRef = useRef<boolean>(false);
  const backgroundDoneRef = useRef<boolean>(true);
  const resumePlaybackRef = useRef<(() => Promise<void>) | null>(null);

  const canPlay = !!message.output && !message.streaming;

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    // Revoke any created object URLs
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    for (const url of createdUrlsRef.current) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    createdUrlsRef.current = [];
    queuedUrlsRef.current = [];
    cancelledRef.current = true;
    setIsPlaying(false);
  }, []);

  // Create an object URL for a paragraph text using Edge TTS
  const synthToUrl = useCallback(async (text: string, selectedVoice: string) => {
    const tts = new EdgeTTS(text, selectedVoice);
    const result = await tts.synthesize();
    const url = URL.createObjectURL(result.audio);
    createdUrlsRef.current.push(url);
    return url;
  }, []);

  const getMessageAuthor = useCallback((m: IStep, msgs: IStep[]) => {
    // Priority 1: metadata.avatarName
    if (m.metadata?.avatarName) return m.metadata.avatarName;
    
    // Priority 2: Assistant detection fallback
    const isAssistantType = m.type && (
      m.type.includes('llm') ||
      m.type.includes('tool') ||
      m.type.includes('assistant') ||
      m.type.includes('retrieval') ||
      m.type.includes('rerank')
    );
    
    if (isAssistantType) {
      const botNameFromSiblings = msgs.find(msg => msg.metadata?.avatarName)?.metadata?.avatarName;
      if (botNameFromSiblings) return botNameFromSiblings;
      if (m.name && !m.name.includes('herramienta') && !m.name.includes('razonamiento')) {
        return m.name;
      }
      return config?.ui?.name || 'Assistant';
    }
    return m.name || 'Assistant';
  }, [config?.ui?.name]);

  const resolveFullText = useCallback(() => {
    if (!messages || index === undefined) return message.output;
    
    const currentAuthor = getMessageAuthor(message, messages);
    let startIndex = index;
    let endIndex = index;
    
    // Scan backwards
    for (let i = index - 1; i >= 0; i--) {
      if (getMessageAuthor(messages[i], messages) === currentAuthor && !['on_chat_start', 'on_message', 'on_audio_end'].includes(messages[i].name)) {
        startIndex = i;
      } else {
        break;
      }
    }
    
    // Scan forwards
    for (let i = index + 1; i < messages.length; i++) {
      if (getMessageAuthor(messages[i], messages) === currentAuthor && !['on_chat_start', 'on_message', 'on_audio_end'].includes(messages[i].name)) {
        endIndex = i;
      } else {
        break;
      }
    }

    return messages
      .slice(startIndex, endIndex + 1)
      .map(m => m.output)
      .filter(Boolean)
      .join('\n\n');
  }, [message, messages, index, getMessageAuthor]);

  const handleClick = useCallback(async () => {
    if (!canPlay) return;

    // Stop current playback if already playing or loading
    if (isPlaying || isLoading) {
      cleanupAudio();
      return;
    }

    try {
      setIsLoading(true);
      cancelledRef.current = false;

      // Prefer a female Spanish Mexican voice; fallback to Spanish neutral
      const selectedVoice = voiceName || 'es-MX-DaliaNeural';

      // Resolve grouped text if context is available
      const rawOutput = String(resolveFullText());
      const plainOutput = markdownToSpeechText(rawOutput, elements);

      if (!plainOutput) {
        return;
      }

      // Chunk by paragraphs to reduce initial latency for long texts
      const paragraphs = plainOutput
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (paragraphs.length <= 1 || plainOutput.length < 500) {
        // Single shot synthesis for short texts
        const url = await synthToUrl(plainOutput, selectedVoice);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.addEventListener('ended', () => {
          cleanupAudio();
        });
        audio.addEventListener('error', () => {
          cleanupAudio();
        });

        await audio.play();
        setIsPlaying(true);
      } else {
        // Progressive synthesis: synth first paragraph, start playing, then queue the rest
        const firstUrl = await synthToUrl(paragraphs[0], selectedVoice);
        objectUrlRef.current = firstUrl;
        const audio = new Audio(firstUrl);
        audioRef.current = audio;

        audio.addEventListener('ended', async () => {
          if (queuedUrlsRef.current.length) {
            const nextUrl = queuedUrlsRef.current.shift()!;
            try {
              const a = audioRef.current || new Audio();
              if (!audioRef.current) audioRef.current = a;
              a.src = nextUrl;
              await a.play();
            } catch {
              cleanupAudio();
            }
          } else if (!cancelledRef.current && !backgroundDoneRef.current) {
            // Buffering: playback caught up with synthesis, show loading and resume when next URL arrives
            setIsLoading(true);
            resumePlaybackRef.current = async () => {
              if (queuedUrlsRef.current.length && audioRef.current) {
                const nextUrl = queuedUrlsRef.current.shift()!;
                try {
                  audioRef.current.src = nextUrl;
                  await audioRef.current.play();
                  setIsLoading(false);
                } catch {
                  cleanupAudio();
                }
              } else if (backgroundDoneRef.current) {
                cleanupAudio();
              }
            };
          } else {
            cleanupAudio();
          }
        });
        audio.addEventListener('error', () => {
          cleanupAudio();
        });

        await audio.play();
        setIsPlaying(true);

        // Background synthesis of remaining paragraphs
        (async () => {
          backgroundDoneRef.current = false;
          for (let i = 1; i < paragraphs.length; i++) {
            if (cancelledRef.current) break;
            try {
              const url = await synthToUrl(paragraphs[i], selectedVoice);
              if (cancelledRef.current) {
                try { URL.revokeObjectURL(url); } catch {}
                break;
              }
              queuedUrlsRef.current.push(url);
              if (resumePlaybackRef.current) {
                const resume = resumePlaybackRef.current;
                resumePlaybackRef.current = null;
                await resume();
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Background TTS synthesis failed', e);
              // Continue with remaining paragraphs
            }
          }
          backgroundDoneRef.current = true;
          // If buffering and nothing queued, finalize cleanup
          if (resumePlaybackRef.current && !queuedUrlsRef.current.length) {
            const resume = resumePlaybackRef.current;
            resumePlaybackRef.current = null;
            await resume();
          }
        })();
      }
    } catch (e) {
      // Silently fail in UI; developers can inspect console for details
      // Note: We avoid custom error overlays to keep UX consistent
      // eslint-disable-next-line no-console
      console.error('TTS playback failed', e);
      cleanupAudio();
    } finally {
      setIsLoading(false);
    }
  }, [canPlay, cleanupAudio, isLoading, isPlaying, resolveFullText, synthToUrl, voiceName]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canPlay}
            onClick={handleClick}
            className={`text-muted-foreground ${
              isLoading ? 'ring-1 ring-muted-foreground/30 animate-[pulse_1.2s_ease-in-out_infinite]' : ''
            }`}
          >
            {isLoading ? (
              <Loader />
            ) : isPlaying ? (
              <Square className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <Translator
            path={
              isLoading
                ? 'chat.tts.rendering'
                : isPlaying
                ? 'chat.tts.stop'
                : 'chat.tts.listen'
            }
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


