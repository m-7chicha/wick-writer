import {
  BookOpen,
  Compass,
  FileText,
  FolderOpen,
  PenLine,
  Plus,
  SlidersHorizontal,
  Waypoints,
  X,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import type { WorkspaceTab } from '../../types/wick';
import { WickMenu, WickTooltip } from '../ui/WickPrimitives';

function TabKindIcon({ tab }: { tab: WorkspaceTab }) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  if (tab.kind === 'library') return <FolderOpen className={cls} />;
  if (tab.kind === 'mindstorm') return <Waypoints className={`${cls} text-[var(--wick-violet)]`} />;
  if (tab.kind === 'studio') return <BookOpen className={cls} />;
  if (tab.kind === 'journey') return <Compass className={cls} />;
  if (tab.kind === 'settings') return <SlidersHorizontal className={cls} />;
  return <FileText className={cls} />;
}

export function WorkspaceTabs() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    createWork,
    createBoard,
  } = useWick();

  return (
    <div className="wick-no-print h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-[var(--wick-border)] bg-[var(--wick-surface)]">
      <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onMouseDown={(e) => {
                if (e.button === 1 && !tab.pinned) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              className={`group relative flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium cursor-pointer select-none transition-colors duration-150 shrink-0 max-w-[210px] ${
                isActive
                  ? 'bg-[var(--wick-elevated)] text-[var(--wick-ink)] shadow-[inset_0_-2px_0_var(--wick-amber)]'
                  : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
              }`}
              onClick={() => setActiveTabId(tab.id)}
              title={tab.title}
            >
              <TabKindIcon tab={tab} />
              <span className="truncate whitespace-nowrap">{tab.title}</span>
              {!tab.pinned && (
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`ml-0.5 p-0.5 rounded hover:bg-[var(--color-overlay-pressed)] transition-opacity duration-150 ${
                    isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <WickMenu
          alignment="start"
          placement="below"
          menuWidth={210}
          items={[
            {
              id: 'new-doc',
              label: 'New Blank Document',
              icon: <PenLine className="w-4 h-4" />,
              onClick: () => void createWork('document'),
            },
            {
              id: 'new-book',
              label: 'New Multi-Chapter Book',
              icon: <BookOpen className="w-4 h-4" />,
              onClick: () => void createWork('book'),
            },
            { type: 'divider' },
            {
              id: 'new-board',
              label: 'New Mindstorm Board',
              icon: <Waypoints className="w-4 h-4" />,
              onClick: () => void createBoard(),
            },
          ]}
          trigger={
            <WickTooltip content="Open new tab" placement="below">
              <button
                type="button"
                aria-label="Open new tab"
                className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors shrink-0 ml-1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </WickTooltip>
          }
        />
      </div>
    </div>
  );
}
