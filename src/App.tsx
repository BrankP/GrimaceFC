import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { NameGate } from './components/NameGate';
import { FinesPage } from './pages/FinesPage';
import { ChatPage } from './pages/ChatPage';
import { UpcomingGamesPage } from './pages/UpcomingGamesPage';
import { NextGamePage } from './pages/NextGamePage';
import { loadAppData, postAvailability, postFine, postLineup, postMessage, upsertUser } from './services/dataService';
import type { AvailabilityStatus, DataStore, Fine, Lineup, User } from './types/models';
import { readCurrentUserId, writeCurrentUserId } from './utils/storage';

type AppState = {
  data: DataStore | null;
  currentUser: User | null;
  upsertUserByName: (name: string) => Promise<void>;
  addMessage: (text: string) => Promise<void>;
  addFine: (fine: Omit<Fine, 'id' | 'submittedAt'>) => Promise<void>;
  saveNickname: (userId: string, nickname: string) => Promise<void>;
  saveLineup: (lineup: Lineup) => Promise<void>;
  setAvailability: (eventId: string, userId: string, status: AvailabilityStatus) => Promise<void>;
  getAvailability: (eventId: string, userId: string) => AvailabilityStatus;
  getDisplayName: (userId: string) => string;
};

const AppContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const state = useContext(AppContext);
  if (!state) throw new Error('useAppState must be within provider');
  return state;
};

export default function App() {
  const [data, setData] = useState<DataStore | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(readCurrentUserId());
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const refreshData = async () => {
    const next = await loadAppData();
    setData(next);
  };

  useEffect(() => {
    refreshData().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'));
  }, []);

  const currentUser = useMemo(() => data?.users.find((u) => u.id === currentUserId) ?? null, [data, currentUserId]);

  const upsertUserByName = async (name: string) => {
    const user = await upsertUser({ name, createdYear: new Date().getFullYear() });
    writeCurrentUserId(user.id);
    setCurrentUserId(user.id);
    await refreshData();
    navigate('/upcoming');
  };

  const addMessage = async (text: string) => {
    if (!currentUserId) return;
    await postMessage({ userId: currentUserId, text });
    await refreshData();
  };

  const addFine = async (fine: Omit<Fine, 'id' | 'submittedAt'>) => {
    await postFine(fine);
    await refreshData();
  };

  const saveNickname = async (userId: string, nickname: string) => {
    const user = data?.users.find((u) => u.id === userId);
    if (!user) return;
    await upsertUser({ id: userId, name: user.name, nickname });
    await refreshData();
  };

  const setAvailability = async (eventId: string, userId: string, status: AvailabilityStatus) => {
    await postAvailability({ eventId, userId, status });
    await refreshData();
  };

  const getAvailability = (eventId: string, userId: string): AvailabilityStatus =>
    data?.availability.find((a) => a.eventId === eventId && a.userId === userId)?.status ?? 'not_available';

  const saveLineup = async (lineup: Lineup) => {
    await postLineup({
      id: lineup.id,
      eventId: lineup.eventId,
      formation: lineup.formation,
      positions: lineup.positions,
      subs: lineup.subs,
      notAvailable: lineup.notAvailable,
    });
    await refreshData();
  };

  const getDisplayName = (userId: string) => {
    const user = data?.users.find((u) => u.id === userId);
    return user?.nickname || user?.name || 'Unknown';
  };

  if (error) return <main className="loading">Error: {error}</main>;
  if (!data) return <main className="loading">Loading team data…</main>;
  if (!currentUser) return <NameGate onSubmit={(name) => void upsertUserByName(name)} />;

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser,
        upsertUserByName,
        addMessage,
        addFine,
        saveNickname,
        saveLineup,
        setAvailability,
        getAvailability,
        getDisplayName,
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>Grimace FC</h1>
            <p>Social Team Hub</p>
          </div>
          <span className="badge">{getDisplayName(currentUser.id)}</span>
        </header>
        <main className="page-wrap">
          <Routes>
            <Route path="/" element={<Navigate to="/upcoming" replace />} />
            <Route path="/upcoming" element={<UpcomingGamesPage />} />
            <Route path="/fines" element={<FinesPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/game" element={<NextGamePage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </AppContext.Provider>
  );
}
