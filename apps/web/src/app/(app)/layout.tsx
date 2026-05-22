import { QueryProvider } from '@/components/query-provider';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

// Every page under (app) requires a session — never prerender them.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Topbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
