import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ExportChangesCard } from './components/ExportChangesCard';
import { NameGate } from './components/NameGate';
import { FinesPage } from './pages/FinesPage';
import { ChatPage } from './pages/ChatPage';
import { UpcomingGamesPage } from './pages/UpcomingGamesPage';
import { NextGamePage } from './pages/NextGamePage';
import { loadSeedData } from './services/dataService';
import type { DataStore, Fine, Lineup, Message, Nickname, User } from './types/models';
import { createId } from './utils/ids';
import { mergeSeedAndLocal, pushLocalChange, readCurrentUserId, readLocalChanges, writeCurrentUserId } from './utils/storage';

type AppState = {
  data: DataStore | null;
  currentUser: User | null;
  upsertUserByName: (name: string) => void;
  addMessage: (text: string) => void;
  addFine: (fine: Omit<Fine, 'id' | 'submittedAt'>) => void;
  saveNickname: (userId: string, nickname: string) => void;
  saveLineup: (lineup: Lineup) => void;
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
  const navigate = useNavigate();

  useEffect(() => {
    loadSeedData().then((seed) => {
      const merged = mergeSeedAndLocal(seed, readLocalChanges());
      setData(merged);
    });
  }, []);

  const currentUser = useMemo(() => data?.users.find((u) => u.id === currentUserId) ?? null, [data, currentUserId]);

  const refreshWithNewLocalChanges = () => {
    if (!data) return;
    setData((existing) => (existing ? mergeSeedAndLocal(existing, readLocalChanges()) : existing));
  };

  const upsertUserByName = (name: string) => {
    if (!data) return;
    const existing = data.users.find((user) => user.name.toLowerCase() === name.toLowerCase());
    const user: User =
      existing ?? {
        id: createId('usr'),
        name,
        createdYear: new Date().getFullYear(),
        createdAt: new Date().toISOString(),
      };

    if (!existing) pushLocalChange('users', user);
    writeCurrentUserId(user.id);
    setCurrentUserId(user.id);
    refreshWithNewLocalChanges();
    navigate('/chat');
  };

  const addMessage = (text: string) => {
    if (!currentUserId) return;
    const message: Message = {
      id: createId('msg'),
      userId: currentUserId,
      text,
      createdAt: new Date().toISOString(),
    };
    pushLocalChange('messages', message);
    refreshWithNewLocalChanges();
  };

  const addFine = (fine: Omit<Fine, 'id' | 'submittedAt'>) => {
    const payload: Fine = { ...fine, id: createId('fine'), submittedAt: new Date().toISOString() };
    pushLocalChange('fines', payload);
    refreshWithNewLocalChanges();
  };

  const saveNickname = (userId: string, nickname: string) => {
    if (!currentUserId) return;
    const nick: Nickname = {
      id: createId('nick'),
      userId,
      nickname,
      updatedAt: new Date().toISOString(),
      updatedByUserId: currentUserId,
    };
    pushLocalChange('nicknames', nick);
    refreshWithNewLocalChanges();
  };

  const saveLineup = (lineup: Lineup) => {
    pushLocalChange('lineups', { ...lineup, updatedAt: new Date().toISOString() });
    refreshWithNewLocalChanges();
  };

  const getDisplayName = (userId: string) => {
    if (!data) return 'Unknown';
    const user = data.users.find((u) => u.id === userId);
    const latestNickname = data.nicknames.find((n) => n.userId === userId);
    return latestNickname?.nickname || user?.nickname || user?.name || 'Unknown';
  };

  const state: AppState = {
    data,
    currentUser,
    upsertUserByName,
    addMessage,
    addFine,
    saveNickname,
    saveLineup,
    getDisplayName,
  };

  if (!data) return <main className="loading">Loading team data…</main>;

  if (!currentUser) return <NameGate onSubmit={upsertUserByName} />;

  return (
    <AppContext.Provider value={state}>
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
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/upcoming" element={<UpcomingGamesPage />} />
            <Route path="/fines" element={<FinesPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/game" element={<NextGamePage />} />
          </Routes>
          <ExportChangesCard />
        </main>
        <BottomNav />
      </div>
    </AppContext.Provider>
  );
}
