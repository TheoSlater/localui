import { useEffect, useState, useCallback } from 'react';

/**
 * Shared open/close transition for modal dialogs.
 * Centralizes the 160ms exit animation used by SettingsDialog and RenameChatDialog
 * so duration/easing stays consistent and no duplication drifts.
 */
export function useDialogTransition(open: boolean | undefined, openWhenTruthy?: unknown) {
  const isOpen = open !== undefined ? open : Boolean(openWhenTruthy);
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
    }
  }, [isOpen]);

  const requestClose = useCallback((onClose: () => void) => {
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      onClose();
    }, 160);
  }, []);

  return { visible, closing, requestClose, setVisible, setClosing };
}
