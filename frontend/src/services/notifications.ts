import { toast } from '@/components/ui/toast';

export type NotificationType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface NotificationOptions {
  title: string;
  description?: string;
  type?: NotificationType;
  timeout?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function show({ title, description, type = 'info', timeout = 5000, action }: NotificationOptions) {
  return toast.add({
    title,
    description,
    type,
    timeout,
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  });
}

export const notifications = {
  show,
  success: (title: string, description?: string) => show({ title, description, type: 'success' }),
  info: (title: string, description?: string) => show({ title, description, type: 'info' }),
  warning: (title: string, description?: string) => show({ title, description, type: 'warning' }),
  error: (title: string, description?: string) => show({ title, description, type: 'error' }),
  loading: (title: string, description?: string) =>
    show({ title, description, type: 'loading', timeout: 0 }),
};
