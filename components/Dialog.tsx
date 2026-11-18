import React, { ReactNode, useEffect, useId, useRef } from 'react';
import Icon from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Modal dialogs dim the page; non-modal panels keep the map visible. */
  modal?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Native `<dialog>` wrapper: the browser provides focus handling, Escape, and
 * the backdrop for modal dialogs. Non-modal panels close on Escape or an
 * outside click so the map stays usable while settings are adjusted.
 */
export default function Dialog({
  open,
  onClose,
  title,
  modal = true,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (modal && typeof dialog.showModal === 'function') dialog.showModal();
      else if (!modal && typeof dialog.show === 'function') dialog.show();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, modal]);

  useEffect(() => {
    if (!open || modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        ref.current &&
        target &&
        !ref.current.contains(target) &&
        !(target as HTMLElement).closest?.('[data-overlay-trigger]')
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, modal, onClose]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${modal ? 'dialog--modal' : 'dialog--panel'} ${className ?? ''}`}
      aria-labelledby={titleId}
      onClose={() => open && onClose()}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (modal && event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__inner">
          <header className="dialog__header">
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="dialog__body">{children}</div>
        </div>
      )}
    </dialog>
  );
}
