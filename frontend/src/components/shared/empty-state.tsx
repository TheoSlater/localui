interface EmptyStateProps {
  userName: string;
  children: React.ReactNode;
}

export function EmptyState({ userName, children }: EmptyStateProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <p className="text-muted-foreground text-center text-lg">Hello, {userName}</p>
        {children}
      </div>
    </div>
  );
}
