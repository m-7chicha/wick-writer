import { useMemo, useRef, useState, type DragEvent } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  MoreHorizontal,
  PenLine,
  Search,
  Trash2,
  Upload,
  Waypoints,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import type { WorkItem } from '../../types/wick';
import { formatRelativeDate, getWorkTotalWords } from '../../utils/htmlUtils';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import {
  WickButton,
  WickDivider,
  WickEmptyState,
  WickInput,
  WickMenu,
  WickSegment,
  WickSegmentedControl,
} from '../ui/WickPrimitives';
import { ExportDialog } from './ExportDialog';

const ACCEPTED_IMPORTS = '.txt,.md,.markdown,.html,.htm,.rtf,.doc,.docx,.odt';

export function LibraryShelf() {
  const {
    works,
    mindstormBoards,
    createWork,
    deleteWork,
    importFile,
    openWorkTab,
    openStudioTab,
    openMindstormTab,
    createBoard,
  } = useWick();

  const [filter, setFilter] = useState<'all' | 'document' | 'book'>('all');
  const [query, setQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [exportWorkTarget, setExportWorkTarget] = useState<WorkItem | null>(null);
  const [deleteWorkTarget, setDeleteWorkTarget] = useState<WorkItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredWorks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return works.filter((w) => {
      if (filter !== 'all' && w.kind !== filter) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.subtitle.toLowerCase().includes(q) ||
        w.author.toLowerCase().includes(q)
      );
    });
  }, [works, filter, query]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      await importFile(file, 'document');
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFilesSelected(e.dataTransfer.files);
  };

  return (
    <div
      className="h-full overflow-y-auto px-6 py-10 md:px-12 lg:px-16"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="max-w-5xl mx-auto">
        {/* Dropzone subtle veil when dragging files */}
        {isDragging && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none">
            <div className="px-8 py-6 rounded-xl border border-[var(--wick-amber)] bg-[var(--wick-elevated)] text-center">
              <Upload className="w-7 h-7 mx-auto mb-2 text-[var(--wick-amber)]" />
              <p className="text-base font-medium text-[var(--wick-ink)]">
                Drop a file to open in WICK
              </p>
              <p className="text-xs text-[var(--wick-muted)] mt-1">
                Supports .docx, .doc, .odt, .rtf, .md, .html, and .txt
              </p>
            </div>
          </div>
        )}

        {/* Editorial Launch Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="wick-font-display text-3xl md:text-4xl font-semibold tracking-tight text-[var(--wick-ink)] text-balance">
              Your Writing Desk
            </h1>
            <p className="text-sm text-[var(--wick-muted)] mt-2 max-w-xl">
              Open an existing manuscript, start a blank page, or bring in a document from Word,
              LibreOffice, or plain text.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <WickButton
              label="New Document"
              variant="primary"
              icon={<PenLine className="w-4 h-4" />}
              onClick={() => void createWork('document')}
            />
            <WickButton
              label="New Book"
              variant="secondary"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => void createWork('book')}
            />
            <WickButton
              label="Import File"
              variant="ghost"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMPORTS}
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Filter & Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <WickSegmentedControl
            label="Filter files"
            value={filter}
            onChange={(val) => setFilter(val as 'all' | 'document' | 'book')}
          >
            <WickSegment value="all" label="All Files" />
            <WickSegment value="document" label="Documents" />
            <WickSegment value="book" label="Books" />
          </WickSegmentedControl>

          <div className="w-full sm:w-64">
            <WickInput
              label="Search documents"
              isLabelHidden
              placeholder="Find by title..."
              value={query}
              onChange={setQuery}
              startIcon={<Search className="w-4 h-4" />}
              hasClear
            />
          </div>
        </div>

        <WickDivider />

        {/* Recent Documents & Books List */}
        <section className="mt-4">
          {filteredWorks.length === 0 ? (
            <div className="py-12">
              <WickEmptyState
                icon={<FileText className="w-8 h-8 text-[var(--wick-muted)]" />}
                title="No matching manuscripts"
                description="Start a blank document or import a .docx, .odt, .doc, or .txt file."
                actions={
                  <WickButton
                    label="Create Blank Document"
                    variant="primary"
                    onClick={() => void createWork('document')}
                  />
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--wick-border)]">
              {filteredWorks.map((work) => {
                const words = getWorkTotalWords(work.chapters);
                const isBook = work.kind === 'book';
                return (
                  <div
                    key={work.id}
                    onClick={() => openWorkTab(work.id)}
                    className="group flex items-center justify-between gap-4 py-4 px-3 -mx-3 rounded-lg cursor-pointer hover:bg-[var(--color-overlay-hover)] transition-colors duration-150"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="mt-0.5 p-2 rounded-lg bg-[var(--wick-surface)] border border-[var(--wick-border)] text-[var(--wick-amber)] shrink-0">
                        {isBook ? (
                          <BookOpen className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2
                          dir="auto"
                          className="text-[15px] font-medium text-[var(--wick-ink)] truncate"
                        >
                          {work.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--wick-muted)] mt-1">
                          <span>{isBook ? 'Book' : 'Document'}</span>
                          {isBook && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="wick-tabular">
                                {work.chapters.length}{' '}
                                {work.chapters.length === 1 ? 'chapter' : 'chapters'}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="wick-tabular">{words.toLocaleString()} words</span>
                          <span aria-hidden="true">·</span>
                          <span>Edited {formatRelativeDate(work.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <WickButton
                        label="Open"
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onClick={() => openWorkTab(work.id)}
                      />
                      <WickMenu
                        menuWidth={200}
                        items={[
                          {
                            id: 'open',
                            label: 'Open in Tab',
                            icon: <PenLine className="w-4 h-4" />,
                            onClick: () => openWorkTab(work.id),
                          },
                          {
                            id: 'studio',
                            label: 'Preview in Book Studio',
                            icon: <BookOpen className="w-4 h-4" />,
                            onClick: () => openStudioTab(work.id),
                          },
                          {
                            id: 'export',
                            label: 'Export (PDF, DOCX, ODT...)',
                            icon: <Download className="w-4 h-4" />,
                            onClick: () => setExportWorkTarget(work),
                          },
                          { type: 'divider' },
                          {
                            id: 'delete',
                            label: 'Delete File',
                            variant: 'destructive',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => setDeleteWorkTarget(work),
                          },
                        ]}
                        trigger={
                          <button
                            type="button"
                            aria-label={`Actions for ${work.title}`}
                            className="p-2 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quiet Mindstorm Boards Shortcut Row */}
        <section className="mt-14 pt-8 border-t border-[var(--wick-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Mindstorm Boards
            </h2>
            <WickButton
              label="New Board"
              variant="ghost"
              size="sm"
              icon={<Waypoints className="w-3.5 h-3.5" />}
              onClick={() => void createBoard()}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mindstormBoards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => openMindstormTab(board.id)}
                className="text-left p-4 rounded-xl border border-[var(--wick-border)] bg-[var(--wick-surface)] hover:border-[var(--wick-violet)] transition-colors duration-150"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Waypoints className="w-4 h-4 text-[var(--wick-violet)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--wick-ink)] truncate">
                    {board.title}
                  </span>
                </div>
                <p className="text-xs text-[var(--wick-muted)]">
                  <span className="wick-tabular">{board.nodes.length}</span> ideas
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span>Edited {formatRelativeDate(board.updatedAt)}</span>
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <ExportDialog
        work={exportWorkTarget}
        isOpen={Boolean(exportWorkTarget)}
        onClose={() => setExportWorkTarget(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteWorkTarget)}
        itemType={deleteWorkTarget?.kind === 'book' ? 'Book' : 'Document'}
        itemName={deleteWorkTarget?.title ?? ''}
        warningDetail={
          deleteWorkTarget?.kind === 'book'
            ? `Includes ${deleteWorkTarget.chapters.length} chapters.`
            : undefined
        }
        onConfirm={() => {
          if (deleteWorkTarget) return deleteWork(deleteWorkTarget.id);
        }}
        onClose={() => setDeleteWorkTarget(null)}
      />
    </div>
  );
}
