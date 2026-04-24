import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { NameGate } from './components/NameGate';
import { ChatPage } from './pages/ChatPage';
import { UpcomingGamesPage } from './pages/UpcomingGamesPage';
import { NextGamePage } from './pages/NextGamePage';
import { NextRefPage } from './pages/NextRefPage';
import { clearAvailability, loadAppData, postAvailability, postLineup, postMessage, upsertUser } from './services/dataService';
import { canUsePushNotifications, syncPushSubscription } from './services/pushNotifications';
import type { AvailabilityStatus, DataStore, Lineup, User } from './types/models';
import { readCurrentUserId, readTeamPasscode, readVisitorSession, writeCurrentUserId, writeTeamPasscode, writeVisitorSession } from './utils/storage';

type AppState = {
  data: DataStore | null;
  currentUser: User | null;
  canEditLineup: boolean;
  canWrite: boolean;
  isVisitor: boolean;
  upsertUserByName: (payload: { firstName: string; lastName: string; passcode: string; isVisitor: boolean }) => Promise<void>;
  addMessage: (text: string) => Promise<void>;
  saveNickname: (userId: string, nickname: string) => Promise<void>;
  saveLineup: (lineup: Lineup) => Promise<void>;
  setAvailability: (eventId: string, userId: string, status: AvailabilityStatus) => Promise<void>;
  clearAvailability: (eventId: string, userId: string) => Promise<void>;
  getAvailability: (eventId: string, userId: string) => AvailabilityStatus | null;
  getDisplayName: (userId: string) => string;
  getUserName: (userId: string) => string;
  refreshAppData: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const state = useContext(AppContext);
  if (!state) throw new Error('useAppState must be within provider');
  return state;
};

export default function App() {
  const ADMIN_PASSCODE = 'adminadmin';
  const PLAYER_PASSCODE = 'upthegrimace';

  const [data, setData] = useState<DataStore | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(readCurrentUserId());
  const [visitorSession, setVisitorSession] = useState(() => readVisitorSession());
  const [error, setError] = useState('');
  const [teamPasscode, setTeamPasscode] = useState(readTeamPasscode());
  const [passcodeInput, setPasscodeInput] = useState(readTeamPasscode());
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'enabled' | 'unsupported' | 'denied' | 'error'>('idle');
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

  const visitorUser = useMemo<User | null>(() => {
    if (!visitorSession) return null;
    return {
      id: 'visitor-session',
      name: `${visitorSession.firstName} ${visitorSession.lastName}`.trim(),
      createdYear: new Date().getFullYear(),
      createdAt: new Date().toISOString(),
    };
  }, [visitorSession]);

  const currentUser = useMemo(() => {
    if (visitorUser) return visitorUser;
    return data?.users.find((u) => u.id === currentUserId) ?? null;
  }, [data, currentUserId, visitorUser]);

  const isVisitor = Boolean(visitorUser);
  const canWrite = !isVisitor && teamPasscode.trim().length > 0;
  const canEditLineup = !isVisitor && teamPasscode.trim() === ADMIN_PASSCODE;
  const shouldPromptPush = !isVisitor && Boolean(currentUserId) && canUsePushNotifications() && pushStatus !== 'enabled' && Notification.permission !== 'denied';

  useEffect(() => {
    if (isVisitor || !currentUserId) return;
    if (!canUsePushNotifications()) {
      setPushStatus('unsupported');
      return;
    }

    const init = async () => {
      try {
        const result = await syncPushSubscription(currentUserId);
        if (result.ok) {
          setPushStatus('enabled');
          return;
        }
        if (result.reason === 'unsupported') {
          setPushStatus('unsupported');
          return;
        }
        if (result.reason === 'denied') {
          setPushStatus('denied');
        }
      } catch {
        setPushStatus('error');
      }
    };

    void init();
  }, [currentUserId, isVisitor]);

  const enablePush = async () => {
    if (!currentUserId) return;
    if (!canUsePushNotifications()) {
      setPushStatus('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      const result = await syncPushSubscription(currentUserId);
      setPushStatus(result.ok ? 'enabled' : 'error');
    } catch {
      setPushStatus('error');
    }
  };

  const upsertUserByName = async ({ firstName, lastName, passcode, isVisitor: visitorMode }: { firstName: string; lastName: string; passcode: string; isVisitor: boolean }) => {
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').trim();

      if (visitorMode) {
        writeVisitorSession({ firstName: firstName.trim(), lastName: lastName.trim() });
        setVisitorSession({ firstName: firstName.trim(), lastName: lastName.trim() });
        writeCurrentUserId('');
        setCurrentUserId(null);
        setError('');
        navigate('/upcoming');
        return;
      }

      if (![ADMIN_PASSCODE, PLAYER_PASSCODE].includes(passcode.trim())) {
        setError('Invalid team passcode');
        return;
      }

      writeVisitorSession(null);
      setVisitorSession(null);
      writeTeamPasscode(passcode.trim());
      setTeamPasscode(passcode.trim());
      setPasscodeInput(passcode.trim());

      const user = await upsertUser({ name: fullName, createdYear: new Date().getFullYear() });
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
    if (!currentUserId || !canWrite) return;
    await withWriteGuard(async () => {
      await postMessage({ userId: currentUserId, text });
    });
  };

  const saveNickname = async (userId: string, nickname: string) => {
    if (!canWrite) return;
    const user = data?.users.find((u) => u.id === userId);
    if (!user) return;
    await withWriteGuard(async () => {
      await upsertUser({ id: userId, name: user.name, nickname });
    });
  };

  const setAvailability = async (eventId: string, userId: string, status: AvailabilityStatus) => {
    if (!canWrite) return;
    await withWriteGuard(async () => {
      await postAvailability({ eventId, userId, status });
    });
  };

  const clearAvailabilityForUser = async (eventId: string, userId: string) => {
    if (!canWrite) return;
    await withWriteGuard(async () => {
      await clearAvailability({ eventId, userId });
    });
  };

  const getAvailability = (eventId: string, userId: string): AvailabilityStatus | null =>
    data?.availability.find((a) => a.eventId === eventId && a.userId === userId)?.status ?? null;

  const saveLineup = async (lineup: Lineup) => {
    if (!canWrite) return;
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

  const refreshAppData = async () => {
    await refreshData(0, true);
  };

  if (!data && !error) return <main className="loading">Loading team data…</main>;
  if (data && !currentUser) {
    return <NameGate onSubmit={(payload) => void upsertUserByName(payload)} serverError={error} />;
  }

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser,
        canEditLineup,
        canWrite,
        isVisitor,
        upsertUserByName,
        addMessage,
        saveNickname,
        saveLineup,
        setAvailability,
        clearAvailability: clearAvailabilityForUser,
        getAvailability,
        getDisplayName,
        getUserName,
        refreshAppData,
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>Grimace FC</h1>
            <p>{isVisitor ? 'Visitor (view-only)' : 'Social Team Hub'}</p>
          </div>
          <div className="row">
            <span className="badge header-chip">User: {currentUser ? currentUser.name : 'Guest'}</span>
          </div>
        </header>

        {shouldPromptPush && (
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0 }}>Enable push notifications to get alerted when someone tags you in chat.</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" onClick={() => void enablePush()}>Enable notifications</button>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {data && currentUser && (
          <main className="page-wrap">
            <Routes>
              <Route path="/" element={<Navigate to={isVisitor ? '/upcoming' : '/chat'} replace />} />
              <Route path="/upcoming" element={<UpcomingGamesPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/game" element={<NextGamePage />} />
              <Route path="/next-ref" element={<NextRefPage />} />
            </Routes>
          </main>
        )}

        {showPasscodeModal && !isVisitor && (
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

        <BottomNav />
      </div>
    </AppContext.Provider>
  );
}
