import { AppShell } from '@/components/app-shell';
import { QueryProvider } from '@/components/query-provider';

// Every page under (app) requires a session — never prerender them.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppShell>{children}</AppShell>
    </QueryProvider>
  );
}
