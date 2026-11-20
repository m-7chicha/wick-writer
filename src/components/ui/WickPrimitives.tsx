import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Dialog,
  DialogHeader,
  Divider,
  EmptyState,
  Layout,
  LayoutContent,
  LayoutFooter,
  SegmentedControl,
  SegmentedControlItem,
  Slider,
  Switch,
  TextInput,
  Tooltip,
  type ButtonProps,
} from '@astryxdesign/core';

export {
  Divider as WickDivider,
  EmptyState as WickEmptyState,
  SegmentedControl as WickSegmentedControl,
  SegmentedControlItem as WickSegment,
  Slider as WickSlider,
  Switch as WickSwitch,
  TextInput as WickInput,
  Tooltip as WickTooltip,
};

export function WickButton({ className = '', ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      className={`whitespace-nowrap shrink-0 transition-transform duration-150 active:scale-[0.98] ${className}`}
    />
  );
}

interface WickModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: number | string;
  children: ReactNode;
  footer?: ReactNode;
}

export function WickModal({
  isOpen,
  onClose,
  title,
  width = 480,
  children,
  footer,
}: WickModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={width}
      purpose="info"
    >
      <Layout
        header={<DialogHeader title={title} onOpenChange={(open) => !open && onClose()} />}
        content={<LayoutContent>{children}</LayoutContent>}
        footer={footer ? <LayoutFooter hasDivider>{footer}</LayoutFooter> : undefined}
      />
    </Dialog>
  );
}

export type WickMenuOption =
  | { type: 'divider' }
  | {
      type?: 'item';
      id: string;
      label: string;
      description?: string;
      icon?: ReactNode;
      variant?: 'default' | 'destructive';
      disabled?: boolean;
      selected?: boolean;
      onClick?: () => void;
    };

interface WickMenuProps {
  trigger: ReactNode;
  items: WickMenuOption[];
  placement?: 'above' | 'below' | 'start' | 'end';
  alignment?: 'start' | 'center' | 'end';
  menuWidth?: number | string;
}

export function WickMenu({
  trigger,
  items,
  placement = 'below',
  alignment = 'end',
  menuWidth = 220,
}: WickMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const numericWidth = typeof menuWidth === 'number' ? menuWidth : 220;
    const menuEl = menuRef.current;
    const actualWidth = menuEl ? menuEl.offsetWidth || numericWidth : numericWidth;
    const actualHeight = menuEl ? menuEl.offsetHeight || 200 : 200;

    const gap = 6;
    let top = placement === 'above' ? rect.top - actualHeight - gap : rect.bottom + gap;
    let left = rect.left;

    if (alignment === 'end') {
      left = rect.right - actualWidth;
    } else if (alignment === 'center') {
      left = rect.left + rect.width / 2 - actualWidth / 2;
    }

    // Flip vertically if overflowing viewport bottom/top
    if (placement !== 'above' && top + actualHeight > window.innerHeight - 10) {
      const aboveTop = rect.top - actualHeight - gap;
      if (aboveTop >= 10) top = aboveTop;
    } else if (placement === 'above' && top < 10) {
      const belowTop = rect.bottom + gap;
      if (belowTop + actualHeight <= window.innerHeight - 10) top = belowTop;
    }

    // Clamp cleanly inside viewport edges
    left = Math.max(8, Math.min(left, window.innerWidth - actualWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - actualHeight - 8));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items.length, placement, alignment, menuWidth]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    const handleResize = () => setIsOpen(false);

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  return (
    <>
      <span
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex shrink-0"
      >
        {trigger}
      </span>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              width: typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth,
              zIndex: 9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="rounded-xl border border-[var(--wick-border-strong)] bg-[var(--wick-elevated)] shadow-2xl py-1.5 max-h-[70vh] overflow-y-auto focus:outline-none"
          >
            {items.map((item, idx) => {
              if (item.type === 'divider') {
                return (
                  <div
                    key={`div-${idx}`}
                    role="separator"
                    className="my-1 border-t border-[var(--wick-border)]"
                  />
                );
              }
              const isDestructive = item.variant === 'destructive';
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setIsOpen(false);
                    item.onClick?.();
                  }}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2.5 text-xs transition-colors ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isDestructive
                        ? 'text-red-400 hover:bg-red-500/10 cursor-pointer'
                        : item.selected
                          ? 'bg-[var(--wick-amber-soft)] text-[var(--wick-amber)] font-medium cursor-pointer'
                          : 'text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] cursor-pointer'
                  }`}
                >
                  {item.icon && (
                    <span
                      className={`mt-0.5 shrink-0 ${
                        isDestructive
                          ? 'text-red-400'
                          : item.selected
                            ? 'text-[var(--wick-amber)]'
                            : 'text-[var(--wick-muted)]'
                      }`}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate leading-snug">{item.label}</span>
                    {item.description && (
                      <span className="block text-[11px] text-[var(--wick-muted)] mt-0.5 leading-snug">
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
