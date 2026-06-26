'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SelectedSourceProvider } from '@/components/SelectedSourceProvider';

/**
 * Client providers (TanStack Query). Wraps the app so interactive components can
 * fetch from /api/v1. Server Components passed as `children` still render on the
 * server — this only adds the client query context.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SelectedSourceProvider>{children}</SelectedSourceProvider>
    </QueryClientProvider>
  );
}
