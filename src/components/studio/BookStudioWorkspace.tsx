import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  ChevronDown,
  Download,
  ExternalLink,
  Flame,
  Italic,
  Languages,
  List,
  ListOrdered,
  Minus,
  PenLine,
  Plus,
  Quote,
  Redo2,
  Ruler,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import {
  EDITOR_FONT_OPTIONS,
  PAPER_SIZES,
  getEditorFontStack,
  resolvePaperDimensions,
} from '../../theme/wickTheme';
import type {
  ChapterItem,
  EditorFontId,
  PaperSizeId,
  SceneItem,
  TextDirection,
  WorkItem,
} from '../../types/wick';
import { countWords, getWorkTotalWords } from '../../utils/htmlUtils';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { SpacingControl, type SpacingScope } from '../ui/SpacingControl';
import {
  applyLetterSpacingToSelection,
  applyLineHeightToSelection,
  clearSpacingFromElement,
  clearSpacingFromHtml,
  getEditorSelectionState,
} from '../../utils/spacingDom';
import {
  WickButton,
  WickInput,
  WickMenu,
  WickModal,
  WickSegment,
  WickSegmentedControl,
  WickTooltip,
} from '../ui/WickPrimitives';
import { ExportDialog } from '../write/ExportDialog';

type PaperSurface = 'obsidian' | 'vellum' | 'sepia';
type ZoomSetting = 'fit' | 0.75 | 1 | 1.25;

interface PaginatedPage {
  pageNumber: number;
  headerTitle: string;
  chapterAnchorId?: string;
  primaryChapterId?: string;
  primarySceneId?: string;
  htmlBlocks: string[];
}

interface FlowUnit {
  html: string;
  headerTitle: string;
  chapterAnchorId?: string;
  chapterId?: string;
  sceneId?: string;
  startNewPage?: boolean;
  isHeader?: boolean;
  splittableTag?: 'p' | 'blockquote';
  splittableText?: string;
  splittableStyle?: string;
}

interface LampRect {
  left: number;
  top: number;
  width: number;
}

function escapeHtmlSafe(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFlowUnits(work: WorkItem, totalWords: number, paperLabel: string, isRtl: boolean): FlowUnit[] {
  const units: FlowUnit[] = [];

  const titleHeaderHtml = `
    <div style="text-align: center; padding-bottom: 24px; margin-bottom: 26px; border-bottom: 1px solid var(--wick-paper-border);">
      <h1 class="wick-font-display" style="font-size: 2em; font-weight: 600; line-height: 1.2; margin: 0;">${escapeHtmlSafe(work.title || 'Untitled')}</h1>
      ${work.subtitle ? `<p class="wick-paper-muted" style="margin-top: 8px; font-style: italic; font-size: 0.95em;">${escapeHtmlSafe(work.subtitle)}</p>` : ''}
      ${work.author ? `<p class="wick-paper-muted" style="margin-top: 14px; font-size: 0.85em;">${escapeHtmlSafe(work.author)}</p>` : ''}
      <p class="wick-paper-muted wick-tabular" style="margin-top: 6px; font-size: 0.72em;">${totalWords.toLocaleString()} ${isRtl ? 'كلمة' : 'words'} · ${escapeHtmlSafe(paperLabel)}</p>
    </div>
  `;
  units.push({
    html: titleHeaderHtml,
    headerTitle: work.title,
    chapterId: work.chapters[0]?.id,
    isHeader: true,
  });

  const extractHtmlUnits = (
    rawHtml: string,
    headerTitle: string,
    chapterId: string,
    sceneId?: string,
    firstChapterAnchor?: string,
  ) => {
    const container = document.createElement('div');
    container.innerHTML = rawHtml || '<p><br></p>';
    let anchorPending = firstChapterAnchor;

    const pushElement = (el: HTMLElement) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
        if (items.length > 1) {
          items.forEach((li) => {
            units.push({
              html: `<${tag}>${li.outerHTML}</${tag}>`,
              headerTitle,
              chapterAnchorId: anchorPending,
              chapterId,
              sceneId,
            });
            anchorPending = undefined;
          });
          return;
        }
      }

      const text = (el.textContent ?? '').trim();
      const isSimpleTextBlock =
        (tag === 'p' || tag === 'blockquote') && el.children.length === 0 && text.length > 90;
      const styleAttr = el.getAttribute('style')?.trim() || undefined;

      units.push({
        html: el.outerHTML,
        headerTitle,
        chapterAnchorId: anchorPending,
        chapterId,
        sceneId,
        splittableTag: isSimpleTextBlock ? (tag as 'p' | 'blockquote') : undefined,
        splittableText: isSimpleTextBlock ? text : undefined,
        splittableStyle: isSimpleTextBlock ? styleAttr : undefined,
      });
      anchorPending = undefined;
    };

    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === 'div' && el.children.length > 0) {
          Array.from(el.children).forEach((child) => pushElement(child as HTMLElement));
        } else {
          pushElement(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        const text = node.textContent.trim();
        units.push({
          html: `<p>${escapeHtmlSafe(text)}</p>`,
          headerTitle,
          chapterAnchorId: anchorPending,
          chapterId,
          sceneId,
          splittableTag: text.length > 90 ? 'p' : undefined,
          splittableText: text.length > 90 ? text : undefined,
        });
        anchorPending = undefined;
      }
    });
  };

  work.chapters.forEach((chapter, chIdx) => {
    const chLabel = work.kind === 'book' ? chapter.title : work.title;
    if (work.kind === 'book') {
      units.push({
        html: `<h2 class="wick-font-display" style="font-size: 1.45em; font-weight: 500; text-align: center; margin: 0 0 18px 0;">${escapeHtmlSafe(chapter.title)}</h2>`,
        headerTitle: chapter.title,
        chapterAnchorId: chapter.id,
        chapterId: chapter.id,
        startNewPage: chIdx > 0,
      });
    }

    extractHtmlUnits(
      chapter.contentHtml,
      chLabel,
      chapter.id,
      undefined,
      work.kind === 'book' ? undefined : chapter.id,
    );

    chapter.scenes.forEach((scene) => {
      units.push({
        html: `<p class="wick-paper-muted" style="text-align: center; margin: 16px 0;">* * *</p>`,
        headerTitle: chLabel,
        chapterId: chapter.id,
        sceneId: scene.id,
      });
      extractHtmlUnits(scene.contentHtml, chLabel, chapter.id, scene.id);
    });
  });

  return units;
}

export function BookStudioWorkspace({ workId }: { workId?: string }) {
  const { works, settings, saveState, updateWork, updateSettings, openWorkTab } = useWick();
  const [selectedWorkId, setSelectedWorkId] = useState<string | undefined>(workId);
  const [spreadMode, setSpreadMode] = useState<'single' | 'spread'>('single');
  const [surface, setSurface] = useState<PaperSurface>('vellum');
  const [zoomSetting, setZoomSetting] = useState<ZoomSetting>('fit');
  const [containerWidth, setContainerWidth] = useState(960);
  const [showToc, setShowToc] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [pages, setPages] = useState<PaginatedPage[]>([]);

  // Studio Editing Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [showBookDetails, setShowBookDetails] = useState(true);
  const [activeChapterId, setActiveChapterId] = useState<string | undefined>(undefined);
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>(undefined);
  const [currentBlockLabel, setCurrentBlockLabel] = useState('Paragraph');
  const [lampRect, setLampRect] = useState<LampRect | null>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [spacingSelectionState, setSpacingSelectionState] = useState<{
    hasSelection: boolean;
    lineHeight?: number;
    letterSpacing?: number;
  }>({ hasSelection: false });
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'Chapter' | 'Scene';
    chapterId: string;
    sceneId?: string;
    title: string;
  } | null>(null);

  // Custom Paper Size Modal state
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [customUnit, setCustomUnit] = useState<'mm' | 'in'>('mm');
  const [customWidthInput, setCustomWidthInput] = useState(String(settings.customPaperWidthMm));
  const [customHeightInput, setCustomHeightInput] = useState(String(settings.customPaperHeightMm));

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const studioEditorRef = useRef<HTMLDivElement | null>(null);
  const studioStageRef = useRef<HTMLDivElement | null>(null);
  const lastStudioLoadedKeyRef = useRef<string>('');
  const savedSpacingRangeRef = useRef<Range | null>(null);

  const work = useMemo(
    () => works.find((w) => w.id === (selectedWorkId ?? workId)) ?? works[0],
    [works, selectedWorkId, workId],
  );

  const activeChapter = useMemo(() => {
    if (!work) return undefined;
    return work.chapters.find((c) => c.id === activeChapterId) ?? work.chapters[0];
  }, [work, activeChapterId]);

  const activeScene = useMemo(() => {
    if (!activeChapter || !activeSceneId) return undefined;
    return activeChapter.scenes.find((s) => s.id === activeSceneId);
  }, [activeChapter, activeSceneId]);

  const activeUnitHtml = activeScene
    ? activeScene.contentHtml
    : activeChapter?.contentHtml ?? '<p><br></p>';

  const studioUnitKey = `${work?.id ?? ''}:${activeChapter?.id ?? ''}:${activeScene?.id ?? ''}:${isEditing}`;

  // Hydrate studio editor only when switching unit or toggling edit mode
  useEffect(() => {
    if (!isEditing) {
      lastStudioLoadedKeyRef.current = '';
      return;
    }
    const el = studioEditorRef.current;
    if (!el) return;
    if (lastStudioLoadedKeyRef.current !== studioUnitKey) {
      el.innerHTML = activeUnitHtml || '<p><br></p>';
      lastStudioLoadedKeyRef.current = studioUnitKey;
      setLampRect(null);
    }
  }, [isEditing, studioUnitKey, activeUnitHtml]);

  // Observe reading desk width so "Fit" zoom always keeps Single or Spread pages crisp in view
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const updateWidth = () => setContainerWidth(el.clientWidth || 960);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showToc, isEditing]);

  const effectiveFont = work?.defaultFont ?? settings.editorFont;
  const effectiveFontSize = work?.studioFontSize ?? 16;
  const effectiveDir: TextDirection = work?.direction ?? settings.defaultDirection ?? 'auto';
  const isRtl = useMemo(() => {
    if (!work) return false;
    if (effectiveDir === 'rtl') return true;
    if (effectiveDir === 'ltr') return false;
    const sample = `${work.title} ${work.chapters[0]?.contentHtml ?? ''}`;
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(sample);
  }, [work, effectiveDir]);

  const effectiveLineHeight =
    work?.lineHeight ?? (isRtl ? 1.9 : settings.defaultLineHeight ?? 1.75);
  const effectiveLetterSpacing = work?.letterSpacing ?? settings.defaultLetterSpacing ?? 0;

  const paperDim = resolvePaperDimensions(
    settings.paperSize,
    settings.customPaperWidthMm,
    settings.customPaperHeightMm,
  );

  const totalWords = work ? getWorkTotalWords(work.chapters) : 0;

  // Living Light moving word-lamp tracker inside Studio Editor
  const updateLampFromSelection = useCallback(() => {
    if (!settings.livingLightEnabled || !isEditing) {
      setLampRect(null);
      return;
    }
    const stage = studioStageRef.current;
    const editor = studioEditorRef.current;
    if (!stage || !editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      return;
    }

    const caretRange = sel.getRangeAt(0).cloneRange();
    caretRange.collapse(true);
    let rect = caretRange.getBoundingClientRect();
    const anchor = sel.anchorNode;

    if (anchor && anchor.nodeType === Node.TEXT_NODE) {
      const text = anchor.textContent ?? '';
      const offset = sel.anchorOffset;
      let start = offset;
      let end = offset;
      while (start > 0 && !/\s/.test(text[start - 1])) start--;
      while (end < text.length && !/\s/.test(text[end])) end++;
      if (end > start) {
        try {
          const wordRange = document.createRange();
          wordRange.setStart(anchor, start);
          wordRange.setEnd(anchor, end);
          const wordRect = wordRange.getBoundingClientRect();
          if (wordRect.width > 0 && wordRect.height > 0) rect = wordRect;
        } catch {
          // ignore
        }
      }
    }

    if (rect.height === 0) {
      const rects = caretRange.getClientRects();
      if (rects.length > 0 && rects[0].height > 0) {
        rect = rects[0];
      } else {
        const el = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
        if (el) {
          const elRect = el.getBoundingClientRect();
          const isRtlEl = getComputedStyle(el).direction === 'rtl';
          rect = new DOMRect(
            isRtlEl ? elRect.right - 2 : elRect.left,
            elRect.top + 4,
            2,
            Math.round(effectiveFontSize * 1.45),
          );
        }
      }
    }

    if (rect.height === 0) return;
    const stageRect = stage.getBoundingClientRect();
    const barWidth = Math.max(46, Math.min(150, rect.width + 18));
    const centerX = rect.left - stageRect.left + rect.width / 2;
    const left = Math.max(0, Math.min(Math.max(0, stageRect.width - barWidth), centerX - barWidth / 2));
    const top = rect.bottom - stageRect.top + 2;
    setLampRect({ left, top, width: barWidth });
  }, [settings.livingLightEnabled, isEditing, effectiveFontSize]);

  useEffect(() => {
    if (!isEditing || !settings.livingLightEnabled) {
      setLampRect(null);
      return;
    }
    const onSelChange = () => {
      if (isEditorFocused) updateLampFromSelection();
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [isEditing, settings.livingLightEnabled, isEditorFocused, updateLampFromSelection]);

  // Compute exact separated physical pages matching the chosen universal paper dimensions
  useLayoutEffect(() => {
    const measurer = measureRef.current;
    if (!work || !measurer) {
      setPages([]);
      return;
    }

    const units = buildFlowUnits(work, totalWords, paperDim.label, isRtl);
    const maxH = paperDim.contentHeightPx;
    const outPages: PaginatedPage[] = [];

    let currentBlocks: string[] = [];
    let currentHeader = work.title;
    let currentAnchor: string | undefined;
    let primaryChapterId: string | undefined;
    let primarySceneId: string | undefined;

    const flushPage = () => {
      if (currentBlocks.length === 0) return;
      outPages.push({
        pageNumber: outPages.length + 1,
        headerTitle: currentHeader,
        chapterAnchorId: currentAnchor,
        primaryChapterId,
        primarySceneId,
        htmlBlocks: currentBlocks,
      });
      currentBlocks = [];
      currentAnchor = undefined;
      primaryChapterId = undefined;
      primarySceneId = undefined;
    };

    const measureHtmlHeight = (blocks: string[]): number => {
      measurer.innerHTML = blocks.join('');
      return measurer.scrollHeight;
    };

    for (const unit of units) {
      if (unit.startNewPage && currentBlocks.length > 0) {
        flushPage();
      }
      if (unit.chapterAnchorId && !currentAnchor) currentAnchor = unit.chapterAnchorId;
      if (unit.chapterId && !primaryChapterId) {
        primaryChapterId = unit.chapterId;
        primarySceneId = unit.sceneId;
      }
      if (unit.headerTitle) currentHeader = unit.headerTitle;

      const candidate = [...currentBlocks, unit.html];
      if (measureHtmlHeight(candidate) <= maxH) {
        currentBlocks = candidate;
        continue;
      }

      if (unit.splittableText && unit.splittableTag) {
        const words = unit.splittableText.split(/\s+/);
        const tag = unit.splittableTag;
        let remainingWords = words;

        while (remainingWords.length > 0) {
          let lo = 1;
          let hi = remainingWords.length;
          let best = 0;

          const styleChunk = unit.splittableStyle
            ? ` style="${escapeHtmlSafe(unit.splittableStyle)}"`
            : '';

          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const sliceHtml = `<${tag}${styleChunk}>${escapeHtmlSafe(remainingWords.slice(0, mid).join(' '))}</${tag}>`;
            if (measureHtmlHeight([...currentBlocks, sliceHtml]) <= maxH) {
              best = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }

          if (best < 6 && currentBlocks.length > 0) {
            flushPage();
            currentHeader = unit.headerTitle;
            if (unit.chapterId) {
              primaryChapterId = unit.chapterId;
              primarySceneId = unit.sceneId;
            }
            continue;
          }

          const takeCount = Math.max(1, best);
          const partHtml = `<${tag}${styleChunk}>${escapeHtmlSafe(remainingWords.slice(0, takeCount).join(' '))}</${tag}>`;
          currentBlocks.push(partHtml);
          remainingWords = remainingWords.slice(takeCount);

          if (remainingWords.length > 0) {
            flushPage();
            currentHeader = unit.headerTitle;
            if (unit.chapterId) {
              primaryChapterId = unit.chapterId;
              primarySceneId = unit.sceneId;
            }
          }
        }
      } else {
        if (currentBlocks.length > 0) {
          flushPage();
          currentHeader = unit.headerTitle;
          if (unit.chapterAnchorId) currentAnchor = unit.chapterAnchorId;
          if (unit.chapterId) {
            primaryChapterId = unit.chapterId;
            primarySceneId = unit.sceneId;
          }
        }
        currentBlocks.push(unit.html);
      }
    }

    flushPage();
    setPages(outPages);
  }, [
    work,
    totalWords,
    paperDim.label,
    paperDim.contentWidthPx,
    paperDim.contentHeightPx,
    effectiveFont,
    effectiveFontSize,
    effectiveLineHeight,
    effectiveLetterSpacing,
    effectiveDir,
    isRtl,
  ]);

  if (!work || !activeChapter) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-sm text-[var(--wick-muted)]">
        <BookOpen className="w-8 h-8 mb-3 opacity-60" />
        Open or create a manuscript in Write to preview it in Book Studio.
      </div>
    );
  }

  const isBook = work.kind === 'book';
  const surfaceStyles: Record<
    PaperSurface,
    { bg: string; text: string; muted: string; border: string; quoteBg: string }
  > = {
    obsidian: {
      bg: '#13141A',
      text: '#EFECE6',
      muted: '#A49F97',
      border: 'rgba(255,248,235,0.12)',
      quoteBg: 'rgba(224, 159, 62, 0.12)',
    },
    vellum: {
      bg: '#FAF6EE',
      text: '#1C1917',
      muted: '#5E574E',
      border: 'rgba(29,26,22,0.14)',
      quoteBg: 'rgba(180, 105, 14, 0.08)',
    },
    sepia: {
      bg: '#EFE6D5',
      text: '#231B13',
      muted: '#625444',
      border: 'rgba(38,30,22,0.16)',
      quoteBg: 'rgba(160, 92, 11, 0.09)',
    },
  };

  const paper = surfaceStyles[surface];
  const isLightTheme = settings.theme === 'parchment';
  const lampOpacity =
    settings.livingLightEnabled && isEditorFocused && lampRect
      ? Math.max(0.25, settings.livingLightIntensity / 100)
      : 0;

  const availableDeskWidth = Math.max(300, containerWidth - 56);
  const spreadGap = 24;
  const rawNeededWidth =
    spreadMode === 'spread' ? paperDim.pageWidthPx * 2 + spreadGap : paperDim.pageWidthPx;
  const autoFitScale = Math.min(1.06, Math.max(0.42, availableDeskWidth / rawNeededWidth));
  const pageScale = zoomSetting === 'fit' ? autoFitScale : zoomSetting;

  const syncStudioEditorContent = () => {
    const el = studioEditorRef.current;
    if (!el) return;
    const html = el.innerHTML || '<p><br></p>';
    const now = new Date().toISOString();

    if (activeScene) {
      const nextChapters = work.chapters.map((ch) =>
        ch.id === activeChapter.id
          ? {
              ...ch,
              scenes: ch.scenes.map((sc) =>
                sc.id === activeScene.id
                  ? { ...sc, contentHtml: html, wordCount: countWords(html), updatedAt: now }
                  : sc,
              ),
            }
          : ch,
      );
      updateWork(work.id, { chapters: nextChapters });
    } else {
      const nextChapters = work.chapters.map((ch) =>
        ch.id === activeChapter.id
          ? { ...ch, contentHtml: html, wordCount: countWords(html), updatedAt: now }
          : ch,
      );
      updateWork(work.id, { chapters: nextChapters });
    }
  };

  const handlePrepareSpacing = () => {
    if (!isEditing) {
      savedSpacingRangeRef.current = null;
      setSpacingSelectionState({ hasSelection: false });
      return { hasSelection: false };
    }
    const info = getEditorSelectionState(studioEditorRef.current);
    if (info) {
      savedSpacingRangeRef.current = info.range;
      setSpacingSelectionState({
        hasSelection: info.hasTextSelection,
        lineHeight: info.blockLineHeight,
        letterSpacing: info.selectionLetterSpacing,
      });
      return { hasSelection: info.hasTextSelection };
    }
    savedSpacingRangeRef.current = null;
    setSpacingSelectionState({ hasSelection: false });
    return { hasSelection: false };
  };

  const clearWorkInlineSpacing = (mode: 'lineHeight' | 'letterSpacing' | 'both') => {
    const el = studioEditorRef.current;
    if (el) {
      clearSpacingFromElement(el, mode);
    }
    const now = new Date().toISOString();
    return work.chapters.map((ch) => {
      const isCurrentChapter = isEditing && ch.id === activeChapter.id && !activeScene;
      const chHtml =
        isCurrentChapter && el ? el.innerHTML || '<p><br></p>' : clearSpacingFromHtml(ch.contentHtml, mode);
      return {
        ...ch,
        contentHtml: chHtml,
        wordCount: countWords(chHtml),
        updatedAt: now,
        scenes: ch.scenes.map((sc) => {
          const isCurrentScene = isEditing && ch.id === activeChapter.id && activeScene?.id === sc.id;
          const scHtml =
            isCurrentScene && el ? el.innerHTML || '<p><br></p>' : clearSpacingFromHtml(sc.contentHtml, mode);
          return {
            ...sc,
            contentHtml: scHtml,
            wordCount: countWords(scHtml),
            updatedAt: now,
          };
        }),
      };
    });
  };

  const handleSpacingLineHeight = (val: number, scope: SpacingScope) => {
    const el = studioEditorRef.current;
    if (isEditing && scope === 'selection' && el) {
      const nextRange = applyLineHeightToSelection(el, savedSpacingRangeRef.current, val);
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
        setSpacingSelectionState((prev) => ({ ...prev, lineHeight: val }));
        syncStudioEditorContent();
        window.requestAnimationFrame(updateLampFromSelection);
        return;
      }
    }
    const cleanedChapters = clearWorkInlineSpacing('lineHeight');
    updateWork(work.id, { lineHeight: val, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const handleSpacingLetterSpacing = (val: number, scope: SpacingScope) => {
    const el = studioEditorRef.current;
    if (isEditing && scope === 'selection' && el) {
      const nextRange = applyLetterSpacingToSelection(el, savedSpacingRangeRef.current, val);
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
        setSpacingSelectionState((prev) => ({ ...prev, letterSpacing: val }));
        syncStudioEditorContent();
        window.requestAnimationFrame(updateLampFromSelection);
        return;
      }
    }
    const cleanedChapters = clearWorkInlineSpacing('letterSpacing');
    updateWork(work.id, { letterSpacing: val, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const handleSpacingReset = (scope: SpacingScope) => {
    const el = studioEditorRef.current;
    if (isEditing && scope === 'selection' && el) {
      let nextRange = applyLineHeightToSelection(el, savedSpacingRangeRef.current, effectiveLineHeight);
      nextRange = applyLetterSpacingToSelection(
        el,
        nextRange ?? savedSpacingRangeRef.current,
        effectiveLetterSpacing,
      );
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
      }
      setSpacingSelectionState((prev) => ({
        ...prev,
        lineHeight: undefined,
        letterSpacing: undefined,
      }));
      syncStudioEditorContent();
      window.requestAnimationFrame(updateLampFromSelection);
      return;
    }
    const cleanedChapters = clearWorkInlineSpacing('both');
    updateWork(work.id, { lineHeight: 1.75, letterSpacing: 0, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const execStudioFormat = (command: string, value?: string) => {
    const el = studioEditorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    syncStudioEditorContent();
    detectStudioBlock();
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const insertSceneBreak = () => {
    const el = studioEditorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(
      'insertHTML',
      false,
      '<p style="text-align: center;">* * *</p><p><br></p>',
    );
    syncStudioEditorContent();
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const detectStudioBlock = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;
    let node: Node | null = sel.anchorNode;
    while (node && node !== studioEditorRef.current) {
      if (node instanceof HTMLElement) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'h1') {
          setCurrentBlockLabel('Heading 1');
          return;
        }
        if (tag === 'h2') {
          setCurrentBlockLabel('Heading 2');
          return;
        }
        if (tag === 'h3') {
          setCurrentBlockLabel('Heading 3');
          return;
        }
        if (tag === 'blockquote') {
          setCurrentBlockLabel('Quote');
          return;
        }
        if (tag === 'p' || tag === 'div') {
          setCurrentBlockLabel('Paragraph');
          return;
        }
      }
      node = node.parentNode;
    }
  };

  const handleSetDirection = (dir: TextDirection) => {
    const patch: Partial<WorkItem> = { direction: dir };
    if (dir === 'rtl' && work.defaultFont === 'lora') {
      patch.defaultFont = 'amiri';
    }
    updateWork(work.id, patch);
  };

  const handleAddChapter = () => {
    const now = new Date().toISOString();
    const newCh: ChapterItem = {
      id: `ch-${Date.now().toString(36)}`,
      title: `Chapter ${work.chapters.length + 1}`,
      contentHtml: '<p><br></p>',
      wordCount: 0,
      scenes: [],
      updatedAt: now,
    };
    updateWork(work.id, { chapters: [...work.chapters, newCh] });
    setActiveChapterId(newCh.id);
    setActiveSceneId(undefined);
  };

  const handleAddScene = () => {
    const now = new Date().toISOString();
    const newSceneId = `sc-${Date.now().toString(36)}`;
    const nextChapters = work.chapters.map((ch) => {
      if (ch.id !== activeChapter.id) return ch;
      const nextScene: SceneItem = {
        id: newSceneId,
        title: `Scene ${ch.scenes.length + 1}`,
        contentHtml: '<p><br></p>',
        wordCount: 0,
        updatedAt: now,
      };
      return { ...ch, scenes: [...ch.scenes, nextScene] };
    });
    updateWork(work.id, { chapters: nextChapters });
    setActiveSceneId(newSceneId);
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (work.chapters.length <= 1) return;
    const nextChapters = work.chapters.filter((ch) => ch.id !== chapterId);
    updateWork(work.id, { chapters: nextChapters });
    if (activeChapter.id === chapterId) {
      setActiveChapterId(nextChapters[0].id);
      setActiveSceneId(undefined);
    }
  };

  const handleDeleteScene = (chapterId: string, sceneId: string) => {
    const nextChapters = work.chapters.map((ch) =>
      ch.id === chapterId
        ? { ...ch, scenes: ch.scenes.filter((sc) => sc.id !== sceneId) }
        : ch,
    );
    updateWork(work.id, { chapters: nextChapters });
    if (activeScene?.id === sceneId) {
      setActiveSceneId(undefined);
    }
  };

  const openCustomSizeDialog = () => {
    setCustomUnit('mm');
    setCustomWidthInput(String(paperDim.widthMm));
    setCustomHeightInput(String(paperDim.heightMm));
    setShowCustomSizeModal(true);
  };

  const handleUnitChange = (nextUnit: 'mm' | 'in') => {
    if (nextUnit === customUnit) return;
    const w = parseFloat(customWidthInput) || 210;
    const h = parseFloat(customHeightInput) || 297;
    if (nextUnit === 'in') {
      setCustomWidthInput((w / 25.4).toFixed(2));
      setCustomHeightInput((h / 25.4).toFixed(2));
    } else {
      setCustomWidthInput(String(Math.round(w * 25.4)));
      setCustomHeightInput(String(Math.round(h * 25.4)));
    }
    setCustomUnit(nextUnit);
  };

  const applyCustomPaperSize = () => {
    const rawW = parseFloat(customWidthInput) || (customUnit === 'in' ? 8.5 : 210);
    const rawH = parseFloat(customHeightInput) || (customUnit === 'in' ? 11 : 297);
    const widthMm = customUnit === 'in' ? Number((rawW * 25.4).toFixed(1)) : rawW;
    const heightMm = customUnit === 'in' ? Number((rawH * 25.4).toFixed(1)) : rawH;
    const clampedW = Math.min(500, Math.max(80, widthMm));
    const clampedH = Math.min(650, Math.max(100, heightMm));

    void updateSettings({
      paperSize: 'custom',
      customPaperWidthMm: clampedW,
      customPaperHeightMm: clampedH,
    });
    setShowCustomSizeModal(false);
  };

  const paperVars = {
    backgroundColor: paper.bg,
    color: paper.text,
    border: `1px solid ${paper.border}`,
    fontFamily: getEditorFontStack(effectiveFont),
    '--wick-paper-ink': paper.text,
    '--wick-paper-muted': paper.muted,
    '--wick-paper-border': paper.border,
    '--wick-paper-quote-bg': paper.quoteBg,
    '--color-text-primary': paper.text,
    '--color-text-secondary': paper.muted,
  } as CSSProperties;

  const pageRows: PaginatedPage[][] = [];
  if (spreadMode === 'spread') {
    for (let i = 0; i < pages.length; i += 2) {
      pageRows.push(pages.slice(i, i + 2));
    }
  } else {
    pages.forEach((p) => pageRows.push([p]));
  }

  const activeFontOption =
    EDITOR_FONT_OPTIONS.find((f) => f.id === effectiveFont) ?? EDITOR_FONT_OPTIONS[0];
  const dirLabel =
    effectiveDir === 'rtl' ? 'RTL · العربية' : effectiveDir === 'ltr' ? 'LTR' : 'Auto';

  // Build chapter + scene switcher options for Edit Book pane
  const outlineMenuItems = work.chapters.flatMap((ch) => [
    {
      id: `ch-${ch.id}`,
      label: isBook ? ch.title : 'Manuscript Body',
      description: `${countWords(ch.contentHtml).toLocaleString()} words`,
      selected: ch.id === activeChapter.id && !activeScene,
      onClick: () => {
        setActiveChapterId(ch.id);
        setActiveSceneId(undefined);
      },
    },
    ...ch.scenes.map((sc) => ({
      id: `sc-${sc.id}`,
      label: `  ↳ ${sc.title}`,
      description: `${countWords(sc.contentHtml).toLocaleString()} words`,
      selected: ch.id === activeChapter.id && activeScene?.id === sc.id,
      onClick: () => {
        setActiveChapterId(ch.id);
        setActiveSceneId(sc.id);
      },
    })),
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Book Studio Primary Controls */}
      <div className="shrink-0 h-12 px-4 border-b border-[var(--wick-border)] bg-[var(--wick-surface)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {work.chapters.length > 1 && (
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors ${
                showToc
                  ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                  : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Contents</span>
            </button>
          )}

          <WickMenu
            alignment="start"
            menuWidth={240}
            items={works.map((w) => ({
              id: w.id,
              label: w.title,
              description: w.kind === 'book' ? `${w.chapters.length} chapters` : 'Document',
              selected: w.id === work.id,
              onClick: () => {
                setSelectedWorkId(w.id);
                setActiveChapterId(undefined);
                setActiveSceneId(undefined);
              },
            }))}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors max-w-[230px]"
              >
                <span dir="auto" className="truncate">
                  {work.title}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--wick-muted)] shrink-0" />
              </button>
            }
          />

          <span className="hidden xl:inline text-xs text-[var(--wick-muted)] wick-tabular whitespace-nowrap">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:block">
            <WickSegmentedControl
              label="Page layout"
              size="sm"
              value={spreadMode}
              onChange={(val) => setSpreadMode(val as 'single' | 'spread')}
            >
              <WickSegment value="single" label="Single Page" />
              <WickSegment value="spread" label="Book Spread" />
            </WickSegmentedControl>
          </div>

          {/* Paper Size Selector */}
          <WickMenu
            menuWidth={265}
            items={PAPER_SIZES.map((p) => ({
              id: p.id,
              label: p.label,
              description: p.description,
              selected: settings.paperSize === p.id,
              onClick: () => {
                if (p.id === 'custom') {
                  openCustomSizeDialog();
                } else {
                  void updateSettings({ paperSize: p.id as PaperSizeId });
                }
              },
            }))}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors whitespace-nowrap"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Size: {paperDim.shortLabel}</span>
              </button>
            }
          />

          {/* Paper Surface */}
          <WickMenu
            menuWidth={180}
            items={[
              {
                id: 'vellum',
                label: 'Warm Vellum',
                selected: surface === 'vellum',
                onClick: () => setSurface('vellum'),
              },
              {
                id: 'sepia',
                label: 'Sepia Dusk',
                selected: surface === 'sepia',
                onClick: () => setSurface('sepia'),
              },
              {
                id: 'obsidian',
                label: 'Night Obsidian',
                selected: surface === 'obsidian',
                onClick: () => setSurface('obsidian'),
              },
            ]}
            trigger={
              <button
                type="button"
                className="h-8 px-2.5 rounded-md text-xs font-medium text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors whitespace-nowrap"
              >
                Paper: {surface === 'vellum' ? 'Vellum' : surface === 'sepia' ? 'Sepia' : 'Obsidian'}
              </button>
            }
          />

          {/* Line & Letter Spacing */}
          <SpacingControl
            lineHeight={effectiveLineHeight}
            letterSpacing={effectiveLetterSpacing}
            selectionLineHeight={spacingSelectionState.lineHeight}
            selectionLetterSpacing={spacingSelectionState.letterSpacing}
            hasTextSelection={spacingSelectionState.hasSelection}
            canTargetSelection={isEditing && Boolean(studioEditorRef.current)}
            onBeforeOpen={handlePrepareSpacing}
            onChangeLineHeight={handleSpacingLineHeight}
            onChangeLetterSpacing={handleSpacingLetterSpacing}
            onReset={handleSpacingReset}
          />

          {/* Zoom */}
          <WickMenu
            menuWidth={150}
            items={[
              {
                id: 'fit',
                label: 'Fit Desk',
                selected: zoomSetting === 'fit',
                onClick: () => setZoomSetting('fit'),
              },
              {
                id: '75',
                label: '75%',
                selected: zoomSetting === 0.75,
                onClick: () => setZoomSetting(0.75),
              },
              {
                id: '100',
                label: '100%',
                selected: zoomSetting === 1,
                onClick: () => setZoomSetting(1),
              },
              {
                id: '125',
                label: '125%',
                selected: zoomSetting === 1.25,
                onClick: () => setZoomSetting(1.25),
              },
            ]}
            trigger={
              <button
                type="button"
                className="hidden sm:flex items-center gap-1 h-8 px-2 rounded-md text-xs wick-tabular text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{zoomSetting === 'fit' ? 'Fit' : `${Math.round(zoomSetting * 100)}%`}</span>
              </button>
            }
          />

          {/* Font & Book Size */}
          <WickMenu
            menuWidth={225}
            items={[
              ...EDITOR_FONT_OPTIONS.map((f) => ({
                id: f.id,
                label: f.label,
                selected: effectiveFont === f.id,
                onClick: () => updateWork(work.id, { defaultFont: f.id as EditorFontId }),
              })),
              { type: 'divider' },
              {
                id: 'sz-13',
                label: 'Book Text: 13px (Compact)',
                selected: effectiveFontSize === 13,
                onClick: () => updateWork(work.id, { studioFontSize: 13 }),
              },
              {
                id: 'sz-14',
                label: 'Book Text: 14px (Pocket)',
                selected: effectiveFontSize === 14,
                onClick: () => updateWork(work.id, { studioFontSize: 14 }),
              },
              {
                id: 'sz-16',
                label: 'Book Text: 16px (Standard)',
                selected: effectiveFontSize === 16,
                onClick: () => updateWork(work.id, { studioFontSize: 16 }),
              },
              {
                id: 'sz-18',
                label: 'Book Text: 18px (Large Print)',
                selected: effectiveFontSize === 18,
                onClick: () => updateWork(work.id, { studioFontSize: 18 }),
              },
            ]}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
              >
                <Type className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Typesetting</span>
              </button>
            }
          />

          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              isEditing
                ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                : 'text-[var(--wick-ink)] bg-[var(--wick-elevated)] hover:bg-[var(--color-overlay-hover)] border border-[var(--wick-border-strong)]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Editing Book' : 'Edit Book'}</span>
          </button>

          <WickButton
            label="Export"
            variant="primary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => setShowExport(true)}
          />
        </div>
      </div>

      {/* Full Write-Grade Formatting Bar when Editing inside Book Studio */}
      {isEditing && (
        <div className="shrink-0 border-b border-[var(--wick-border)] bg-[var(--wick-surface)]/95 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <WickMenu
              alignment="start"
              menuWidth={185}
              items={[
                { id: 'p', label: 'Normal Paragraph', onClick: () => execStudioFormat('formatBlock', 'P') },
                { id: 'h1', label: 'Heading 1', onClick: () => execStudioFormat('formatBlock', 'H1') },
                { id: 'h2', label: 'Heading 2', onClick: () => execStudioFormat('formatBlock', 'H2') },
                { id: 'h3', label: 'Heading 3', onClick: () => execStudioFormat('formatBlock', 'H3') },
                { id: 'quote', label: 'Blockquote', onClick: () => execStudioFormat('formatBlock', 'BLOCKQUOTE') },
              ]}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                >
                  <span>{currentBlockLabel}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--wick-muted)]" />
                </button>
              }
            />

            <WickMenu
              alignment="start"
              menuWidth={225}
              items={EDITOR_FONT_OPTIONS.map((f) => ({
                id: f.id,
                label: f.label,
                description: f.preview,
                selected: effectiveFont === f.id,
                onClick: () => updateWork(work.id, { defaultFont: f.id as EditorFontId }),
              }))}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                >
                  <Type className="w-3.5 h-3.5 text-[var(--wick-muted)]" />
                  <span>{activeFontOption.label}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--wick-muted)]" />
                </button>
              }
            />

            <WickMenu
              alignment="start"
              menuWidth={130}
              items={[12, 13, 14, 15, 16, 17, 18, 20].map((sz) => ({
                id: `st-sz-${sz}`,
                label: `${sz} px`,
                selected: effectiveFontSize === sz,
                onClick: () => updateWork(work.id, { studioFontSize: sz }),
              }))}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-xs wick-tabular text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                >
                  <span>{effectiveFontSize}px</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              }
            />

            <WickMenu
              alignment="start"
              menuWidth={220}
              items={[
                {
                  id: 'dir-auto',
                  label: 'Auto Detect Direction',
                  selected: effectiveDir === 'auto',
                  onClick: () => handleSetDirection('auto'),
                },
                {
                  id: 'dir-rtl',
                  label: 'Right-to-Left (العربية)',
                  selected: effectiveDir === 'rtl',
                  onClick: () => handleSetDirection('rtl'),
                },
                {
                  id: 'dir-ltr',
                  label: 'Left-to-Right',
                  selected: effectiveDir === 'ltr',
                  onClick: () => handleSetDirection('ltr'),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className={`flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors ${
                    effectiveDir === 'rtl'
                      ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                      : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{dirLabel}</span>
                </button>
              }
            />

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            <StudioToolbarBtn label="Bold" onClick={() => execStudioFormat('bold')}>
              <Bold className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Italic" onClick={() => execStudioFormat('italic')}>
              <Italic className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Underline" onClick={() => execStudioFormat('underline')}>
              <Underline className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Strikethrough" onClick={() => execStudioFormat('strikeThrough')}>
              <Strikethrough className="w-3.5 h-3.5" />
            </StudioToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            <StudioToolbarBtn label="Align Left" onClick={() => execStudioFormat('justifyLeft')}>
              <AlignLeft className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Align Center" onClick={() => execStudioFormat('justifyCenter')}>
              <AlignCenter className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Align Right" onClick={() => execStudioFormat('justifyRight')}>
              <AlignRight className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Justify" onClick={() => execStudioFormat('justifyFull')}>
              <AlignJustify className="w-3.5 h-3.5" />
            </StudioToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            <StudioToolbarBtn label="Bulleted List" onClick={() => execStudioFormat('insertUnorderedList')}>
              <List className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Numbered List" onClick={() => execStudioFormat('insertOrderedList')}>
              <ListOrdered className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Blockquote" onClick={() => execStudioFormat('formatBlock', 'BLOCKQUOTE')}>
              <Quote className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Insert Scene Break (* * *)" onClick={insertSceneBreak}>
              <Minus className="w-3.5 h-3.5" />
            </StudioToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            <StudioToolbarBtn label="Undo" onClick={() => execStudioFormat('undo')}>
              <Undo2 className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
            <StudioToolbarBtn label="Redo" onClick={() => execStudioFormat('redo')}>
              <Redo2 className="w-3.5 h-3.5" />
            </StudioToolbarBtn>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-[var(--wick-subtle)]">
              {saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Retry needed' : 'Saved'}
            </span>
            {settings.livingLightEnabled && (
              <Flame className="w-3.5 h-3.5 text-[var(--wick-amber)]" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => openWorkTab(work.id, activeChapter.id, activeScene?.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Full Write View</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden DOM Measurer matched 1:1 to physical page content area */}
      <div
        ref={measureRef}
        aria-hidden="true"
        dir={effectiveDir}
        className="wick-prose fixed top-0 left-[-9999px] invisible pointer-events-none"
        style={{
          width: `${paperDim.contentWidthPx}px`,
          fontFamily: getEditorFontStack(effectiveFont),
          fontSize: `${effectiveFontSize}px`,
          lineHeight: effectiveLineHeight,
          letterSpacing: `${effectiveLetterSpacing}em`,
          ['--wick-prose-line-height' as string]: String(effectiveLineHeight),
          ['--wick-prose-letter-spacing' as string]: `${effectiveLetterSpacing}em`,
        }}
      />

      {/* Split Workspace: TOC + Optional Book Studio Editor + Live Separated Pages */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {showToc && (
          <aside className="w-56 shrink-0 border-r border-[var(--wick-border)] bg-[var(--wick-surface)] p-4 overflow-y-auto">
            <div className="text-xs font-medium text-[var(--wick-muted)] mb-3">
              Table of Contents
            </div>
            <div className="space-y-1">
              {work.chapters.map((ch, idx) => {
                const startPage = pages.find((p) => p.chapterAnchorId === ch.id)?.pageNumber;
                return (
                  <a
                    key={ch.id}
                    href={`#studio-ch-${ch.id}`}
                    onClick={() => {
                      setActiveChapterId(ch.id);
                      setActiveSceneId(undefined);
                    }}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                  >
                    <span dir="auto" className="truncate">
                      {isBook ? ch.title : `Section ${idx + 1}`}
                    </span>
                    {startPage && (
                      <span className="wick-tabular text-[11px] text-[var(--wick-muted)] shrink-0">
                        p. {startPage}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </aside>
        )}

        {/* Studio Live Book Editor Pane (edit Title, Subtitle, Author, Chapters, Scenes, Prose) */}
        {isEditing && (
          <section className="w-[45%] min-w-[330px] max-w-[600px] shrink-0 border-r border-[var(--wick-border)] bg-[var(--wick-bg)] flex flex-col min-h-0">
            {/* Book Details & Chapter Selector Header */}
            <div className="shrink-0 px-5 py-3 border-b border-[var(--wick-border)] bg-[var(--wick-surface)]/55 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookDetails((v) => !v)}
                  className="text-[11px] font-medium text-[var(--wick-muted)] hover:text-[var(--wick-ink)] flex items-center gap-1"
                >
                  <span>{showBookDetails ? '▾ Book Title & Author' : '▸ Book Title & Author'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {isBook && (
                    <>
                      <WickTooltip content="Add chapter" placement="below">
                        <button
                          type="button"
                          onClick={handleAddChapter}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Chapter</span>
                        </button>
                      </WickTooltip>
                      <WickTooltip content="Add scene to current chapter" placement="below">
                        <button
                          type="button"
                          onClick={handleAddScene}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Scene</span>
                        </button>
                      </WickTooltip>
                    </>
                  )}
                </div>
              </div>

              {showBookDetails && (
                <div className="space-y-2 pb-1">
                  <input
                    type="text"
                    dir={effectiveDir}
                    value={work.title}
                    onChange={(e) => updateWork(work.id, { title: e.target.value })}
                    placeholder="Book or document title..."
                    className="w-full px-2.5 py-1.5 rounded-md border border-[var(--wick-border)] bg-[var(--wick-surface)] text-sm font-medium text-[var(--wick-ink)] outline-none focus:border-[var(--wick-amber)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      dir={effectiveDir}
                      value={work.subtitle}
                      onChange={(e) => updateWork(work.id, { subtitle: e.target.value })}
                      placeholder="Subtitle..."
                      className="w-full px-2.5 py-1 rounded-md border border-[var(--wick-border)] bg-[var(--wick-surface)] text-xs text-[var(--wick-ink)] outline-none focus:border-[var(--wick-amber)]"
                    />
                    <input
                      type="text"
                      dir={effectiveDir}
                      value={work.author}
                      onChange={(e) => updateWork(work.id, { author: e.target.value })}
                      placeholder="Author name..."
                      className="w-full px-2.5 py-1 rounded-md border border-[var(--wick-border)] bg-[var(--wick-surface)] text-xs text-[var(--wick-ink)] outline-none focus:border-[var(--wick-amber)]"
                    />
                  </div>
                </div>
              )}

              {/* Active Chapter / Scene Bar */}
              <div className="flex items-center gap-2">
                {isBook && (
                  <WickMenu
                    alignment="start"
                    menuWidth={240}
                    items={outlineMenuItems}
                    trigger={
                      <button
                        type="button"
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-[var(--wick-border-strong)] bg-[var(--wick-surface)] text-xs font-medium text-[var(--wick-amber)] hover:bg-[var(--color-overlay-hover)] shrink-0"
                      >
                        <span>{activeScene ? 'Scene' : 'Chapter'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    }
                  />
                )}

                {isBook ? (
                  <input
                    type="text"
                    dir={effectiveDir}
                    value={activeScene ? activeScene.title : activeChapter.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      const nextChapters = work.chapters.map((ch) => {
                        if (ch.id !== activeChapter.id) return ch;
                        if (activeScene) {
                          return {
                            ...ch,
                            scenes: ch.scenes.map((sc) =>
                              sc.id === activeScene.id ? { ...sc, title: val } : sc,
                            ),
                          };
                        }
                        return { ...ch, title: val };
                      });
                      updateWork(work.id, { chapters: nextChapters });
                    }}
                    placeholder={activeScene ? 'Scene title...' : 'Chapter title...'}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm font-medium text-[var(--wick-ink)] placeholder:text-[var(--wick-subtle)]"
                  />
                ) : (
                  <span className="text-xs text-[var(--wick-muted)]">Document Content</span>
                )}

                {isBook && (activeScene || work.chapters.length > 1) && (
                  <button
                    type="button"
                    title={activeScene ? 'Delete current scene' : 'Delete current chapter'}
                    onClick={() =>
                      setDeleteTarget(
                        activeScene
                          ? {
                              kind: 'Scene',
                              chapterId: activeChapter.id,
                              sceneId: activeScene.id,
                              title: activeScene.title || 'Untitled Scene',
                            }
                          : {
                              kind: 'Chapter',
                              chapterId: activeChapter.id,
                              title: activeChapter.title || 'Untitled Chapter',
                            },
                      )
                    }
                    className="p-1.5 rounded text-[var(--wick-muted)] hover:text-red-400 hover:bg-[var(--color-overlay-hover)] shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Editable Prose Surface inside Book Studio */}
            <div
              className="flex-1 overflow-y-auto px-6 py-6"
              onClick={() => studioEditorRef.current?.focus()}
            >
              <div ref={studioStageRef} className="relative">
                {settings.livingLightEnabled && lampRect && (
                  <div
                    aria-hidden="true"
                    className="wick-lamp-wrap wick-no-print"
                    style={{
                      left: `${lampRect.left}px`,
                      top: `${lampRect.top}px`,
                      width: `${lampRect.width}px`,
                      opacity: lampOpacity,
                      mixBlendMode: isLightTheme ? 'multiply' : 'screen',
                    }}
                  >
                    <div
                      className="wick-lamp-cone"
                      style={{
                        background: isLightTheme
                          ? 'linear-gradient(to top, rgba(184, 108, 17, 0.24) 0%, rgba(184, 108, 17, 0.09) 46%, rgba(184, 108, 17, 0) 100%)'
                          : 'linear-gradient(to top, rgba(242, 178, 72, 0.34) 0%, rgba(224, 159, 62, 0.14) 48%, rgba(224, 159, 62, 0) 100%)',
                      }}
                    />
                    <div
                      className="wick-lamp-bar"
                      style={{
                        background: isLightTheme
                          ? 'linear-gradient(90deg, rgba(184, 108, 17, 0.25), #c97714 50%, rgba(184, 108, 17, 0.25))'
                          : 'linear-gradient(90deg, rgba(224, 159, 62, 0.35), #ffd180 50%, rgba(224, 159, 62, 0.35))',
                        boxShadow: isLightTheme
                          ? '0 0 8px rgba(184, 108, 17, 0.55), 0 0 18px rgba(184, 108, 17, 0.25)'
                          : '0 0 10px rgba(245, 185, 85, 0.95), 0 0 24px rgba(224, 159, 62, 0.55)',
                      }}
                    />
                  </div>
                )}

                <div
                  ref={studioEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  dir={effectiveDir}
                  data-placeholder={
                    isRtl ? 'عدّل النص هنا وشاهد الصفحات تتحدّث مباشرة...' : 'Edit text here and watch pages update live...'
                  }
                  onFocus={() => {
                    setIsEditorFocused(true);
                    window.requestAnimationFrame(updateLampFromSelection);
                  }}
                  onBlur={() => setIsEditorFocused(false)}
                  onInput={() => {
                    syncStudioEditorContent();
                    window.requestAnimationFrame(updateLampFromSelection);
                  }}
                  onKeyUp={() => {
                    detectStudioBlock();
                    updateLampFromSelection();
                  }}
                  onMouseUp={() => {
                    detectStudioBlock();
                    updateLampFromSelection();
                  }}
                  className="relative z-10 wick-prose min-h-[52vh]"
                  style={{
                    fontFamily: getEditorFontStack(effectiveFont),
                    fontSize: `${Math.max(15, effectiveFontSize)}px`,
                    lineHeight: effectiveLineHeight,
                    letterSpacing: `${effectiveLetterSpacing}em`,
                    ['--wick-prose-line-height' as string]: String(effectiveLineHeight),
                    ['--wick-prose-letter-spacing' as string]: `${effectiveLetterSpacing}em`,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Separated Universal Pages Desk (Page 1, Page 2, Page 3...) */}
        <div ref={scrollAreaRef} className="flex-1 overflow-auto py-8 px-6">
          <div className="flex flex-col items-center gap-8 min-w-min">
            {pageRows.map((row, rowIdx) => (
              <div
                key={`row-${rowIdx}`}
                className={`flex items-start justify-center gap-6 ${
                  spreadMode === 'spread' && isRtl ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {row.map((page) => {
                  const scaledW = Math.round(paperDim.pageWidthPx * pageScale);
                  const scaledH = Math.round(paperDim.pageHeightPx * pageScale);
                  return (
                    <div
                      key={page.pageNumber}
                      id={page.chapterAnchorId ? `studio-ch-${page.chapterAnchorId}` : undefined}
                      onClick={() => {
                        if (page.primaryChapterId) {
                          setActiveChapterId(page.primaryChapterId);
                          setActiveSceneId(page.primarySceneId);
                        }
                        if (!isEditing) {
                          setIsEditing(true);
                        }
                      }}
                      title="Click page to edit this section"
                      style={{ width: `${scaledW}px`, height: `${scaledH}px` }}
                      className="relative shrink-0 cursor-pointer group"
                    >
                      <article
                        dir={effectiveDir}
                        className="wick-paper-surface rounded-md shadow-2xl overflow-hidden flex flex-col justify-between transition-shadow group-hover:ring-2 group-hover:ring-[var(--wick-amber)]/45"
                        style={{
                          ...paperVars,
                          width: `${paperDim.pageWidthPx}px`,
                          height: `${paperDim.pageHeightPx}px`,
                          paddingLeft: `${paperDim.pagePaddingX}px`,
                          paddingRight: `${paperDim.pagePaddingX}px`,
                          paddingTop: `${Math.max(18, paperDim.pagePaddingTop - 16)}px`,
                          paddingBottom: `${Math.max(18, paperDim.pagePaddingBottom - 20)}px`,
                          transform: `scale(${pageScale})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        {/* Top Running Header */}
                        <div className="h-5 flex items-center justify-between text-[10px] tracking-wide wick-paper-muted opacity-70 select-none shrink-0">
                          <span className="truncate max-w-[70%]">
                            {page.pageNumber === 1 ? '' : page.headerTitle}
                          </span>
                          <span className="wick-tabular">{paperDim.shortLabel}</span>
                        </div>

                        {/* Bounded Physical Page Body */}
                        <div
                          className="wick-prose overflow-hidden flex-1 py-2"
                          style={{
                            maxHeight: `${paperDim.contentHeightPx}px`,
                            fontFamily: getEditorFontStack(effectiveFont),
                            fontSize: `${effectiveFontSize}px`,
                            lineHeight: effectiveLineHeight,
                            letterSpacing: `${effectiveLetterSpacing}em`,
                            ['--wick-prose-line-height' as string]: String(effectiveLineHeight),
                            ['--wick-prose-letter-spacing' as string]: `${effectiveLetterSpacing}em`,
                          }}
                          dangerouslySetInnerHTML={{ __html: page.htmlBlocks.join('') }}
                        />

                        {/* Distinct Bottom Page Number & Boundary */}
                        <div
                          className="h-6 pt-2 border-t flex items-center justify-between text-[11px] wick-paper-muted select-none shrink-0"
                          style={{ borderColor: paper.border }}
                        >
                          <span className="truncate max-w-[65%] opacity-75">{work.title}</span>
                          <span className="wick-tabular font-medium">
                            {isRtl
                              ? `صفحة ${page.pageNumber} من ${pages.length}`
                              : `Page ${page.pageNumber} of ${pages.length}`}
                          </span>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Paper Size Modal */}
      <WickModal
        isOpen={showCustomSizeModal}
        onClose={() => setShowCustomSizeModal(false)}
        title="Custom Paper Size"
        width={420}
        footer={
          <div className="flex justify-end gap-2.5 w-full">
            <WickButton
              label="Cancel"
              variant="ghost"
              onClick={() => setShowCustomSizeModal(false)}
            />
            <WickButton label="Apply Size" variant="primary" onClick={applyCustomPaperSize} />
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--wick-muted)]">
            Set custom page dimensions for Book Studio pages, PDF printing, Word (.docx/.doc), and
            LibreOffice (.odt) exports.
          </p>

          <div>
            <div className="text-xs font-medium text-[var(--wick-muted)] mb-2">Units</div>
            <WickSegmentedControl
              label="Paper measurement unit"
              size="sm"
              value={customUnit}
              onChange={(val) => handleUnitChange(val as 'mm' | 'in')}
            >
              <WickSegment value="mm" label="Millimeters (mm)" />
              <WickSegment value="in" label="Inches (in)" />
            </WickSegmentedControl>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <WickInput
              label={`Width (${customUnit})`}
              value={customWidthInput}
              onChange={setCustomWidthInput}
              placeholder={customUnit === 'in' ? '6.0' : '152'}
            />
            <WickInput
              label={`Height (${customUnit})`}
              value={customHeightInput}
              onChange={setCustomHeightInput}
              placeholder={customUnit === 'in' ? '9.0' : '229'}
            />
          </div>
        </div>
      </WickModal>

      <ExportDialog work={work} isOpen={showExport} onClose={() => setShowExport(false)} />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemType={deleteTarget?.kind ?? 'Chapter'}
        itemName={deleteTarget?.title ?? ''}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'Chapter') {
            handleDeleteChapter(deleteTarget.chapterId);
          } else if (deleteTarget.sceneId) {
            handleDeleteScene(deleteTarget.chapterId, deleteTarget.sceneId);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StudioToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <WickTooltip content={label} placement="below">
      <button
        type="button"
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="p-1.5 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
      >
        {children}
      </button>
    </WickTooltip>
  );
}
