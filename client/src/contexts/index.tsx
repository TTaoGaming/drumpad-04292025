import React, { ReactNode } from 'react';
import { AppStateProvider } from './AppStateContext';
import { SettingsProvider } from './SettingsContext';
import { SettingsWorkerProvider } from './SettingsWorkerContext';

// Export all the individual providers and hooks
export * from './AppStateContext';
export * from './SettingsContext';
export * from './SettingsWorkerContext';

// Combined provider that wraps all contexts
interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SettingsWorkerProvider>
      <AppStateProvider>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </AppStateProvider>
    </SettingsWorkerProvider>
  );
}