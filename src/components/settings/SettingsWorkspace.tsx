import { useState } from 'react';
import { Check, Copy, Download, Laptop, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useWick } from '../../context/WickContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { EDITOR_FONT_OPTIONS, PAPER_SIZES } from '../../theme/wickTheme';
import type { EditorFontId, EditorMeasure, PaperSizeId, TextDirection, WickThemeId } from '../../types/wick';
import {
  WickButton,
  WickDivider,
  WickInput,
  WickSegment,
  WickSegmentedControl,
  WickSlider,
  WickSwitch,
} from '../ui/WickPrimitives';

export function SettingsWorkspace() {
  const { settings, updateSettings, resetSampleWorkspace } = useWick();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12 lg:px-16">
      <div className="max-w-3xl mx-auto pb-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs text-[var(--wick-amber)] mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </div>
          <h1 className="wick-font-display text-3xl md:text-4xl font-semibold tracking-tight text-[var(--wick-ink)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--wick-muted)] mt-2">
            Tailor WICK’s lighting, typography, and local library defaults. Everything comes ready
            with sensible defaults.
          </p>
        </header>

        {/* Appearance */}
        <section className="space-y-5 py-6">
          <div>
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Appearance
            </h2>
            <p className="text-xs text-[var(--wick-muted)] mt-1">
              Choose the lighting posture that feels easiest on your eyes.
            </p>
          </div>

          <WickSegmentedControl
            label="Theme"
            value={settings.theme}
            onChange={(val) => void updateSettings({ theme: val as WickThemeId })}
          >
            <WickSegment value="obsidian" label="Obsidian Dusk" />
            <WickSegment value="ember" label="Charcoal Ember" />
            <WickSegment value="parchment" label="Warm Parchment" />
          </WickSegmentedControl>
        </section>

        <WickDivider />

        {/* Living Light */}
        <section className="space-y-6 py-8">
          <div>
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Living Light
            </h2>
            <p className="text-xs text-[var(--wick-muted)] mt-1">
              A warm neon lamp bar tracks beneath the words you type or delete, projecting a soft
              45-degree upward glow across your line.
            </p>
          </div>

          <WickSwitch
            label="Enable moving word-lamp bar"
            description="Illuminates the active words as you type without dimming menus or sidebars."
            labelSpacing="spread"
            value={settings.livingLightEnabled}
            onChange={(checked) => void updateSettings({ livingLightEnabled: checked })}
          />

          <WickSlider
            label="Lamp Brightness"
            description="Controls the intensity of the neon filament bar and its 45-degree upward beam."
            min={10}
            max={100}
            step={5}
            value={settings.livingLightIntensity}
            isDisabled={!settings.livingLightEnabled}
            onChange={(val: number | [number, number]) => {
              if (typeof val === 'number') void updateSettings({ livingLightIntensity: val });
            }}
          />

          <WickSwitch
            label="Show subtle word count while writing"
            description="Displays quiet tabular word count and reading time below the page."
            labelSpacing="spread"
            value={settings.showWordCountWhileTyping}
            onChange={(checked) => void updateSettings({ showWordCountWhileTyping: checked })}
          />
        </section>

        <WickDivider />

        {/* Typography & Manuscript Defaults */}
        <section className="space-y-6 py-8">
          <div>
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Editor Defaults
            </h2>
            <p className="text-xs text-[var(--wick-muted)] mt-1">
              Defaults for new documents, Book Studio sheets, and exported manuscripts.
            </p>
          </div>

          <div className="max-w-sm">
            <WickInput
              label="Author Name"
              description="Included on Book Studio title pages and exported manuscripts."
              value={settings.authorName}
              onChange={(val) => void updateSettings({ authorName: val })}
              placeholder="Your name or pen name"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-[var(--wick-ink)] mb-2">Default Typeface</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EDITOR_FONT_OPTIONS.map((font) => {
                const active = settings.editorFont === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => void updateSettings({ editorFont: font.id as EditorFontId })}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-[var(--wick-amber)] bg-[var(--wick-amber-soft)]'
                        : 'border-[var(--wick-border)] bg-[var(--wick-surface)] hover:border-[var(--wick-border-strong)]'
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--wick-ink)]" style={{ fontFamily: font.stack }}>
                      {font.label}
                    </div>
                    <div className="text-xs text-[var(--wick-muted)] mt-0.5">{font.preview}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <WickSlider
            label="Base Text Size"
            min={15}
            max={22}
            step={1}
            formatValue={(v) => `${v}px`}
            value={settings.editorFontSize}
            onChange={(val: number | [number, number]) => {
              if (typeof val === 'number') void updateSettings({ editorFontSize: val });
            }}
          />

          <div>
            <div className="text-sm font-medium text-[var(--wick-ink)] mb-2">Line Measure</div>
            <WickSegmentedControl
              label="Line measure"
              value={settings.editorMeasure}
              onChange={(val) => void updateSettings({ editorMeasure: val as EditorMeasure })}
            >
              <WickSegment value="narrow" label="Focused" />
              <WickSegment value="balanced" label="Balanced" />
              <WickSegment value="wide" label="Wide" />
            </WickSegmentedControl>
          </div>

          <div>
            <div className="text-sm font-medium text-[var(--wick-ink)] mb-1">
              Writing Direction
            </div>
            <p className="text-xs text-[var(--wick-muted)] mb-2">
              Choose Auto for mixed English & Arabic, or lock manuscripts to Right-to-Left (العربية).
            </p>
            <WickSegmentedControl
              label="Default writing direction"
              value={settings.defaultDirection}
              onChange={(val) => void updateSettings({ defaultDirection: val as TextDirection })}
            >
              <WickSegment value="auto" label="Auto Detect" />
              <WickSegment value="ltr" label="Left-to-Right" />
              <WickSegment value="rtl" label="Right-to-Left (العربية)" />
            </WickSegmentedControl>
          </div>

          <div>
            <div className="text-sm font-medium text-[var(--wick-ink)] mb-1">
              Default Paper Size
            </div>
            <p className="text-xs text-[var(--wick-muted)] mb-3">
              Used for Book Studio previews, PDF printing, Word, and LibreOffice exports.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PAPER_SIZES.map((p) => {
                const active = settings.paperSize === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void updateSettings({ paperSize: p.id as PaperSizeId })}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-[var(--wick-amber)] bg-[var(--wick-amber-soft)]'
                        : 'border-[var(--wick-border)] bg-[var(--wick-surface)] hover:border-[var(--wick-border-strong)]'
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--wick-ink)]">{p.label}</div>
                    <div className="text-xs text-[var(--wick-muted)] mt-0.5">{p.description}</div>
                  </button>
                );
              })}
            </div>

            {settings.paperSize === 'custom' && (
              <div className="grid grid-cols-2 gap-3 max-w-sm mt-3">
                <WickInput
                  label="Custom Width (mm)"
                  value={String(settings.customPaperWidthMm)}
                  onChange={(val) => {
                    const num = Number(val);
                    if (!Number.isNaN(num)) {
                      void updateSettings({ customPaperWidthMm: Math.min(500, Math.max(80, num || 210)) });
                    }
                  }}
                />
                <WickInput
                  label="Custom Height (mm)"
                  value={String(settings.customPaperHeightMm)}
                  onChange={(val) => {
                    const num = Number(val);
                    if (!Number.isNaN(num)) {
                      void updateSettings({ customPaperHeightMm: Math.min(650, Math.max(100, num || 297)) });
                    }
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <WickDivider />

        {/* Local Library & Backup */}
        <section className="space-y-4 py-8">
          <div>
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Local Library & Backups
            </h2>
            <p className="text-xs text-[var(--wick-muted)] mt-1">
              Your manuscripts, Mindstorm boards, and sessions are stored locally on disk.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <WickButton
              label="Download Library Backup (.json)"
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                window.location.href = '/api/backup';
              }}
            />
            <WickButton
              label="Restore Sample Workspace"
              variant="ghost"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => void resetSampleWorkspace()}
            />
          </div>
        </section>

        <WickDivider />

        {/* Desktop App & Sharing */}
        <section className="space-y-4 py-8">
          <div>
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Desktop App &amp; Sharing
            </h2>
            <p className="text-xs text-[var(--wick-muted)] mt-1">
              Run WICK as a dedicated desktop window on Linux or Windows, or share access with
              fellow writers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isInstallable && !isInstalled && (
              <WickButton
                label="Install Desktop App"
                variant="primary"
                icon={<Laptop className="w-4 h-4" />}
                onClick={() => void install()}
              />
            )}
            <WickButton
              label={copiedLink ? 'Link Copied' : 'Copy App Link'}
              variant="secondary"
              icon={copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              onClick={() => void handleCopyLink()}
            />
          </div>

          <p className="text-xs text-[var(--wick-muted)] leading-relaxed">
            {isInstalled
              ? 'WICK is currently running in standalone desktop window mode.'
              : isIOS
                ? 'On iPadOS/iOS, tap Share → Add to Home Screen to launch WICK full-screen.'
                : 'Install directly from your browser’s address bar (Install WICK), or build native Linux (.AppImage / .deb) and Windows (.exe) packages from the project folder.'}
          </p>
        </section>
      </div>
    </div>
  );
}
