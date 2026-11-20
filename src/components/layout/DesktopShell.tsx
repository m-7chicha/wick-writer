import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Compass,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  SlidersHorizontal,
  Waypoints,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import type { DestinationId } from '../../types/wick';
import { WickTooltip } from '../ui/WickPrimitives';
import { WorkspaceTabs } from './WorkspaceTabs';

interface NavItemConfig {
  id: DestinationId;
  label: string;
  shortcut: string;
  icon: (active: boolean) => ReactNode;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'write',
    label: 'Write',
    shortcut: 'Ctrl+1',
    icon: () => <PenLine className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'mindstorm',
    label: 'Mindstorm',
    shortcut: 'Ctrl+2',
    icon: () => <Waypoints className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'studio',
    label: 'Book Studio',
    shortcut: 'Ctrl+3',
    icon: () => <BookOpen className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'journey',
    label: 'Your Journey',
    shortcut: 'Ctrl+4',
    icon: () => <Compass className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortcut: 'Ctrl+5',
    icon: () => <SlidersHorizontal className="w-4 h-4 shrink-0" />,
  },
];

export function DesktopShell({ children }: { children: ReactNode }) {
  const { activeDestination, openDestination } = useWick();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[var(--wick-bg)] text-[var(--wick-ink)]">
      {/* Left Desktop Navigation Rail */}
      <aside
        className={`wick-no-print flex flex-col justify-between shrink-0 border-r border-[var(--wick-border)] bg-[var(--wick-surface)] transition-all duration-200 select-none ${
          collapsed ? 'w-[60px]' : 'w-[208px]'
        }`}
      >
        <div>
          {/* Custom WICK App Icon Brand Header */}
          <div
            className={`h-12 flex items-center border-b border-[var(--wick-border)] ${
              collapsed ? 'justify-center px-2' : 'justify-start px-3.5'
            }`}
          >
            <img
              src="/wick-icon.png"
              alt="WICK"
              title="WICK"
              className="w-8 h-8 rounded-lg object-contain shrink-0"
            />
          </div>

          {/* 5 Primary Destinations */}
          <nav aria-label="Primary workspaces" className="p-2 flex flex-col gap-1 mt-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeDestination === item.id;
              const button = (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDestination(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                    collapsed ? 'justify-center px-0' : ''
                  } ${
                    isActive
                      ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                      : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                  }`}
                >
                  {item.icon(isActive)}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );

              if (collapsed) {
                return (
                  <WickTooltip
                    key={item.id}
                    content={`${item.label} (${item.shortcut})`}
                    placement="end"
                  >
                    {button}
                  </WickTooltip>
                );
              }

              return button;
            })}
          </nav>
        </div>

        {/* Desktop Install + Quiet Rail Collapse */}
        <div className="p-2 border-t border-[var(--wick-border)] space-y-1">
          {!isInstalled && (isInstallable || isIOS) && (
            <WickTooltip
              content="Install desktop app"
              placement={collapsed ? 'end' : 'above'}
            >
              <button
                type="button"
                onClick={() => {
                  if (isInstallable) {
                    void install();
                  }
                }}
                aria-label="Install desktop app"
                className={`w-full flex items-center gap-3 h-9 px-3 rounded-lg text-xs text-[var(--wick-amber)] bg-[var(--wick-amber-soft)] hover:brightness-110 transition-all whitespace-nowrap ${
                  collapsed ? 'justify-center px-0' : ''
                }`}
              >
                <Download className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{isIOS ? 'Add to Home Screen' : 'Install App'}</span>}
              </button>
            </WickTooltip>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-3 h-9 px-3 rounded-lg text-xs text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors whitespace-nowrap ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Collapse rail</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area + Workspace Tabs */}
      <main className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[var(--wick-bg)]">
        <WorkspaceTabs />
        <div className="relative flex-1 min-h-0 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
