import * as LucideIcons from 'lucide-react';
import * as PhosphorIcons from '@phosphor-icons/react';
import React from 'react';
import * as ReactHookForm from 'react-hook-form';
import * as Recoil from 'recoil';
import { Runner } from 'react-runner';
import * as Sonner from 'sonner';
import * as XLSX from 'xlsx-js-style';
import * as Zod from 'zod';
import Plot from 'react-plotly.js';
import Editor from '@monaco-editor/react';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import * as ChainlitReactClient from '@chainlit/react-client';

import * as Markdown from '@/components/Markdown';
import * as AccordionComponents from '@/components/ui/accordion';
import * as AspectRatioComponents from '@/components/ui/aspect-ratio';
import * as AvatarComponents from '@/components/ui/avatar';
import * as BadgeComponents from '@/components/ui/badge';
import * as ButtonComponents from '@/components/ui/button';
import * as CardComponents from '@/components/ui/card';
import * as CarouselComponents from '@/components/ui/carousel';
import * as CheckboxComponents from '@/components/ui/checkbox';
import * as CommandComponents from '@/components/ui/command';
import * as DialogComponents from '@/components/ui/dialog';
import * as DropdownMenuComponents from '@/components/ui/dropdown-menu';
import * as FormComponents from '@/components/ui/form';
import * as HoverCardComponents from '@/components/ui/hover-card';
import * as InputComponents from '@/components/ui/input';
import * as LabelComponents from '@/components/ui/label';
import * as PaginationComponents from '@/components/ui/pagination';
import * as PopoverComponents from '@/components/ui/popover';
import * as ProgressComponents from '@/components/ui/progress';
import * as ScrollAreaComponents from '@/components/ui/scroll-area';
import * as SelectComponents from '@/components/ui/select';
import * as SeparatorComponents from '@/components/ui/separator';
import * as SheetComponents from '@/components/ui/sheet';
import * as SkeletonComponents from '@/components/ui/skeleton';
import * as SwitchComponents from '@/components/ui/switch';
import * as TableComponents from '@/components/ui/table';
import * as TabsComponents from '@/components/ui/tabs';
import * as TextareaComponents from '@/components/ui/textarea';
import * as TooltipComponents from '@/components/ui/tooltip';
import mermaid from '@/lib/mermaidSetup';
import '@/lib/monacoSetup';
import '@/lib/pdfSetup';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/**
 * Packages a `react` artifact may import. Recoil and `@chainlit/react-client`
 * stay off this list so model JSX cannot touch session atoms or the chat client.
 * Keep this map aligned with `ARTIFACT_REACT_IMPORT_SPECIFIERS` in the
 * artifact node plugin.
 */
const artifactReactImports = {
  react: React,
  sonner: Sonner,
  zod: Zod,
  xlsx: XLSX,
  mermaid,
  'react-plotly.js': Plot,
  '@monaco-editor/react': Editor,
  '@/components/markdown': Markdown,
  'react-hook-form': ReactHookForm,
  'lucide-react': LucideIcons,
  '@phosphor-icons/react': PhosphorIcons,
  '@/components/ui/tabs': TabsComponents,
  '@/components/ui/accordion': AccordionComponents,
  '@/components/ui/aspect-ratio': AspectRatioComponents,
  '@/components/ui/avatar': AvatarComponents,
  '@/components/ui/badge': BadgeComponents,
  '@/components/ui/button': ButtonComponents,
  '@/components/ui/card': CardComponents,
  '@/components/ui/carousel': CarouselComponents,
  '@/components/ui/checkbox': CheckboxComponents,
  '@/components/ui/command': CommandComponents,
  '@/components/ui/dialog': DialogComponents,
  '@/components/ui/dropdown-menu': DropdownMenuComponents,
  '@/components/ui/form': FormComponents,
  '@/components/ui/hover-card': HoverCardComponents,
  '@/components/ui/input': InputComponents,
  '@/components/ui/label': LabelComponents,
  '@/components/ui/pagination': PaginationComponents,
  '@/components/ui/popover': PopoverComponents,
  '@/components/ui/progress': ProgressComponents,
  '@/components/ui/scroll-area': ScrollAreaComponents,
  '@/components/ui/separator': SeparatorComponents,
  '@/components/ui/select': SelectComponents,
  '@/components/ui/sheet': SheetComponents,
  '@/components/ui/skeleton': SkeletonComponents,
  '@/components/ui/switch': SwitchComponents,
  '@/components/ui/table': TableComponents,
  '@/components/ui/textarea': TextareaComponents,
  '@/components/ui/tooltip': TooltipComponents
};

const Imports = {
  ...artifactReactImports,
  recoil: Recoil,
  '@chainlit/react-client': ChainlitReactClient,
  'react-runner': { Runner },
  'dolf-artifact-imports': { artifactReactImports },
  // Host CustomElements (ArtifactPreview) may import react-pdf. Model-authored
  // react artifacts cannot: this key stays off artifactReactImports.
  'react-pdf': { Document: PdfDocument, Page: PdfPage, pdfjs }
};

export default Imports;
