import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  ChevronDown,
  Download,
  Flame,
  Italic,
  Languages,
  List,
  ListOrdered,
  Minus,
  PanelLeft,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import {
  EDITOR_FONT_OPTIONS,
  getEditorFontStack,
  getMeasureMaxWidth,
} from '../../theme/wickTheme';
import type { ChapterItem, EditorFontId, SceneItem, TextDirection } from '../../types/wick';
import { countWords, getWorkTotalWords } from '../../utils/htmlUtils';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { SpacingControl, type SpacingScope } from '../ui/SpacingControl';
import { WickButton, WickMenu, WickTooltip } from '../ui/WickPrimitives';
import {
  applyLetterSpacingToSelection,
  applyLineHeightToSelection,
  clearSpacingFromElement,
  clearSpacingFromHtml,
  getEditorSelectionState,
} from '../../utils/spacingDom';
import { ExportDialog } from './ExportDialog';

interface WysiwygEditorProps {
  tabId: string;
  workId: string;
  activeChapterId?: string;
  activeSceneId?: string;
}

interface LampRect {
  left: number;
  top: number;
  width: number;
}

export function WysiwygEditor({
  tabId,
  workId,
  activeChapterId,
  activeSceneId,
}: WysiwygEditorProps) {
  const {
    works,
    settings,
    saveState,
    updateWork,
    updateTabChapter,
    updateSettings,
    openStudioTab,
  } = useWick();

  const work = works.find((w) => w.id === workId);
  const [showOutline, setShowOutline] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [fontSizeOverride, setFontSizeOverride] = useState<number | null>(null);
  const [currentBlockLabel, setCurrentBlockLabel] = useState('Paragraph');
  const [lampRect, setLampRect] = useState<LampRect | null>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [spacingSelectionState, setSpacingSelectionState] = useState<{
    hasSelection: boolean;
    lineHeight?: number;
    letterSpacing?: number;
  }>({ hasSelection: false });
  const [deleteOutlineTarget, setDeleteOutlineTarget] = useState<{
    kind: 'Chapter' | 'Scene';
    chapterId: string;
    sceneId?: string;
    title: string;
  } | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const sheetStageRef = useRef<HTMLDivElement | null>(null);
  const lastLoadedKeyRef = useRef<string>('');
  const savedSpacingRangeRef = useRef<Range | null>(null);

  const activeChapter = useMemo(() => {
    if (!work) return undefined;
    return work.chapters.find((c) => c.id === activeChapterId) ?? work.chapters[0];
  }, [work, activeChapterId]);

  const activeScene = useMemo(() => {
    if (!activeChapter || !activeSceneId) return undefined;
    return activeChapter.scenes.find((s) => s.id === activeSceneId);
  }, [activeChapter, activeSceneId]);

  const currentHtml = activeScene
    ? activeScene.contentHtml
    : activeChapter?.contentHtml ?? '<p><br></p>';
  const activeKey = `${workId}:${activeChapter?.id ?? ''}:${activeScene?.id ?? ''}`;
  const effectiveFontSize = fontSizeOverride ?? settings.editorFontSize;

  // Hydrate contentEditable only when switching document/chapter/scene
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (lastLoadedKeyRef.current !== activeKey) {
      el.innerHTML = currentHtml || '<p><br></p>';
      lastLoadedKeyRef.current = activeKey;
      setLampRect(null);
    }
  }, [activeKey, currentHtml]);

  const updateLampFromSelection = useCallback(() => {
    if (!settings.livingLightEnabled) {
      setLampRect(null);
      return;
    }
    const stage = sheetStageRef.current;
    const editor = editorRef.current;
    if (!stage || !editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      return;
    }

    const caretRange = sel.getRangeAt(0).cloneRange();
    caretRange.collapse(true);

    let rect = caretRange.getBoundingClientRect();
    const anchor = sel.anchorNode;

    // Measure the active word around the caret so the neon bar hugs & moves with words typed/deleted
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
          if (wordRect.width > 0 && wordRect.height > 0) {
            rect = wordRect;
          }
        } catch {
          // ignore invalid text range offsets
        }
      }
    }

    // Fallback for empty lines or collapsed boundaries
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
    const barWidth = Math.max(46, Math.min(160, rect.width + 18));
    const centerX = rect.left - stageRect.left + rect.width / 2;
    const maxLeft = Math.max(0, stageRect.width - barWidth);
    const left = Math.max(0, Math.min(maxLeft, centerX - barWidth / 2));
    const top = rect.bottom - stageRect.top + 2;

    setLampRect({ left, top, width: barWidth });
  }, [settings.livingLightEnabled, effectiveFontSize]);

  useEffect(() => {
    if (!settings.livingLightEnabled) {
      setLampRect(null);
      return;
    }
    const onSelectionChange = () => {
      if (isEditorFocused) {
        updateLampFromSelection();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [settings.livingLightEnabled, isEditorFocused, updateLampFromSelection]);

  if (!work || !activeChapter) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--wick-muted)]">
        Document not found.
      </div>
    );
  }

  const isBook = work.kind === 'book';
  const effectiveFont = work.defaultFont || settings.editorFont;
  const effectiveDir: TextDirection = work.direction ?? settings.defaultDirection ?? 'auto';
  const effectiveLineHeight =
    work.lineHeight ?? (effectiveDir === 'rtl' ? 1.92 : settings.defaultLineHeight ?? 1.75);
  const effectiveLetterSpacing = work.letterSpacing ?? settings.defaultLetterSpacing ?? 0;
  const totalWords = getWorkTotalWords(work.chapters);
  const currentUnitWords = countWords(currentHtml);
  const readMinutes = Math.max(1, Math.round(totalWords / 230));
  const lampOpacity = settings.livingLightEnabled && isEditorFocused && lampRect
    ? Math.max(0.25, settings.livingLightIntensity / 100)
    : 0;
  const isLightTheme = settings.theme === 'parchment';

  const syncEditorContent = () => {
    const el = editorRef.current;
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
    const info = getEditorSelectionState(editorRef.current);
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
    const el = editorRef.current;
    if (el) {
      clearSpacingFromElement(el, mode);
    }
    const now = new Date().toISOString();
    return work.chapters.map((ch) => {
      const isCurrentChapter = ch.id === activeChapter.id && !activeScene;
      const chHtml = isCurrentChapter && el ? el.innerHTML || '<p><br></p>' : clearSpacingFromHtml(ch.contentHtml, mode);
      return {
        ...ch,
        contentHtml: chHtml,
        wordCount: countWords(chHtml),
        updatedAt: now,
        scenes: ch.scenes.map((sc) => {
          const isCurrentScene = ch.id === activeChapter.id && activeScene?.id === sc.id;
          const scHtml = isCurrentScene && el ? el.innerHTML || '<p><br></p>' : clearSpacingFromHtml(sc.contentHtml, mode);
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
    const el = editorRef.current;
    if (scope === 'selection' && el) {
      const nextRange = applyLineHeightToSelection(el, savedSpacingRangeRef.current, val);
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
        setSpacingSelectionState((prev) => ({ ...prev, lineHeight: val }));
        syncEditorContent();
        window.requestAnimationFrame(updateLampFromSelection);
        return;
      }
    }
    const cleanedChapters = clearWorkInlineSpacing('lineHeight');
    updateWork(work.id, { lineHeight: val, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const handleSpacingLetterSpacing = (val: number, scope: SpacingScope) => {
    const el = editorRef.current;
    if (scope === 'selection' && el) {
      const nextRange = applyLetterSpacingToSelection(el, savedSpacingRangeRef.current, val);
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
        setSpacingSelectionState((prev) => ({ ...prev, letterSpacing: val }));
        syncEditorContent();
        window.requestAnimationFrame(updateLampFromSelection);
        return;
      }
    }
    const cleanedChapters = clearWorkInlineSpacing('letterSpacing');
    updateWork(work.id, { letterSpacing: val, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const handleSpacingReset = (scope: SpacingScope) => {
    const el = editorRef.current;
    if (scope === 'selection' && el) {
      let nextRange = applyLineHeightToSelection(el, savedSpacingRangeRef.current, effectiveLineHeight);
      nextRange = applyLetterSpacingToSelection(el, nextRange ?? savedSpacingRangeRef.current, effectiveLetterSpacing);
      if (nextRange) {
        savedSpacingRangeRef.current = nextRange;
      }
      setSpacingSelectionState((prev) => ({
        ...prev,
        lineHeight: undefined,
        letterSpacing: undefined,
      }));
      syncEditorContent();
      window.requestAnimationFrame(updateLampFromSelection);
      return;
    }
    const cleanedChapters = clearWorkInlineSpacing('both');
    updateWork(work.id, { lineHeight: 1.75, letterSpacing: 0, chapters: cleanedChapters });
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const execFormat = (command: string, value?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
    detectSelectionBlock();
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const insertSceneBreak = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(
      'insertHTML',
      false,
      '<p style="text-align: center;">* * *</p><p><br></p>',
    );
    syncEditorContent();
    window.requestAnimationFrame(updateLampFromSelection);
  };

  const detectSelectionBlock = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
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
    const patch: Partial<typeof work> = { direction: dir };
    // Auto-pair classic Arabic literary font if switching an English default font into RTL for comfort
    if (dir === 'rtl' && work.defaultFont === 'lora') {
      patch.defaultFont = 'amiri';
    }
    updateWork(work.id, patch);
    window.requestAnimationFrame(updateLampFromSelection);
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
    updateTabChapter(tabId, newCh.id);
  };

  const handleAddScene = (chapterId: string) => {
    const now = new Date().toISOString();
    const newSceneId = `sc-${Date.now().toString(36)}`;
    const nextChapters = work.chapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
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
    updateTabChapter(tabId, chapterId, newSceneId);
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (work.chapters.length <= 1) return;
    const nextChapters = work.chapters.filter((ch) => ch.id !== chapterId);
    updateWork(work.id, { chapters: nextChapters });
    if (activeChapter.id === chapterId) {
      updateTabChapter(tabId, nextChapters[0].id);
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
      updateTabChapter(tabId, chapterId, undefined);
    }
  };

  const activeFontOption =
    EDITOR_FONT_OPTIONS.find((f) => f.id === effectiveFont) ?? EDITOR_FONT_OPTIONS[0];

  const dirLabel =
    effectiveDir === 'rtl' ? 'RTL · العربية' : effectiveDir === 'ltr' ? 'LTR' : 'Auto';

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Book Chapters & Scenes Drawer */}
      {isBook && showOutline && (
        <aside className="wick-no-print w-64 shrink-0 border-r border-[var(--wick-border)] bg-[var(--wick-surface)] flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wick-border)]">
            <span className="text-xs font-medium text-[var(--wick-muted)]">Chapters & Scenes</span>
            <WickTooltip content="New chapter" placement="below">
              <button
                type="button"
                aria-label="Add chapter"
                onClick={handleAddChapter}
                className="p-1.5 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </WickTooltip>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {work.chapters.map((ch) => {
              const isChSelected = ch.id === activeChapter.id && !activeScene;
              return (
                <div key={ch.id} className="space-y-0.5">
                  <div
                    onClick={() => updateTabChapter(tabId, ch.id, undefined)}
                    className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                      isChSelected
                        ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)] font-medium'
                        : 'text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                    }`}
                  >
                    <span className="truncate">{ch.title}</span>
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Add scene"
                        onClick={() => handleAddScene(ch.id)}
                        className="p-1 rounded hover:bg-[var(--color-overlay-pressed)] text-[var(--wick-muted)] hover:text-[var(--wick-ink)]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {work.chapters.length > 1 && (
                        <button
                          type="button"
                          title="Delete chapter"
                          onClick={() =>
                            setDeleteOutlineTarget({
                              kind: 'Chapter',
                              chapterId: ch.id,
                              title: ch.title || 'Untitled Chapter',
                            })
                          }
                          className="p-1 rounded hover:bg-[var(--color-overlay-pressed)] text-[var(--wick-muted)] hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {ch.scenes.map((sc) => {
                    const isScSelected = ch.id === activeChapter.id && activeScene?.id === sc.id;
                    return (
                      <div
                        key={sc.id}
                        onClick={() => updateTabChapter(tabId, ch.id, sc.id)}
                        className={`group flex items-center justify-between gap-2 pl-6 pr-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          isScSelected
                            ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)] font-medium'
                            : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                        }`}
                      >
                        <span className="truncate">{sc.title}</span>
                        <button
                          type="button"
                          title="Delete scene"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteOutlineTarget({
                              kind: 'Scene',
                              chapterId: ch.id,
                              sceneId: sc.id,
                              title: sc.title || 'Untitled Scene',
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-overlay-pressed)] text-[var(--wick-muted)] hover:text-red-400 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Main Writing Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Contextual Word-Style Formatting & Action Bar (never dims) */}
        <div className="wick-no-print shrink-0 border-b border-[var(--wick-border)] bg-[var(--wick-surface)]/95 backdrop-blur-sm px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
          {/* Left Formatting Group */}
          <div className="flex flex-wrap items-center gap-1">
            {isBook && (
              <WickTooltip content={showOutline ? 'Hide chapters' : 'Show chapters'} placement="below">
                <button
                  type="button"
                  aria-label="Toggle chapters"
                  onClick={() => setShowOutline((v) => !v)}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    showOutline
                      ? 'text-[var(--wick-amber)] bg-[var(--wick-amber-soft)]'
                      : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                  }`}
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </WickTooltip>
            )}

            {/* Block Style Picker */}
            <WickMenu
              alignment="start"
              menuWidth={185}
              items={[
                { id: 'p', label: 'Normal Paragraph', onClick: () => execFormat('formatBlock', 'P') },
                { id: 'h1', label: 'Heading 1', onClick: () => execFormat('formatBlock', 'H1') },
                { id: 'h2', label: 'Heading 2', onClick: () => execFormat('formatBlock', 'H2') },
                { id: 'h3', label: 'Heading 3', onClick: () => execFormat('formatBlock', 'H3') },
                { id: 'quote', label: 'Blockquote', onClick: () => execFormat('formatBlock', 'BLOCKQUOTE') },
              ]}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors whitespace-nowrap"
                >
                  <span>{currentBlockLabel}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--wick-muted)]" />
                </button>
              }
            />

            {/* Font Family Picker */}
            <WickMenu
              alignment="start"
              menuWidth={230}
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
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors whitespace-nowrap"
                >
                  <Type className="w-3.5 h-3.5 text-[var(--wick-muted)]" />
                  <span>{activeFontOption.label}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--wick-muted)]" />
                </button>
              }
            />

            {/* Font Size Picker */}
            <WickMenu
              alignment="start"
              menuWidth={140}
              items={[14, 15, 16, 17, 18, 20, 22].map((sz) => ({
                id: `sz-${sz}`,
                label: `${sz} px`,
                selected: effectiveFontSize === sz,
                onClick: () => setFontSizeOverride(sz),
              }))}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-xs wick-tabular text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                >
                  <span>{effectiveFontSize}</span>
                  <ChevronDown className="w-3 h-3" />
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
              canTargetSelection={Boolean(editorRef.current)}
              onBeforeOpen={handlePrepareSpacing}
              onChangeLineHeight={handleSpacingLineHeight}
              onChangeLetterSpacing={handleSpacingLetterSpacing}
              onReset={handleSpacingReset}
            />

            {/* Text Direction (LTR / RTL Arabic / Auto) */}
            <WickMenu
              alignment="start"
              menuWidth={230}
              items={[
                {
                  id: 'dir-auto',
                  label: 'Auto Detect Direction',
                  description: 'Adapts per paragraph (Arabic & English)',
                  selected: effectiveDir === 'auto',
                  onClick: () => handleSetDirection('auto'),
                },
                {
                  id: 'dir-rtl',
                  label: 'Right-to-Left (العربية)',
                  description: 'Full Arabic manuscript & Book Studio flow',
                  selected: effectiveDir === 'rtl',
                  onClick: () => handleSetDirection('rtl'),
                },
                {
                  id: 'dir-ltr',
                  label: 'Left-to-Right (English)',
                  description: 'Standard Western manuscript alignment',
                  selected: effectiveDir === 'ltr',
                  onClick: () => handleSetDirection('ltr'),
                },
              ]}
              trigger={
                <button
                  type="button"
                  className={`flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
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

            {/* Inline Formatting */}
            <ToolbarBtn label="Bold (Ctrl+B)" onClick={() => execFormat('bold')}>
              <Bold className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Italic (Ctrl+I)" onClick={() => execFormat('italic')}>
              <Italic className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Underline (Ctrl+U)" onClick={() => execFormat('underline')}>
              <Underline className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Strikethrough" onClick={() => execFormat('strikeThrough')}>
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            {/* Alignment */}
            <ToolbarBtn label="Align Left" onClick={() => execFormat('justifyLeft')}>
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Align Center" onClick={() => execFormat('justifyCenter')}>
              <AlignCenter className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Align Right" onClick={() => execFormat('justifyRight')}>
              <AlignRight className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Justify" onClick={() => execFormat('justifyFull')}>
              <AlignJustify className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            {/* Lists & Quotes & Scene Break */}
            <ToolbarBtn label="Bulleted List" onClick={() => execFormat('insertUnorderedList')}>
              <List className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Numbered List" onClick={() => execFormat('insertOrderedList')}>
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Blockquote" onClick={() => execFormat('formatBlock', 'BLOCKQUOTE')}>
              <Quote className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Insert Scene Break (* * *)" onClick={insertSceneBreak}>
              <Minus className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <span className="h-4 w-px bg-[var(--wick-border)] mx-1" aria-hidden="true" />

            <ToolbarBtn label="Undo" onClick={() => execFormat('undo')}>
              <Undo2 className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Redo" onClick={() => execFormat('redo')}>
              <Redo2 className="w-3.5 h-3.5" />
            </ToolbarBtn>
          </div>

          {/* Right Document Actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--wick-subtle)] mr-1 hidden sm:inline">
              {saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Retry needed' : 'Saved'}
            </span>
            <WickTooltip
              content={
                settings.livingLightEnabled
                  ? 'Moving neon word-lamp illuminates the words you type'
                  : 'Enable Living Light word-lamp'
              }
              placement="below"
            >
              <button
                type="button"
                onClick={() =>
                  void updateSettings({ livingLightEnabled: !settings.livingLightEnabled })
                }
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors whitespace-nowrap ${
                  settings.livingLightEnabled
                    ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                    : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Living Light</span>
              </button>
            </WickTooltip>

            <WickButton
              label="Book Studio"
              variant="ghost"
              size="sm"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              onClick={() => openStudioTab(work.id)}
            />
            <WickButton
              label="Export"
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => setShowExport(true)}
            />
          </div>
        </div>

        {/* Scrollable Editorial Manuscript Sheet */}
        <div
          className="flex-1 overflow-y-auto px-6 py-10 md:px-12"
          onClick={() => editorRef.current?.focus()}
        >
          <div
            ref={sheetStageRef}
            className="relative mx-auto transition-all duration-200"
            style={{ maxWidth: getMeasureMaxWidth(settings.editorMeasure) }}
          >
            {/* Living Light Moving Neon Lamp Bar + 45-Degree Upward Cone */}
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
                {/* 45-degree upward lamp light cone */}
                <div
                  className="wick-lamp-cone"
                  style={{
                    background: isLightTheme
                      ? 'linear-gradient(to top, rgba(184, 108, 17, 0.24) 0%, rgba(184, 108, 17, 0.09) 46%, rgba(184, 108, 17, 0) 100%)'
                      : 'linear-gradient(to top, rgba(242, 178, 72, 0.34) 0%, rgba(224, 159, 62, 0.14) 48%, rgba(224, 159, 62, 0) 100%)',
                  }}
                />
                {/* Neon filament bar directly beneath active words */}
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

            {/* Document or Book Title */}
            <input
              type="text"
              dir={effectiveDir}
              value={work.title}
              onChange={(e) => updateWork(work.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder={effectiveDir === 'rtl' ? 'عنوان المخطوطة' : 'Untitled Manuscript'}
              className="relative z-10 w-full bg-transparent border-0 outline-none wick-font-display text-3xl md:text-4xl font-semibold tracking-tight text-[var(--wick-ink)] placeholder:text-[var(--wick-subtle)] mb-2"
            />

            {/* Book Chapter / Scene Heading */}
            {isBook && (
              <div className="relative z-10 flex items-center gap-3 mb-6 pb-4 border-b border-[var(--wick-border)]">
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
                  onClick={(e) => e.stopPropagation()}
                  placeholder={activeScene ? 'Scene title...' : 'Chapter title...'}
                  className="flex-1 bg-transparent border-0 outline-none text-base font-medium text-[var(--wick-amber)] placeholder:text-[var(--wick-subtle)]"
                />
              </div>
            )}

            {!isBook && (
              <input
                type="text"
                dir={effectiveDir}
                value={work.subtitle}
                onChange={(e) => updateWork(work.id, { subtitle: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder={
                  effectiveDir === 'rtl' ? 'أضف عنواناً فرعياً أو ملاحظة...' : 'Add a quiet subtitle or note...'
                }
                className="relative z-10 w-full bg-transparent border-0 outline-none text-sm text-[var(--wick-muted)] placeholder:text-[var(--wick-subtle)] mb-8"
              />
            )}

            {/* True WYSIWYG Rich Text Surface (LTR, RTL Arabic, or Auto) */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              dir={effectiveDir}
              data-placeholder={effectiveDir === 'rtl' ? 'ابدأ الكتابة بحرية...' : 'Begin writing freely...'}
              onFocus={() => {
                setIsEditorFocused(true);
                window.requestAnimationFrame(updateLampFromSelection);
              }}
              onBlur={() => {
                setIsEditorFocused(false);
              }}
              onInput={() => {
                syncEditorContent();
                window.requestAnimationFrame(updateLampFromSelection);
              }}
              onKeyUp={() => {
                detectSelectionBlock();
                updateLampFromSelection();
              }}
              onMouseUp={() => {
                detectSelectionBlock();
                updateLampFromSelection();
              }}
              className="relative z-10 wick-prose min-h-[58vh]"
              style={{
                fontFamily: getEditorFontStack(effectiveFont),
                fontSize: `${effectiveFontSize}px`,
                lineHeight: effectiveLineHeight,
                letterSpacing: `${effectiveLetterSpacing}em`,
                ['--wick-prose-line-height' as string]: String(effectiveLineHeight),
                ['--wick-prose-letter-spacing' as string]: `${effectiveLetterSpacing}em`,
              }}
            />

            {/* Quiet Word Count & Reading Time Footer */}
            {settings.showWordCountWhileTyping && (
              <div className="relative z-10 mt-14 pt-4 border-t border-[var(--wick-border)] flex items-center justify-between text-xs text-[var(--wick-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="wick-tabular">
                    {currentUnitWords.toLocaleString()} words{isBook ? ' here' : ''}
                  </span>
                  {isBook && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="wick-tabular">
                        {totalWords.toLocaleString()} total in book
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="wick-tabular">{readMinutes} min read</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ExportDialog work={work} isOpen={showExport} onClose={() => setShowExport(false)} />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteOutlineTarget)}
        itemType={deleteOutlineTarget?.kind ?? 'Chapter'}
        itemName={deleteOutlineTarget?.title ?? ''}
        onConfirm={() => {
          if (!deleteOutlineTarget) return;
          if (deleteOutlineTarget.kind === 'Chapter') {
            handleDeleteChapter(deleteOutlineTarget.chapterId);
          } else if (deleteOutlineTarget.sceneId) {
            handleDeleteScene(deleteOutlineTarget.chapterId, deleteOutlineTarget.sceneId);
          }
        }}
        onClose={() => setDeleteOutlineTarget(null)}
      />
    </div>
  );
}

function ToolbarBtn({
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
        onMouseDown={(e) => {
          // Keep editor selection intact when clicking formatting buttons
          e.preventDefault();
        }}
        onClick={onClick}
        className="p-1.5 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
      >
        {children}
      </button>
    </WickTooltip>
  );
}
