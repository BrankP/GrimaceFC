import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { NameGate } from './components/NameGate';
import { FinesPage } from './pages/FinesPage';
import { ChatPage } from './pages/ChatPage';
import { UpcomingGamesPage } from './pages/UpcomingGamesPage';
import { NextGamePage } from './pages/NextGamePage';
import { NextRefPage } from './pages/NextRefPage';
import { loadAppData, postAvailability, postFine, postLineup, postMessage, upsertUser } from './services/dataService';
import type { AvailabilityStatus, DataStore, Fine, Lineup, User } from './types/models';
import { readCurrentUserId, readTeamPasscode, writeCurrentUserId, writeTeamPasscode } from './utils/storage';

type AppState = {
  data: DataStore | null;
  currentUser: User | null;
  upsertUserByName: (name: string, passcode: string) => Promise<void>;
  addMessage: (text: string) => Promise<void>;
  addFine: (fine: Omit<Fine, 'id' | 'submittedAt'>) => Promise<void>;
  saveNickname: (userId: string, nickname: string) => Promise<void>;
  saveLineup: (lineup: Lineup) => Promise<void>;
  setAvailability: (eventId: string, userId: string, status: AvailabilityStatus) => Promise<void>;
  getAvailability: (eventId: string, userId: string) => AvailabilityStatus;
  getDisplayName: (userId: string) => string;
  getUserName: (userId: string) => string;
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
  const [teamPasscode, setTeamPasscode] = useState(readTeamPasscode());
  const [passcodeInput, setPasscodeInput] = useState(readTeamPasscode());
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);
  const navigate = useNavigate();
  const isFetchingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const refreshData = async (minIntervalMs = 0, force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < minIntervalMs) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const next = await loadAppData();
      setData(next);
      lastRefreshRef.current = Date.now();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    void refreshData(0, true);
  }, []);

  useEffect(() => {
    const messagesInterval = setInterval(() => {
      void refreshData(10_000);
    }, 12_000);

    const eventsInterval = setInterval(() => {
      void refreshData(30_000);
    }, 45_000);

    return () => {
      clearInterval(messagesInterval);
      clearInterval(eventsInterval);
    };
  }, []);

  const withWriteGuard = async (operation: () => Promise<void>) => {
    try {
      await operation();
      await refreshData(0, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write failed';
      setError(message);
      if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('passcode')) {
        setShowPasscodeModal(true);
      }
    }
  };

  const currentUser = useMemo(() => data?.users.find((u) => u.id === currentUserId) ?? null, [data, currentUserId]);
  const hasTeamPasscode = teamPasscode.trim().length > 0;

  const upsertUserByName = async (name: string, passcode: string) => {
    try {
      const trimmedPasscode = passcode.trim();
      writeTeamPasscode(trimmedPasscode);
      setTeamPasscode(trimmedPasscode);
      setPasscodeInput(trimmedPasscode);

      const user = await upsertUser({ name, createdYear: new Date().getFullYear() });
      writeCurrentUserId(user.id);
      setCurrentUserId(user.id);
      await refreshData(0, true);
      navigate('/chat');
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join team chat';
      setError(message);
    }
  };

  const addMessage = async (text: string) => {
    if (!currentUserId) return;
    await withWriteGuard(async () => {
      await postMessage({ userId: currentUserId, text });
    });
  };

  const addFine = async (fine: Omit<Fine, 'id' | 'submittedAt'>) => {
    await withWriteGuard(async () => {
      await postFine(fine);
    });
  };

  const saveNickname = async (userId: string, nickname: string) => {
    const user = data?.users.find((u) => u.id === userId);
    if (!user) return;
    await withWriteGuard(async () => {
      await upsertUser({ id: userId, name: user.name, nickname });
    });
  };

  const setAvailability = async (eventId: string, userId: string, status: AvailabilityStatus) => {
    await withWriteGuard(async () => {
      await postAvailability({ eventId, userId, status });
    });
  };

  const getAvailability = (eventId: string, userId: string): AvailabilityStatus =>
    data?.availability.find((a) => a.eventId === eventId && a.userId === userId)?.status ?? 'not_available';

  const saveLineup = async (lineup: Lineup) => {
    await withWriteGuard(async () => {
      await postLineup({
        id: lineup.id,
        eventId: lineup.eventId,
        formation: lineup.formation,
        positions: lineup.positions,
        subs: lineup.subs,
        notAvailable: lineup.notAvailable,
        beerDutyUserId: lineup.beerDutyUserId,
        refDutyUserId: lineup.refDutyUserId,
      });
    });
  };

  const getDisplayName = (userId: string) => {
    const user = data?.users.find((u) => u.id === userId);
    return user?.nickname || user?.name || 'Unknown';
  };

  const getUserName = (userId: string) => {
    const user = data?.users.find((u) => u.id === userId);
    return user?.name || 'Unknown';
  };

  if (!data && !error) return <main className="loading">Loading team data…</main>;
  if (data && (!currentUser || !hasTeamPasscode)) {
    return <NameGate onSubmit={(name, passcode) => void upsertUserByName(name, passcode)} initialName={currentUser?.name ?? ''} serverError={error} />;
  }

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
        getUserName,
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>Grimace FC</h1>
            <p>Social Team Hub</p>
          </div>
          <div className="row">
            <button className="secondary header-chip" type="button" onClick={() => setShowFineModal(true)}>Fine Submission</button>
            <button className="secondary header-chip" type="button" onClick={() => setShowPasscodeModal(true)}>Team Passcode</button>
            <span className="badge header-chip">User: {currentUser ? getUserName(currentUser.id) : 'Guest'}</span>
          </div>
        </header>

        {error && <p className="error">{error}</p>}

        {data && currentUser && (
          <main className="page-wrap">
            <Routes>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="/upcoming" element={<UpcomingGamesPage />} />
              <Route path="/fines" element={<FinesPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/game" element={<NextGamePage />} />
              <Route path="/next-ref" element={<NextRefPage />} />
            </Routes>
          </main>
        )}

        {showPasscodeModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <form
              className="card modal"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = passcodeInput.trim();
                writeTeamPasscode(trimmed);
                setTeamPasscode(trimmed);
                setPasscodeInput(trimmed);
                setShowPasscodeModal(false);
              }}
            >
              <h3>Team Write Passcode</h3>
              <input
                type="password"
                value={passcodeInput}
                onChange={(event) => setPasscodeInput(event.target.value)}
                placeholder="Enter team passcode"
                required
              />
              <div className="row">
                <button type="submit">Save</button>
                <button className="secondary" type="button" onClick={() => setShowPasscodeModal(false)}>Close</button>
              </div>
            </form>
          </div>
        )}

        {showFineModal && currentUser && data && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <form
              className="card modal"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void addFine({
                  whoUserId: String(formData.get('whoUserId')),
                  submittedByUserId: currentUser.id,
                  amount: Number(formData.get('amount')),
                  reason: String(formData.get('reason')),
                }).then(() => {
                  setShowFineModal(false);
                  event.currentTarget.reset();
                });
              }}
            >
              <h3>Submit Fine</h3>
              <select name="whoUserId" required>
                {data.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
              </select>
              <input className="no-spinner" name="amount" type="number" min="0" step="0.5" placeholder="Amount" defaultValue={5} required />
              <input name="reason" placeholder="Reason" required />
              <div className="row">
                <button type="submit">Save Fine</button>
                <button type="button" className="secondary" onClick={() => setShowFineModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <BottomNav />
      </div>
    </AppContext.Provider>
  );
}
