import React from 'react';
import Button from '../Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md neo-card p-6 md:p-7">
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
          {title}
        </h3>

        <p className="text-[var(--text-secondary)] leading-7 mb-6">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>

          <Button
            variant="secondary"
            onClick={onConfirm}
            className={
              destructive
                ? 'bg-red-500 text-white hover:bg-red-600'
                : ''
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
