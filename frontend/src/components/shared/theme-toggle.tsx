import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';

const themes = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        'border-border bg-muted/50 inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        className,
      )}
      role="group"
      aria-label="Theme"
    >
      {themes.map(({ value, label, icon: ItemIcon }) => (
        <Button
          key={value}
          type="button"
          variant={theme === value ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => setTheme(value)}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className="rounded-md"
        >
          <ItemIcon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
