export type WorkKind = 'document' | 'book';

export type TextDirection = 'ltr' | 'rtl' | 'auto';

export type EditorFontId =
  | 'lora'
  | 'source-serif'
  | 'cormorant'
  | 'jakarta'
  | 'mono'
  | 'amiri'
  | 'plex-arabic';

export type WickThemeId = 'obsidian' | 'ember' | 'parchment';

export type EditorMeasure = 'narrow' | 'balanced' | 'wide';

export type ExportFormat = 'pdf' | 'docx' | 'doc' | 'odt' | 'rtf' | 'md' | 'html' | 'txt';

export type PaperSizeId =
  | 'a4'
  | 'a5'
  | 'b5'
  | 'letter'
  | 'legal'
  | 'executive'
  | 'trade'
  | 'digest'
  | 'royal'
  | 'custom';

export interface SceneItem {
  id: string;
  title: string;
  contentHtml: string;
  wordCount: number;
  updatedAt: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  contentHtml: string;
  wordCount: number;
  scenes: SceneItem[];
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  kind: WorkKind;
  defaultFont: EditorFontId;
  direction?: TextDirection;
  lineHeight?: number;
  letterSpacing?: number;
  studioFontSize?: number;
  chapters: ChapterItem[];
  createdAt: string;
  updatedAt: string;
}

export type MindstormCardTone = 'neutral' | 'amber' | 'violet';

export interface MindstormNode {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
  role: string;
  tone: MindstormCardTone;
}

export interface MindstormEdge {
  id: string;
  fromId: string;
  toId: string;
}

export interface MindstormBoard {
  id: string;
  title: string;
  linkedWorkId?: string;
  nodes: MindstormNode[];
  edges: MindstormEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface JourneySession {
  id: string;
  date: string; // YYYY-MM-DD
  workId: string;
  workTitle: string;
  wordsAdded: number;
  minutes: number;
}

export interface WickSettings {
  theme: WickThemeId;
  livingLightEnabled: boolean;
  livingLightIntensity: number; // 0 - 100
  editorFont: EditorFontId;
  editorFontSize: number; // px (15 - 22)
  editorMeasure: EditorMeasure;
  defaultDirection: TextDirection;
  defaultLineHeight: number; // e.g. 1.75
  defaultLetterSpacing: number; // em, e.g. 0
  paperSize: PaperSizeId;
  customPaperWidthMm: number;
  customPaperHeightMm: number;
  showWordCountWhileTyping: boolean;
  autosaveMs: number;
  authorName: string;
}

export interface WickWorkspaceData {
  works: WorkItem[];
  mindstormBoards: MindstormBoard[];
  journeySessions: JourneySession[];
  settings: WickSettings;
}

export type DestinationId = 'write' | 'mindstorm' | 'studio' | 'journey' | 'settings';

export type WorkspaceTabKind = 'library' | 'work' | 'mindstorm' | 'studio' | 'journey' | 'settings';

export interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  title: string;
  resourceId?: string; // workId or boardId
  activeChapterId?: string;
  activeSceneId?: string;
  pinned?: boolean;
}
