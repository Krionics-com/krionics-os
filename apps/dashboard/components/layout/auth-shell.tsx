export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="absolute top-8 left-8">
        <span className="font-heading text-2xl font-bold text-primary">Krionics</span>
      </div>
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {children}
      </div>
    </div>
  );
}
