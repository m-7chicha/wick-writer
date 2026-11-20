import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LayerProvider, Theme } from '@astryxdesign/core';
import { DesktopShell } from './components/layout/DesktopShell';
import { JourneyWorkspace } from './components/journey/JourneyWorkspace';
import { MindstormWorkspace } from './components/mindstorm/MindstormWorkspace';
import { SettingsWorkspace } from './components/settings/SettingsWorkspace';
import { BookStudioWorkspace } from './components/studio/BookStudioWorkspace';
import { PrintSheet } from './components/studio/PrintSheet';
import { LibraryShelf } from './components/write/LibraryShelf';
import { WysiwygEditor } from './components/write/WysiwygEditor';
import { WickProvider, useWick } from './context/WickContext';
import { getAstryxMode, wickAstryxTheme } from './theme/wickTheme';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class WickErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected workspace error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WICK workspace error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-screen flex items-center justify-center bg-[var(--wick-bg)] text-[var(--wick-ink)] p-6">
          <div className="max-w-md w-full rounded-2xl border border-[var(--wick-border-strong)] bg-[var(--wick-surface)] p-6 text-center space-y-4">
            <img
              src="/wick-icon.png"
              alt="WICK"
              className="w-10 h-10 rounded-lg mx-auto object-contain"
            />
            <h1 className="wick-font-display text-xl font-semibold">WICK paused unexpectedly</h1>
            <p className="text-xs text-[var(--wick-muted)] leading-relaxed">
              Your manuscripts remain safely saved on disk. Reload the window to resume writing.
            </p>
            {this.state.message && (
              <p className="text-[11px] font-mono text-[var(--wick-subtle)] break-words">
                {this.state.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium bg-[var(--wick-amber)] text-[var(--wick-on-amber)] hover:brightness-110 transition-all"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function WickAppContent() {
  const { isLoading, activeTab, settings } = useWick();

  return (
    <Theme theme={wickAstryxTheme} mode={getAstryxMode(settings.theme)}>
      <div className="wick-no-print h-[100dvh] w-screen overflow-hidden">
        <DesktopShell>
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-[var(--wick-muted)]">
              Opening your sanctuary...
            </div>
          ) : activeTab.kind === 'library' ? (
            <LibraryShelf />
          ) : activeTab.kind === 'work' && activeTab.resourceId ? (
            <WysiwygEditor
              key={activeTab.id}
              tabId={activeTab.id}
              workId={activeTab.resourceId}
              activeChapterId={activeTab.activeChapterId}
              activeSceneId={activeTab.activeSceneId}
            />
          ) : activeTab.kind === 'mindstorm' ? (
            <MindstormWorkspace key={activeTab.id} boardId={activeTab.resourceId} />
          ) : activeTab.kind === 'studio' ? (
            <BookStudioWorkspace key={activeTab.id} workId={activeTab.resourceId} />
          ) : activeTab.kind === 'journey' ? (
            <JourneyWorkspace />
          ) : activeTab.kind === 'settings' ? (
            <SettingsWorkspace />
          ) : (
            <LibraryShelf />
          )}
        </DesktopShell>
      </div>
      <PrintSheet />
    </Theme>
  );
}

export default function App() {
  return (
    <WickErrorBoundary>
      <Theme theme={wickAstryxTheme} mode="dark">
        <LayerProvider>
          <WickProvider>
            <WickAppContent />
          </WickProvider>
        </LayerProvider>
      </Theme>
    </WickErrorBoundary>
  );
}
