import mermaid from 'mermaid';

/**
 * Initialize Mermaid once for CustomElement previews.
 *
 * `startOnLoad` stays false so CustomElements control when a diagram renders.
 * `securityLevel: 'strict'` sanitizes labels before SVG is injected.
 */
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict'
});

export default mermaid;
