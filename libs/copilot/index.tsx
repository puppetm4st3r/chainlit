import React from 'react';
import ReactDOM from 'react-dom/client';

import { type IStep } from '@chainlit/react-client';

// @ts-expect-error inline css
import sonnercss from './sonner.css?inline';
// @ts-expect-error inline css
import tailwindcss from './src/index.css?inline';
// @ts-expect-error inline css
import hljscss from 'highlight.js/styles/monokai-sublime.css?inline';

import AppWrapper from './src/appWrapper';
import {
  clearChainlitCopilotThreadId,
  getChainlitCopilotThreadId
} from './src/state';
import { IWidgetConfig } from './src/types';

const id = 'chainlit-copilot';
let root: ReactDOM.Root | null = null;

declare global {
  interface Window {
    cl_shadowRootElement: HTMLDivElement;
    theme?: {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    mountChainlitWidget: (config: IWidgetConfig) => void;
    unmountChainlitWidget: () => void;
    toggleChainlitCopilot: () => void;
    sendChainlitMessage: (message: IStep) => void;
    getChainlitCopilotThreadId: () => string | null;
    clearChainlitCopilotThreadId: (newThreadId?: string) => void;
  }
}

/**
 * Known Tailwind CSS class prefixes that don't need custom CSS generation
 */
const KNOWN_TAILWIND_PREFIXES = [
  'bg-', 'text-', 'border-', 'rounded-', 'shadow-', 'hover:', 'focus:',
  'active:', 'disabled:', 'group-', 'peer-', 'first:', 'last:', 'odd:',
  'even:', 'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-', 'm-', 'mx-',
  'my-', 'mt-', 'mb-', 'ml-', 'mr-', 'w-', 'h-', 'min-', 'max-', 'flex',
  'grid', 'inline', 'block', 'hidden', 'visible', 'absolute', 'relative',
  'fixed', 'sticky', 'top-', 'bottom-', 'left-', 'right-', 'z-', 'opacity-',
  'scale-', 'rotate-', 'translate-', 'skew-', 'transition', 'duration-',
  'ease-', 'delay-', 'animate-', 'cursor-', 'select-', 'resize-', 'list-',
  'overflow-', 'truncate', 'whitespace-', 'break-', 'font-', 'text-',
  'leading-', 'tracking-', 'align-', 'uppercase', 'lowercase', 'capitalize',
  'normal-case', 'underline', 'line-through', 'no-underline', 'italic',
  'not-italic', 'antialiased', 'subpixel-antialiased'
];

/**
 * Check if a class is a known Tailwind CSS class
 */
function isTailwindClass(className: string): boolean {
  // Check for arbitrary value patterns (e.g., bg-[#fff], text-[16px])
  if (/\[.+\]/.test(className)) return true;
  
  // Check for known Tailwind prefixes
  return KNOWN_TAILWIND_PREFIXES.some(prefix => 
    className.startsWith(prefix) || className.includes(':' + prefix)
  );
}

/**
 * Generate dynamic CSS for Tailwind arbitrary classes and custom CSS classes
 * Automatically detects and handles both cases:
 * 1. Tailwind arbitrary values: bg-[#0F9B6A], hover:bg-[#26C996]
 * 2. Custom CSS classes: dolfs-widget-button, my-custom-class
 */
function generateDynamicStyles(className: string | undefined, customCssUrl?: string): string {
  if (!className) return '';
  
  const styles: string[] = [];
  const classes = className.split(' ').filter(cls => cls.trim().length > 0);
  
  // Regex patterns for arbitrary value classes
  const bgPattern = /^bg-\[([^\]]+)\]$/;
  const hoverBgPattern = /^hover:bg-\[([^\]]+)\]$/;
  const textPattern = /^text-\[([^\]]+)\]$/;
  const borderPattern = /^border-\[([^\]]+)\]$/;
  
  let hasArbitraryClasses = false;
  let hasCustomClasses = false;
  const customClasses: string[] = [];
  
  classes.forEach(cls => {
    // Skip if it's a modifier without a base class (e.g., just "hover:")
    if (cls.endsWith(':')) return;
    
    // Handle Tailwind arbitrary values
    let match = cls.match(bgPattern);
    if (match) {
      styles.push(`#chainlit-copilot-button { background-color: ${match[1]} !important; }`);
      hasArbitraryClasses = true;
      return;
    }
    
    match = cls.match(hoverBgPattern);
    if (match) {
      styles.push(`#chainlit-copilot-button:hover { background-color: ${match[1]} !important; }`);
      hasArbitraryClasses = true;
      return;
    }
    
    match = cls.match(textPattern);
    if (match) {
      styles.push(`#chainlit-copilot-button { color: ${match[1]} !important; }`);
      hasArbitraryClasses = true;
      return;
    }
    
    match = cls.match(borderPattern);
    if (match) {
      styles.push(`#chainlit-copilot-button { border-color: ${match[1]} !important; }`);
      hasArbitraryClasses = true;
      return;
    }
    
    // Check if it's a custom class (not a known Tailwind class)
    if (!isTailwindClass(cls)) {
      hasCustomClasses = true;
      customClasses.push(cls);
    }
  });
  
  // If custom classes are found and no customCssUrl was provided, generate default styles
  if (hasCustomClasses && !customCssUrl) {
    console.info(
      '[Widget Info] Custom CSS classes detected: ' + customClasses.join(', ') + '\n' +
      'The widget will apply these classes to the button element.\n' +
      'To define styles for these classes, use the customCssUrl option.\n' +
      'Example:\n' +
      '  const css = `.${customClasses[0]} { background-color: #0F9B6A !important; }`;\n' +
      '  mountWidget({ customCssUrl: "data:text/css;base64," + btoa(css), ... });'
    );
  }
  
  if (hasArbitraryClasses && !hasCustomClasses) {
    console.info('[Widget Info] ✓ Tailwind arbitrary classes processed successfully');
  }
  
  return styles.join('\n');
}

window.mountChainlitWidget = (config: IWidgetConfig) => {
  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);

  const shadowContainer = container.attachShadow({ mode: 'open' });
  const shadowRootElement = document.createElement('div');
  shadowRootElement.id = 'cl-shadow-root';
  shadowContainer.appendChild(shadowRootElement);

  window.cl_shadowRootElement = shadowRootElement;

  // Generate dynamic styles for arbitrary Tailwind classes and custom CSS classes
  const dynamicStyles = generateDynamicStyles(config.button?.className, config.customCssUrl);
  
  if (dynamicStyles) {
    const styleEl = document.createElement('style');
    styleEl.textContent = dynamicStyles;
    shadowContainer.appendChild(styleEl);
  }

  root = ReactDOM.createRoot(shadowRootElement);
  root.render(
    <React.StrictMode>
      <style type="text/css">{tailwindcss.toString()}</style>
      <style type="text/css">{sonnercss.toString()}</style>
      <style type="text/css">{hljscss.toString()}</style>
      <AppWrapper widgetConfig={config} />
    </React.StrictMode>
  );
};

window.unmountChainlitWidget = () => {
  root?.unmount();
};

window.sendChainlitMessage = () => {
  console.info('Copilot is not active. Please check if the widget is mounted.');
};

window.getChainlitCopilotThreadId = getChainlitCopilotThreadId;
window.clearChainlitCopilotThreadId = clearChainlitCopilotThreadId;
