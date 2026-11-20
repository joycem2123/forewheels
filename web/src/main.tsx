import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { StoreProvider, useStore } from './state/store';
import { TabBar, Toast } from './components/ui';
import Home from './screens/Home';
import Book from './screens/Book';
import Bookings from './screens/Bookings';
import Passes from './screens/Passes';
import Me from './screens/Me';

function App() {
  const { data, tab } = useStore();
  if (!data) return <div className="loading mut">Loading…</div>;
  const Screen = { home: Home, book: Book, bookings: Bookings, passes: Passes, me: Me }[tab];
  return (
    <div className="app">
      <Screen key={tab} />
      <TabBar />
      <Toast />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider><App /></StoreProvider>
  </StrictMode>,
);

// Offline support when installed to the home screen. Skipped where service workers aren't allowed.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
