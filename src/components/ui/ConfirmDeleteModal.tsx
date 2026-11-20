import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { WickButton, WickInput, WickModal } from './WickPrimitives';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  itemType: string;
  itemName: string;
  warningDetail?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  itemType,
  itemName,
  warningDetail,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedName('');
      setIsDeleting(false);
    }
  }, [isOpen, itemName]);

  const expected = itemName.trim();
  const isMatch = expected.length > 0 && typedName.trim() === expected;

  const handleDelete = async () => {
    if (!isMatch || isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <WickModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${itemType}`}
      width={460}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <WickButton label="Cancel" variant="ghost" onClick={onClose} />
          <WickButton
            label={`Delete ${itemType}`}
            variant="primary"
            isDisabled={!isMatch}
            isLoading={isDeleting}
            icon={<Trash2 className="w-4 h-4" />}
            className={
              isMatch
                ? '!bg-red-600 !text-white hover:!bg-red-500'
                : '!opacity-40 !cursor-not-allowed'
            }
            onClick={() => void handleDelete()}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/25 bg-red-500/10 text-xs leading-relaxed text-[var(--wick-ink)]">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p>
              This will permanently remove this {itemType.toLowerCase()} from your local workspace.
            </p>
            {warningDetail && <p className="text-[var(--wick-muted)] mt-1">{warningDetail}</p>}
          </div>
        </div>

        <div>
          <p className="text-xs text-[var(--wick-muted)] mb-2">
            Retype the exact {itemType.toLowerCase()} name below to confirm you are deleting the
            right one:
          </p>
          <div className="px-3 py-2 rounded-md border border-[var(--wick-border-strong)] bg-[var(--wick-surface)] text-sm font-medium text-[var(--wick-amber)] select-all mb-3">
            {expected}
          </div>

          <WickInput
            label={`Type "${expected}"`}
            placeholder={expected}
            value={typedName}
            onChange={setTypedName}
            hasAutoFocus
            autoComplete="off"
            onEnter={() => {
              if (isMatch) {
                void handleDelete();
              }
            }}
          />

          {typedName.length > 0 && !isMatch && (
            <p className="text-xs text-[var(--wick-muted)] mt-1.5">
              Keep typing until it matches <span className="text-[var(--wick-ink)]">{expected}</span>{' '}
              exactly.
            </p>
          )}
        </div>
      </div>
    </WickModal>
  );
}
