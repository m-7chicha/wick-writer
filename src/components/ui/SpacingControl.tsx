import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { WickSlider } from './WickPrimitives';

export type SpacingScope = 'selection' | 'document';

interface SpacingControlProps {
  lineHeight: number;
  letterSpacing: number;
  selectionLineHeight?: number;
  selectionLetterSpacing?: number;
  hasTextSelection?: boolean;
  canTargetSelection?: boolean;
  onBeforeOpen?: () => { hasSelection: boolean } | void;
  onChangeLineHeight: (val: number, scope: SpacingScope) => void;
  onChangeLetterSpacing: (val: number, scope: SpacingScope) => void;
  onReset?: (scope: SpacingScope) => void;
  compact?: boolean;
}

const LINE_PRESETS = [
  { label: '1.15×', value: 1.15 },
  { label: '1.35×', value: 1.35 },
  { label: '1.55×', value: 1.55 },
  { label: '1.75×', value: 1.75 },
  { label: '2.00×', value: 2.0 },
  { label: '2.40×', value: 2.4 },
];

const LETTER_PRESETS = [
  { label: 'Tight', value: -0.02 },
  { label: 'Normal', value: 0 },
  { label: 'Airy', value: 0.025 },
  { label: 'Wide', value: 0.05 },
  { label: 'Extra', value: 0.08 },
];

export function SpacingControl({
  lineHeight,
  letterSpacing,
  selectionLineHeight,
  selectionLetterSpacing,
  hasTextSelection = false,
  canTargetSelection = false,
  onBeforeOpen,
  onChangeLineHeight,
  onChangeLetterSpacing,
  onReset,
  compact = false,
}: SpacingControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<SpacingScope>('document');
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const effectiveScope: SpacingScope = canTargetSelection ? scope : 'document';
  const activeLineHeight =
    effectiveScope === 'selection' ? (selectionLineHeight ?? lineHeight) : lineHeight;
  const activeLetterSpacing =
    effectiveScope === 'selection' ? (selectionLetterSpacing ?? letterSpacing) : letterSpacing;

  const updatePosition = () => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const width = 308;
    const height = panelRef.current?.offsetHeight || 340;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 10 && rect.top - height - 6 >= 10) {
      top = rect.top - height - 6;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, effectiveScope]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          if (!isOpen && onBeforeOpen) {
            const info = onBeforeOpen();
            if (info && info.hasSelection) {
              setScope('selection');
            } else {
              setScope('document');
            }
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => {
            const next = !v;
            if (next && onBeforeOpen) {
              const info = onBeforeOpen();
              if (info && info.hasSelection) {
                setScope('selection');
              } else if (!hasTextSelection) {
                setScope('document');
              }
            }
            return next;
          });
        }}
        className={`flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
          isOpen
            ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
            : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span>Spacing</span>}
        <span className="wick-tabular text-[11px] opacity-80">{activeLineHeight.toFixed(2)}×</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              width: '308px',
              zIndex: 9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="rounded-xl border border-[var(--wick-border-strong)] bg-[var(--wick-elevated)] shadow-2xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--wick-ink)]">
                Line & Letter Spacing
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (onReset) {
                    onReset(effectiveScope);
                  } else {
                    onChangeLineHeight(1.75, effectiveScope);
                    onChangeLetterSpacing(0, effectiveScope);
                  }
                }}
                className="text-[11px] text-[var(--wick-amber)] hover:underline"
              >
                Reset
              </button>
            </div>

            {canTargetSelection && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[var(--wick-surface)] border border-[var(--wick-border)]">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setScope('selection')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors ${
                    effectiveScope === 'selection'
                      ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                      : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)]'
                  }`}
                >
                  {hasTextSelection ? 'Selected Text' : 'This Paragraph'}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setScope('document')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors ${
                    effectiveScope === 'document'
                      ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)]'
                      : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)]'
                  }`}
                >
                  Full Document
                </button>
              </div>
            )}

            {/* Line Spacing */}
            <div className="space-y-2">
              <WickSlider
                label="Line Spacing"
                min={1.0}
                max={2.6}
                step={0.05}
                formatValue={(v) => `${Number(v).toFixed(2)}×`}
                value={activeLineHeight}
                onChange={(val: number | [number, number]) => {
                  if (typeof val === 'number') {
                    onChangeLineHeight(Number(val.toFixed(2)), effectiveScope);
                  }
                }}
              />
              <div className="flex flex-wrap gap-1">
                {LINE_PRESETS.map((p) => {
                  const active = Math.abs(activeLineHeight - p.value) < 0.03;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChangeLineHeight(p.value, effectiveScope)}
                      className={`px-2 py-1 rounded text-[11px] wick-tabular transition-colors ${
                        active
                          ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)] font-medium'
                          : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--wick-border)]" />

            {/* Letter Spacing */}
            <div className="space-y-2">
              <WickSlider
                label="Letter Spacing"
                min={-0.04}
                max={0.14}
                step={0.005}
                formatValue={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(3)}em`}
                value={activeLetterSpacing}
                onChange={(val: number | [number, number]) => {
                  if (typeof val === 'number') {
                    onChangeLetterSpacing(Number(val.toFixed(3)), effectiveScope);
                  }
                }}
              />
              <div className="flex flex-wrap gap-1">
                {LETTER_PRESETS.map((p) => {
                  const active = Math.abs(activeLetterSpacing - p.value) < 0.004;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChangeLetterSpacing(p.value, effectiveScope)}
                      className={`px-2 py-1 rounded text-[11px] transition-colors ${
                        active
                          ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)] font-medium'
                          : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
