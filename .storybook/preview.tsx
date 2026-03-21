import React, { useEffect } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { AppProvider, useAppContext } from '../src/ui/context/AppContext';
import { ModalProvider } from '../src/ui/components/Modals/ModalContext';
import {
  mockCollections,
  mockShadeGroups,
  mockVariables,
  type StorybookSeed,
} from '../src/ui/stories/mockData';
import '../src/ui/styles/main.scss';

function SeedContext({ seed, children }: { seed: StorybookSeed; children: React.ReactNode }) {
  const { setData } = useAppContext();

  useEffect(() => {
    setData(seed.collections, seed.variables, seed.shadeGroups);
  }, [seed.collections, seed.shadeGroups, seed.variables, setData]);

  return <>{children}</>;
}

function StorybookShell({
  children,
  seed,
  themeMode,
}: {
  children: React.ReactNode;
  seed: StorybookSeed;
  themeMode: 'light' | 'dark';
}) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme-mode', themeMode);
    return () => {
      document.documentElement.removeAttribute('data-theme-mode');
    };
  }, [themeMode]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppProvider>
        <ModalProvider>
          <SeedContext seed={seed}>{children}</SeedContext>
        </ModalProvider>
      </AppProvider>
    </div>
  );
}

const withProviders: Decorator = (Story, context) => {
  const seed = (context.parameters.seed as StorybookSeed | undefined) || {
    collections: mockCollections,
    variables: mockVariables,
    shadeGroups: mockShadeGroups,
  };
  const themeMode = context.globals.themeMode === 'dark' ? 'dark' : 'light';

  return (
    <StorybookShell seed={seed} themeMode={themeMode}>
      <Story />
    </StorybookShell>
  );
};

const preview: Preview = {
  decorators: [withProviders],
  parameters: {
    layout: 'fullscreen',
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ['Foundation', 'Views'],
      },
    },
  },
  globalTypes: {
    themeMode: {
      name: 'Theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
};

export default preview;
