import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@astryxdesign/core';
import type {
  DestinationId,
  ExportFormat,
  JourneySession,
  MindstormBoard,
  MindstormNode,
  PaperSizeId,
  WickSettings,
  WickWorkspaceData,
  WorkItem,
  WorkKind,
  WorkspaceTab,
} from '../types/wick';
import { arrayBufferToBase64, countWords, getWorkTotalWords } from '../utils/htmlUtils';

interface PaperOverride {
  paperSize: PaperSizeId;
  customPaperWidthMm?: number;
  customPaperHeightMm?: number;
}

interface PrintTarget {
  work: WorkItem;
  chapterId?: string;
  paperSize: PaperSizeId;
  customPaperWidthMm: number;
  customPaperHeightMm: number;
}

interface WickContextValue {
  isLoading: boolean;
  works: WorkItem[];
  mindstormBoards: MindstormBoard[];
  journeySessions: JourneySession[];
  settings: WickSettings;
  tabs: WorkspaceTab[];
  activeTabId: string;
  activeTab: WorkspaceTab;
  activeDestination: DestinationId;
  saveState: 'saved' | 'saving' | 'error';
  isLivingLightActive: boolean;
  printTarget: PrintTarget | null;

  setActiveTabId: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  openDestination: (dest: DestinationId) => void;
  openWorkTab: (workId: string, chapterId?: string, sceneId?: string) => void;
  updateTabChapter: (tabId: string, chapterId: string, sceneId?: string) => void;
  openMindstormTab: (boardId?: string) => void;
  openStudioTab: (workId?: string) => void;

  createWork: (kind: WorkKind, title?: string, initialHtml?: string) => Promise<WorkItem | null>;
  updateWork: (workId: string, patch: Partial<WorkItem>) => void;
  deleteWork: (workId: string) => Promise<void>;
  importFile: (file: File, kind?: WorkKind) => Promise<WorkItem | null>;
  exportWorkFile: (
    workId: string,
    format: ExportFormat,
    chapterId?: string,
    paperOverride?: PaperOverride,
  ) => Promise<void>;

  createBoard: (title?: string, linkedWorkId?: string) => Promise<MindstormBoard | null>;
  updateBoard: (boardId: string, patch: Partial<MindstormBoard>) => void;
  deleteBoard: (boardId: string) => Promise<void>;
  sendNodesToWrite: (nodes: MindstormNode[], targetWorkId?: string) => Promise<void>;

  updateSettings: (patch: Partial<WickSettings>) => Promise<void>;
  resetSampleWorkspace: () => Promise<void>;

  notifyTypingActivity: () => void;
  wakeChrome: () => void;
}

const DEFAULT_SETTINGS: WickSettings = {
  theme: 'obsidian',
  livingLightEnabled: true,
  livingLightIntensity: 68,
  editorFont: 'lora',
  editorFontSize: 18,
  editorMeasure: 'balanced',
  defaultDirection: 'auto',
  defaultLineHeight: 1.75,
  defaultLetterSpacing: 0,
  paperSize: 'a4',
  customPaperWidthMm: 210,
  customPaperHeightMm: 297,
  showWordCountWhileTyping: true,
  autosaveMs: 900,
  authorName: 'Writer',
};

const LIBRARY_TAB: WorkspaceTab = {
  id: 'tab-library',
  kind: 'library',
  title: 'Files',
  pinned: true,
};

const WickContext = createContext<WickContextValue | null>(null);

export function WickProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [mindstormBoards, setMindstormBoards] = useState<MindstormBoard[]>([]);
  const [journeySessions, setJourneySessions] = useState<JourneySession[]>([]);
  const [settings, setSettings] = useState<WickSettings>(DEFAULT_SETTINGS);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([LIBRARY_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>(LIBRARY_TAB.id);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isLivingLightActive, setIsLivingLightActive] = useState(false);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);

  const workSaveTimers = useRef<Map<string, number>>(new Map());
  const boardSaveTimers = useRef<Map<string, number>>(new Map());
  const baselineWordsRef = useRef<Map<string, number>>(new Map());
  const pendingWordsDeltaRef = useRef<Map<string, number>>(new Map());
  const journeyFlushTimer = useRef<number | null>(null);

  // Sync HTML theme attributes cleanly
  useEffect(() => {
    const root = document.documentElement;
    const isLight = settings.theme === 'parchment';
    root.setAttribute('data-wick-theme', settings.theme);
    root.setAttribute('data-theme', isLight ? 'light' : 'dark');
    if (isLight) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [settings.theme]);

  // Load initial workspace
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/workspace');
        if (!res.ok) throw new Error('Failed to load workspace');
        const data = (await res.json()) as WickWorkspaceData;
        if (!active) return;
        setWorks(data.works);
        setMindstormBoards(data.mindstormBoards);
        setJourneySessions(data.journeySessions);
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
        data.works.forEach((w) => {
          baselineWordsRef.current.set(w.id, getWorkTotalWords(w.chapters));
        });
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Could not open local workspace',
          type: 'error',
        });
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? LIBRARY_TAB,
    [tabs, activeTabId],
  );

  const activeDestination: DestinationId = useMemo(() => {
    if (activeTab.kind === 'mindstorm') return 'mindstorm';
    if (activeTab.kind === 'studio') return 'studio';
    if (activeTab.kind === 'journey') return 'journey';
    if (activeTab.kind === 'settings') return 'settings';
    return 'write';
  }, [activeTab.kind]);

  const wakeChrome = useCallback(() => {
    setIsLivingLightActive(false);
  }, []);

  const notifyTypingActivity = useCallback(() => {
    if (settings.livingLightEnabled) {
      setIsLivingLightActive(true);
    }
  }, [settings.livingLightEnabled]);

  useEffect(() => {
    if (!settings.livingLightEnabled) {
      setIsLivingLightActive(false);
    }
  }, [settings.livingLightEnabled]);

  // Wake chrome on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLivingLightActive(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openWorkTab = useCallback(
    (workId: string, chapterId?: string, sceneId?: string) => {
      const work = works.find((w) => w.id === workId);
      if (!work) return;
      const resolvedChapterId = chapterId ?? work.chapters[0]?.id;
      setTabs((prev) => {
        const existing = prev.find((t) => t.kind === 'work' && t.resourceId === workId);
        if (existing) {
          setActiveTabId(existing.id);
          return prev.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  title: work.title,
                  activeChapterId: chapterId ?? t.activeChapterId ?? resolvedChapterId,
                  activeSceneId: sceneId ?? (chapterId ? undefined : t.activeSceneId),
                }
              : t,
          );
        }
        const newTab: WorkspaceTab = {
          id: `tab-work-${workId}`,
          kind: 'work',
          title: work.title,
          resourceId: workId,
          activeChapterId: resolvedChapterId,
          activeSceneId: sceneId,
        };
        setActiveTabId(newTab.id);
        return [...prev, newTab];
      });
      setIsLivingLightActive(false);
    },
    [works],
  );

  const updateTabChapter = useCallback((tabId: string, chapterId: string, sceneId?: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, activeChapterId: chapterId, activeSceneId: sceneId } : t,
      ),
    );
  }, []);

  const openMindstormTab = useCallback(
    (boardId?: string) => {
      const targetBoard =
        (boardId ? mindstormBoards.find((b) => b.id === boardId) : mindstormBoards[0]) ?? null;
      const resolvedId = targetBoard?.id ?? 'default';
      const title = targetBoard?.title ?? 'Mindstorm';

      setTabs((prev) => {
        const existing = prev.find(
          (t) => t.kind === 'mindstorm' && (boardId ? t.resourceId === boardId : true),
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const newTab: WorkspaceTab = {
          id: `tab-mindstorm-${resolvedId}`,
          kind: 'mindstorm',
          title,
          resourceId: targetBoard?.id,
        };
        setActiveTabId(newTab.id);
        return [...prev, newTab];
      });
      setIsLivingLightActive(false);
    },
    [mindstormBoards],
  );

  const openStudioTab = useCallback(
    (workId?: string) => {
      const fallbackWork =
        (workId ? works.find((w) => w.id === workId) : undefined) ??
        (activeTab.kind === 'work' && activeTab.resourceId
          ? works.find((w) => w.id === activeTab.resourceId)
          : undefined) ??
        works[0];
      const targetId = fallbackWork?.id;
      const label = fallbackWork ? `${fallbackWork.title} · Preview` : 'Book Studio';

      setTabs((prev) => {
        const existing = prev.find(
          (t) => t.kind === 'studio' && (targetId ? t.resourceId === targetId : true),
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const newTab: WorkspaceTab = {
          id: `tab-studio-${targetId ?? 'default'}`,
          kind: 'studio',
          title: label,
          resourceId: targetId,
        };
        setActiveTabId(newTab.id);
        return [...prev, newTab];
      });
      setIsLivingLightActive(false);
    },
    [works, activeTab],
  );

  const openDestination = useCallback(
    (dest: DestinationId) => {
      setIsLivingLightActive(false);
      if (dest === 'write') {
        const existingWorkTab = tabs.find((t) => t.kind === 'work');
        if (activeTab.kind === 'work') {
          setActiveTabId(LIBRARY_TAB.id);
        } else if (existingWorkTab) {
          setActiveTabId(existingWorkTab.id);
        } else {
          setActiveTabId(LIBRARY_TAB.id);
        }
        return;
      }
      if (dest === 'mindstorm') {
        openMindstormTab();
        return;
      }
      if (dest === 'studio') {
        openStudioTab();
        return;
      }
      if (dest === 'journey') {
        setTabs((prev) => {
          const existing = prev.find((t) => t.kind === 'journey');
          if (existing) {
            setActiveTabId(existing.id);
            return prev;
          }
          const newTab: WorkspaceTab = {
            id: 'tab-journey',
            kind: 'journey',
            title: 'Your Journey',
          };
          setActiveTabId(newTab.id);
          return [...prev, newTab];
        });
        return;
      }
      if (dest === 'settings') {
        setTabs((prev) => {
          const existing = prev.find((t) => t.kind === 'settings');
          if (existing) {
            setActiveTabId(existing.id);
            return prev;
          }
          const newTab: WorkspaceTab = {
            id: 'tab-settings',
            kind: 'settings',
            title: 'Settings',
          };
          setActiveTabId(newTab.id);
          return [...prev, newTab];
        });
      }
    },
    [tabs, activeTab.kind, openMindstormTab, openStudioTab],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      if (tabId === LIBRARY_TAB.id) return;
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const fallback = next[Math.max(0, idx - 1)] ?? LIBRARY_TAB;
          setActiveTabId(fallback.id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  const flushJourneyWords = useCallback(() => {
    if (journeyFlushTimer.current) {
      window.clearTimeout(journeyFlushTimer.current);
    }
    journeyFlushTimer.current = window.setTimeout(async () => {
      const entries = Array.from(pendingWordsDeltaRef.current.entries());
      pendingWordsDeltaRef.current.clear();
      for (const [workId, delta] of entries) {
        if (delta <= 0) continue;
        const work = works.find((w) => w.id === workId);
        try {
          const res = await fetch('/api/journey/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workId,
              workTitle: work?.title ?? 'Untitled',
              wordsAdded: delta,
              minutes: Math.max(1, Math.round(delta / 25)),
            }),
          });
          if (res.ok) {
            const updatedSessions = (await res.json()) as JourneySession[];
            setJourneySessions(updatedSessions);
          }
        } catch {
          // silent background retry tolerance
        }
      }
    }, 3000);
  }, [works]);

  const createWork = useCallback(
    async (kind: WorkKind, title?: string, initialHtml?: string) => {
      try {
        const res = await fetch('/api/works', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, title, initialHtml }),
        });
        if (!res.ok) throw new Error('Failed to create');
        const created = (await res.json()) as WorkItem;
        setWorks((prev) => [created, ...prev]);
        baselineWordsRef.current.set(created.id, getWorkTotalWords(created.chapters));
        const newTab: WorkspaceTab = {
          id: `tab-work-${created.id}`,
          kind: 'work',
          title: created.title,
          resourceId: created.id,
          activeChapterId: created.chapters[0]?.id,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return created;
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Could not create file',
          type: 'error',
        });
        return null;
      }
    },
    [toast],
  );

  const updateWork = useCallback(
    (workId: string, patch: Partial<WorkItem>) => {
      setSaveState('saving');
      setWorks((prev) =>
        prev.map((w) => {
          if (w.id !== workId) return w;
          const nextChapters = (patch.chapters ?? w.chapters).map((ch) => ({
            ...ch,
            wordCount: countWords(ch.contentHtml),
            scenes: ch.scenes.map((sc) => ({
              ...sc,
              wordCount: countWords(sc.contentHtml),
            })),
          }));
          const updated: WorkItem = {
            ...w,
            ...patch,
            chapters: nextChapters,
            updatedAt: new Date().toISOString(),
          };
          const newTotal = getWorkTotalWords(updated.chapters);
          const prevTotal = baselineWordsRef.current.get(workId) ?? newTotal;
          if (newTotal > prevTotal) {
            const existingDelta = pendingWordsDeltaRef.current.get(workId) ?? 0;
            pendingWordsDeltaRef.current.set(workId, existingDelta + (newTotal - prevTotal));
            baselineWordsRef.current.set(workId, newTotal);
            flushJourneyWords();
          } else {
            baselineWordsRef.current.set(workId, newTotal);
          }
          return updated;
        }),
      );

      // Sync tab title if title changed
      if (typeof patch.title === 'string') {
        const cleanTitle = patch.title.trim() || 'Untitled';
        setTabs((prev) =>
          prev.map((t) => {
            if (t.kind === 'work' && t.resourceId === workId) {
              return { ...t, title: cleanTitle };
            }
            if (t.kind === 'studio' && t.resourceId === workId) {
              return { ...t, title: `${cleanTitle} · Preview` };
            }
            return t;
          }),
        );
      }

      const existingTimer = workSaveTimers.current.get(workId);
      if (existingTimer) window.clearTimeout(existingTimer);

      const timer = window.setTimeout(async () => {
        try {
          const res = await fetch(`/api/works/${workId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error('Save failed');
          setSaveState('saved');
        } catch {
          setSaveState('error');
        }
      }, settings.autosaveMs);
      workSaveTimers.current.set(workId, timer);
    },
    [settings.autosaveMs, flushJourneyWords],
  );

  const deleteWork = useCallback(
    async (workId: string) => {
      try {
        const res = await fetch(`/api/works/${workId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        setWorks((prev) => prev.filter((w) => w.id !== workId));
        setTabs((prev) => prev.filter((t) => t.resourceId !== workId));
        if (activeTab.resourceId === workId) {
          setActiveTabId(LIBRARY_TAB.id);
        }
        toast({ body: 'Removed from library', type: 'info' });
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Could not remove file',
          type: 'error',
        });
      }
    },
    [activeTab.resourceId, toast],
  );

  const importFile = useCallback(
    async (file: File, kind: WorkKind = 'document') => {
      try {
        const buffer = await file.arrayBuffer();
        const base64Content = arrayBufferToBase64(buffer);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Content,
            kind,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Import failed');
        const created = payload as WorkItem;
        setWorks((prev) => [created, ...prev]);
        baselineWordsRef.current.set(created.id, getWorkTotalWords(created.chapters));
        const newTab: WorkspaceTab = {
          id: `tab-work-${created.id}`,
          kind: 'work',
          title: created.title,
          resourceId: created.id,
          activeChapterId: created.chapters[0]?.id,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        toast({ body: `Imported "${created.title}"`, type: 'info' });
        return created;
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Import could not read file',
          type: 'error',
        });
        return null;
      }
    },
    [toast],
  );

  const exportWorkFile = useCallback(
    async (
      workId: string,
      format: ExportFormat,
      chapterId?: string,
      paperOverride?: PaperOverride,
    ) => {
      const work = works.find((w) => w.id === workId);
      if (!work) return;

      const resolvedPaperSize = paperOverride?.paperSize ?? settings.paperSize;
      const resolvedW = paperOverride?.customPaperWidthMm ?? settings.customPaperWidthMm;
      const resolvedH = paperOverride?.customPaperHeightMm ?? settings.customPaperHeightMm;

      if (format === 'pdf') {
        setPrintTarget({
          work,
          chapterId,
          paperSize: resolvedPaperSize,
          customPaperWidthMm: resolvedW,
          customPaperHeightMm: resolvedH,
        });
        window.setTimeout(() => {
          window.print();
        }, 120);
        return;
      }

      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workId,
            format,
            chapterId,
            paperSize: resolvedPaperSize,
            customPaperWidthMm: resolvedW,
            customPaperHeightMm: resolvedH,
          }),
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const disposition = res.headers.get('Content-Disposition') || '';
        const nameMatch = disposition.match(/filename="([^"]+)"/);
        const filename = nameMatch?.[1] ?? `${work.title}.${format}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ body: `Exported ${filename}`, type: 'info' });
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Export failed',
          type: 'error',
        });
      }
    },
    [works, settings.paperSize, settings.customPaperWidthMm, settings.customPaperHeightMm, toast],
  );

  const createBoard = useCallback(
    async (title?: string, linkedWorkId?: string) => {
      try {
        const res = await fetch('/api/mindstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, linkedWorkId }),
        });
        if (!res.ok) throw new Error('Failed to create board');
        const created = (await res.json()) as MindstormBoard;
        setMindstormBoards((prev) => [created, ...prev]);
        const newTab: WorkspaceTab = {
          id: `tab-mindstorm-${created.id}`,
          kind: 'mindstorm',
          title: created.title,
          resourceId: created.id,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return created;
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Could not create board',
          type: 'error',
        });
        return null;
      }
    },
    [toast],
  );

  const updateBoard = useCallback((boardId: string, patch: Partial<MindstormBoard>) => {
    setMindstormBoards((prev) =>
      prev.map((b) =>
        b.id === boardId ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b,
      ),
    );
    if (typeof patch.title === 'string') {
      const cleanTitle = patch.title.trim() || 'Untitled Board';
      setTabs((prev) =>
        prev.map((t) =>
          t.kind === 'mindstorm' && t.resourceId === boardId ? { ...t, title: cleanTitle } : t,
        ),
      );
    }

    const existingTimer = boardSaveTimers.current.get(boardId);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(async () => {
      try {
        await fetch(`/api/mindstorm/${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch {
        // silent
      }
    }, 550);
    boardSaveTimers.current.set(boardId, timer);
  }, []);

  const deleteBoard = useCallback(
    async (boardId: string) => {
      try {
        const res = await fetch(`/api/mindstorm/${boardId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        setMindstormBoards((prev) => prev.filter((b) => b.id !== boardId));
        setTabs((prev) => prev.filter((t) => !(t.kind === 'mindstorm' && t.resourceId === boardId)));
        if (activeTab.kind === 'mindstorm' && activeTab.resourceId === boardId) {
          setActiveTabId(LIBRARY_TAB.id);
        }
      } catch (err) {
        toast({
          body: err instanceof Error ? err.message : 'Could not delete board',
          type: 'error',
        });
      }
    },
    [activeTab, toast],
  );

  const sendNodesToWrite = useCallback(
    async (nodes: MindstormNode[], targetWorkId?: string) => {
      if (nodes.length === 0) return;
      const htmlBlocks = nodes
        .map((n) => {
          const titleLine = n.title.trim() ? `<h2>${n.title.trim()}</h2>` : '';
          const bodyLine = n.body.trim()
            ? `<p>${n.body.trim().replace(/\n/g, '</p><p>')}</p>`
            : '';
          return `${titleLine}${bodyLine}`;
        })
        .join('\n');

      if (!targetWorkId) {
        const firstTitle = nodes[0].title.trim() || 'Mindstorm Draft';
        await createWork('document', firstTitle, htmlBlocks || '<p><br></p>');
        toast({ body: 'Opened ideas in Write', type: 'info' });
        return;
      }

      const work = works.find((w) => w.id === targetWorkId);
      if (!work) return;

      if (work.kind === 'book') {
        const newChapterId = `ch-${Date.now().toString(36)}`;
        const newChapter = {
          id: newChapterId,
          title: nodes[0].title.trim() || `Chapter ${work.chapters.length + 1}`,
          contentHtml: htmlBlocks || '<p><br></p>',
          wordCount: countWords(htmlBlocks),
          scenes: [],
          updatedAt: new Date().toISOString(),
        };
        updateWork(work.id, { chapters: [...work.chapters, newChapter] });
        openWorkTab(work.id, newChapterId);
        toast({ body: `Added chapter to "${work.title}"`, type: 'info' });
      } else {
        const ch = work.chapters[0];
        if (!ch) return;
        const merged = `${ch.contentHtml}\n${htmlBlocks}`;
        updateWork(work.id, {
          chapters: [{ ...ch, contentHtml: merged, updatedAt: new Date().toISOString() }],
        });
        openWorkTab(work.id, ch.id);
        toast({ body: `Appended to "${work.title}"`, type: 'info' });
      }
    },
    [createWork, works, updateWork, openWorkTab, toast],
  );

  const updateSettings = useCallback(
    async (patch: Partial<WickSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch {
        toast({ body: 'Could not save preferences', type: 'error' });
      }
    },
    [toast],
  );

  const resetSampleWorkspace = useCallback(async () => {
    try {
      const res = await fetch('/api/reset-sample', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const data = (await res.json()) as WickWorkspaceData;
      setWorks(data.works);
      setMindstormBoards(data.mindstormBoards);
      setJourneySessions(data.journeySessions);
      setSettings(data.settings);
      setTabs([LIBRARY_TAB]);
      setActiveTabId(LIBRARY_TAB.id);
      toast({ body: 'Sample sanctuary restored', type: 'info' });
    } catch (err) {
      toast({
        body: err instanceof Error ? err.message : 'Reset failed',
        type: 'error',
      });
    }
  }, [toast]);

  // Global desktop keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === '1') {
        e.preventDefault();
        openDestination('write');
      } else if (e.key === '2') {
        e.preventDefault();
        openDestination('mindstorm');
      } else if (e.key === '3') {
        e.preventDefault();
        openDestination('studio');
      } else if (e.key === '4') {
        e.preventDefault();
        openDestination('journey');
      } else if (e.key === '5') {
        e.preventDefault();
        openDestination('settings');
      } else if (e.key.toLowerCase() === 'w' && activeTabId !== LIBRARY_TAB.id) {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openDestination, closeTab, activeTabId]);

  const value: WickContextValue = {
    isLoading,
    works,
    mindstormBoards,
    journeySessions,
    settings,
    tabs,
    activeTabId,
    activeTab,
    activeDestination,
    saveState,
    isLivingLightActive,
    printTarget,
    setActiveTabId,
    closeTab,
    openDestination,
    openWorkTab,
    updateTabChapter,
    openMindstormTab,
    openStudioTab,
    createWork,
    updateWork,
    deleteWork,
    importFile,
    exportWorkFile,
    createBoard,
    updateBoard,
    deleteBoard,
    sendNodesToWrite,
    updateSettings,
    resetSampleWorkspace,
    notifyTypingActivity,
    wakeChrome,
  };

  return <WickContext.Provider value={value}>{children}</WickContext.Provider>;
}

export function useWick(): WickContextValue {
  const ctx = useContext(WickContext);
  if (!ctx) throw new Error('useWick must be used inside WickProvider');
  return ctx;
}
