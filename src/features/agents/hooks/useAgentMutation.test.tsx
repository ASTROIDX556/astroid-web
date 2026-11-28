import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgentMutation } from './useAgentMutation';
import React from 'react';

describe('useAgentMutation', () => {
  it('should be defined', () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    expect(useAgentMutation).toBeDefined();
  });
});
