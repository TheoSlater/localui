interface EmptyStateProps {
  userName: string;
  children: React.ReactNode;
}

export function EmptyState({ userName, children }: EmptyStateProps) {
  return (
    <div className="animate-in fade-in-0 flex min-h-svh items-center justify-center p-4 duration-(--motion-duration-fast) ease-(--motion-ease-spring)">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <p className="text-muted-foreground text-center text-lg">Hello, {userName}</p>
        {children}
      </div>
    </div>
  );
}
