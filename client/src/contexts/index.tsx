import React, { ReactNode } from 'react';
import { AppStateProvider } from './AppStateContext';
import { SettingsProvider } from './SettingsContext';

// Export all the individual providers and hooks
export * from './AppStateContext';
export * from './SettingsContext';

// Combined provider that wraps all contexts
interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AppStateProvider>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </AppStateProvider>
  );
}