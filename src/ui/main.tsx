// React entry point

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './context/AppContext';
import { ModalProvider } from './components/Modals/ModalContext';
import { App } from './App';
import './styles/main.scss';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <AppProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </AppProvider>
  );
}
