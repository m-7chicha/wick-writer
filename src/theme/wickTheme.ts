import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import type { EditorFontId, EditorMeasure, PaperSizeId, WickThemeId } from '../types/wick';

export const wickAstryxTheme = defineTheme({
  name: 'wick-editorial',
  icons: neutralTheme.icons,
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: '"Plus Jakarta Sans"',
      fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    heading: {
      family: '"Fraunces"',
      fallbacks: 'Georgia, serif',
      weights: { 1: 'semibold', 2: 'semibold', 3: 'semibold', 4: 'medium' },
    },
    code: {
      family: '"JetBrains Mono"',
      fallbacks: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
  motion: { fast: 120, medium: 180, slow: 420, ratio: 0.75 },
  tokens: {
    '--color-background-body': ['#F5F1E8', '#0B0B0E'],
    '--color-background-surface': ['#FCF9F2', '#121318'],
    '--color-background-card': ['#FCF9F2', '#16171E'],
    '--color-background-popover': ['#FCF9F2', '#1A1B23'],
    '--color-background-muted': ['#EBE4D7', '#191A22'],

    '--color-accent': ['#B4690E', '#E09F3E'],
    '--color-accent-muted': ['rgba(180, 105, 14, 0.14)', 'rgba(224, 159, 62, 0.16)'],
    '--color-on-accent': ['#FCF9F2', '#0B0B0E'],

    '--color-text-primary': ['#1C1917', '#EFECE6'],
    '--color-text-secondary': ['#5E5851', '#A6A29C'],
    '--color-text-disabled': ['#9C958C', '#5D5A55'],
    '--color-text-accent': ['#9A5608', '#E9B15E'],

    '--color-border': ['rgba(28, 25, 23, 0.10)', 'rgba(255, 248, 235, 0.08)'],
    '--color-border-emphasized': ['rgba(28, 25, 23, 0.22)', 'rgba(255, 248, 235, 0.16)'],

    '--color-overlay': ['rgba(28, 25, 23, 0.45)', 'rgba(5, 5, 8, 0.72)'],
    '--color-overlay-hover': ['rgba(28, 25, 23, 0.05)', 'rgba(255, 248, 235, 0.05)'],
    '--color-overlay-pressed': ['rgba(28, 25, 23, 0.10)', 'rgba(255, 248, 235, 0.10)'],

    '--radius-inner': '0.375rem',
    '--radius-element': '0.5rem',
    '--radius-container': '0.75rem',
    '--radius-page': '1.25rem',
  },
  components: {
    button: {
      'variant:primary': {
        backgroundColor: 'var(--wick-amber)',
        color: 'var(--wick-on-amber)',
      },
    },
    card: {
      base: {
        padding: 'var(--spacing-4)',
      },
    },
  },
});

export interface FontOption {
  id: EditorFontId;
  label: string;
  preview: string;
  stack: string;
}

export const EDITOR_FONT_OPTIONS: FontOption[] = [
  {
    id: 'lora',
    label: 'Lora Serif',
    preview: 'Classic literary book prose',
    stack: '"Lora", "Amiri", Georgia, serif',
  },
  {
    id: 'source-serif',
    label: 'Source Serif',
    preview: 'Crisp editorial manuscript',
    stack: '"Source Serif 4", "Amiri", Georgia, serif',
  },
  {
    id: 'cormorant',
    label: 'Cormorant',
    preview: 'Graceful fine-press serif',
    stack: '"Cormorant Garamond", "Amiri", Georgia, serif',
  },
  {
    id: 'amiri',
    label: 'Amiri (العربية)',
    preview: 'Classical literary Arabic & Latin serif',
    stack: '"Amiri", "Lora", Georgia, serif',
  },
  {
    id: 'plex-arabic',
    label: 'IBM Plex Arabic',
    preview: 'Clean modern Arabic & bilingual prose',
    stack: '"IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif',
  },
  {
    id: 'jakarta',
    label: 'Jakarta Sans',
    preview: 'Clean modern non-fiction',
    stack: '"Plus Jakarta Sans", "IBM Plex Sans Arabic", -apple-system, sans-serif',
  },
  {
    id: 'mono',
    label: 'Typewriter Mono',
    preview: 'Measured draft cadence',
    stack: '"JetBrains Mono", "IBM Plex Sans Arabic", ui-monospace, monospace',
  },
];

export function getEditorFontStack(fontId: EditorFontId): string {
  return EDITOR_FONT_OPTIONS.find((f) => f.id === fontId)?.stack ?? EDITOR_FONT_OPTIONS[0].stack;
}

export function getMeasureMaxWidth(measure: EditorMeasure): string {
  if (measure === 'narrow') return '38rem';
  if (measure === 'wide') return '52rem';
  return '44rem';
}

export function getAstryxMode(themeId: WickThemeId): 'light' | 'dark' {
  return themeId === 'parchment' ? 'light' : 'dark';
}

export interface PaperSizeSpec {
  id: PaperSizeId;
  label: string;
  shortLabel: string;
  description: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: PaperSizeSpec[] = [
  {
    id: 'a4',
    label: 'A4',
    shortLabel: 'A4',
    description: '210 × 297 mm · International Standard',
    widthMm: 210,
    heightMm: 297,
  },
  {
    id: 'a5',
    label: 'A5',
    shortLabel: 'A5',
    description: '148 × 210 mm · Half-A4 Pocket Book',
    widthMm: 148,
    heightMm: 210,
  },
  {
    id: 'b5',
    label: 'B5 (ISO)',
    shortLabel: 'B5',
    description: '176 × 250 mm · Universal Academic & Novel',
    widthMm: 176,
    heightMm: 250,
  },
  {
    id: 'letter',
    label: 'US Letter',
    shortLabel: 'Letter',
    description: '8.5 × 11 in (215.9 × 279.4 mm)',
    widthMm: 215.9,
    heightMm: 279.4,
  },
  {
    id: 'legal',
    label: 'US Legal',
    shortLabel: 'Legal',
    description: '8.5 × 14 in (215.9 × 355.6 mm)',
    widthMm: 215.9,
    heightMm: 355.6,
  },
  {
    id: 'executive',
    label: 'Executive',
    shortLabel: 'Exec',
    description: '7.25 × 10.5 in (184.2 × 266.7 mm)',
    widthMm: 184.2,
    heightMm: 266.7,
  },
  {
    id: 'trade',
    label: 'Trade Paperback (6×9")',
    shortLabel: '6×9"',
    description: '6 × 9 in (152.4 × 228.6 mm)',
    widthMm: 152.4,
    heightMm: 228.6,
  },
  {
    id: 'digest',
    label: 'Digest (5.5×8.5")',
    shortLabel: '5.5×8.5"',
    description: '5.5 × 8.5 in (139.7 × 215.9 mm)',
    widthMm: 139.7,
    heightMm: 215.9,
  },
  {
    id: 'royal',
    label: 'Royal Octavo',
    shortLabel: 'Royal',
    description: '156 × 234 mm · Hardcover Trade',
    widthMm: 156,
    heightMm: 234,
  },
  {
    id: 'custom',
    label: 'Custom Size',
    shortLabel: 'Custom',
    description: 'Choose any width and height',
    widthMm: 210,
    heightMm: 297,
  },
];

export interface ResolvedPaperDimensions {
  id: PaperSizeId;
  label: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  dimensionsLabel: string;
  pageWidthPx: number;
  pageHeightPx: number;
  pagePaddingX: number;
  pagePaddingTop: number;
  pagePaddingBottom: number;
  contentWidthPx: number;
  contentHeightPx: number;
  twipsW: number;
  twipsH: number;
  cssPageSize: string;
}

export function resolvePaperDimensions(
  paperSize: PaperSizeId = 'a4',
  customWidthMm = 210,
  customHeightMm = 297,
): ResolvedPaperDimensions {
  const preset = PAPER_SIZES.find((p) => p.id === paperSize) ?? PAPER_SIZES[0];
  const widthMm =
    paperSize === 'custom'
      ? Math.min(500, Math.max(80, Number(customWidthMm) || 210))
      : preset.widthMm;
  const heightMm =
    paperSize === 'custom'
      ? Math.min(650, Math.max(100, Number(customHeightMm) || 297))
      : preset.heightMm;

  // Faithful physical scale (2.95 px per mm => A4 ~ 620x876 px, A5 ~ 437x620 px, B5 ~ 519x738 px)
  const pxPerMm = 2.95;
  const pageWidthPx = Math.round(widthMm * pxPerMm);
  const pageHeightPx = Math.round(heightMm * pxPerMm);

  const pagePaddingX = Math.max(34, Math.round(pageWidthPx * 0.11));
  const pagePaddingTop = Math.max(40, Math.round(pageHeightPx * 0.085));
  const pagePaddingBottom = Math.max(46, Math.round(pageHeightPx * 0.09));

  const contentWidthPx = Math.max(180, pageWidthPx - pagePaddingX * 2);
  const contentHeightPx = Math.max(200, pageHeightPx - pagePaddingTop - pagePaddingBottom);

  // 1 inch = 25.4 mm = 1440 twips
  const twipsW = Math.round((widthMm / 25.4) * 1440);
  const twipsH = Math.round((heightMm / 25.4) * 1440);

  const formattedW = Number.isInteger(widthMm) ? widthMm : Number(widthMm.toFixed(1));
  const formattedH = Number.isInteger(heightMm) ? heightMm : Number(heightMm.toFixed(1));

  return {
    id: paperSize,
    label: paperSize === 'custom' ? `Custom (${formattedW} × ${formattedH} mm)` : preset.label,
    shortLabel: paperSize === 'custom' ? `${formattedW}×${formattedH}mm` : preset.shortLabel,
    widthMm,
    heightMm,
    dimensionsLabel: `${formattedW} × ${formattedH} mm`,
    pageWidthPx,
    pageHeightPx,
    pagePaddingX,
    pagePaddingTop,
    pagePaddingBottom,
    contentWidthPx,
    contentHeightPx,
    twipsW,
    twipsH,
    cssPageSize: `${widthMm}mm ${heightMm}mm`,
  };
}
