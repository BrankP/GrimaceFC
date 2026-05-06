import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { NameGate } from './components/NameGate';
import { ChatPage } from './pages/ChatPage';
import { UpcomingGamesPage } from './pages/UpcomingGamesPage';
import { NextGamePage } from './pages/NextGamePage';
import { NextRefPage } from './pages/NextRefPage';
import { TeamStatsPage } from './pages/TeamStatsPage';
import { clearAvailability, loadAppData, patchMessage, postAvailability, postEventScore, postLineup, postMessage, removeMessage, saveNotificationPreference, toggleReaction, upsertUser } from './services/dataService';
import { canUsePushNotifications, disablePushNotifications, syncPushSubscription, type PushSyncFailureReason } from './services/pushNotifications';
import type { AvailabilityStatus, DataStore, Lineup, NotificationPreference, User } from './types/models';
import { readCurrentUserId, readTeamPasscode, readVisitorSession, writeCurrentUserId, writeTeamPasscode, writeVisitorSession } from './utils/storage';

type AppState = {
  data: DataStore | null;
  currentUser: User | null;
  canEditLineup: boolean;
  canEditScores: boolean;
  canWrite: boolean;
  isVisitor: boolean;
  upsertUserByName: (payload: { firstName: string; lastName: string; passcode: string; isVisitor: boolean }) => Promise<void>;
  addMessage: (text: string) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  saveNickname: (userId: string, nickname: string) => Promise<void>;
  saveLineup: (lineup: Lineup) => Promise<void>;
  saveEventScore: (payload: {
    eventId: string;
    grimaceScore: number;
    opponentScore: number;
    goalDetails: Array<{ scorerUserId: string | null; assistUserId: string | null; isOwnGoal: boolean }>;
  }) => Promise<void>;
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
  const [pushStatus, setPushStatus] = useState<'idle' | 'prompting' | 'enabled' | 'unsupported' | 'denied' | 'error'>('idle');
  const [pushErrorDetail, setPushErrorDetail] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference>('all_chats');
  const [savedNotificationPreference, setSavedNotificationPreference] = useState<NotificationPreference>('all_chats');
  const [settingsStatus, setSettingsStatus] = useState('');
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
  const canEditScores = canEditLineup;

  const setPushFailure = (reason: PushSyncFailureReason, detail?: string) => {
    if (reason === 'unsupported') {
      setPushStatus('unsupported');
      setPushErrorDetail('');
      return;
    }
    if (reason === 'denied') {
      setPushStatus('denied');
      setPushErrorDetail('');
      return;
    }
    if (reason === 'default') {
      setPushStatus('idle');
      setPushErrorDetail('');
      return;
    }
    setPushStatus('error');
    if (reason === 'missing_vapid_key') {
      setPushErrorDetail('Server push config is missing VAPID_PUBLIC_KEY.');
      return;
    }
    if (reason === 'invalid_vapid_key') {
      setPushErrorDetail('Server push config has an invalid VAPID public key format.');
      return;
    }
    setPushErrorDetail(detail ?? reason);
  };

  useEffect(() => {
    if (isVisitor || !currentUserId) return;
    if (!canUsePushNotifications()) {
      setPushStatus('unsupported');
      setPushErrorDetail('');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      setPushErrorDetail('');
      return;
    }
    setPushStatus('idle');
    setPushErrorDetail('');
  }, [currentUserId, isVisitor]);

  useEffect(() => {
    if (!currentUser || isVisitor) return;
    const pref = currentUser.notificationPreference ?? 'all_chats';
    setNotificationPreference(pref);
    setSavedNotificationPreference(pref);
  }, [currentUser, isVisitor]);

  const saveNotificationSettings = async () => {
    if (!currentUserId || isVisitor) return;
    setSettingsStatus('Saving...');

    if (notificationPreference === 'disabled') {
      try {
        await saveNotificationPreference({ userId: currentUserId, preference: 'disabled' });
        await disablePushNotifications(currentUserId);
        await refreshData(0, true);
        setSavedNotificationPreference('disabled');
        setSettingsStatus('Saved ✓');
      } catch (err) {
        setSettingsStatus(err instanceof Error ? err.message : 'Failed to save settings.');
      }
      return;
    }

    if (!canUsePushNotifications()) {
      setSettingsStatus('Push notifications are not supported on this device/browser.');
      return;
    }

    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'denied') {
      setSettingsStatus('Notifications are blocked in your browser. Enable them in site settings to receive alerts.');
      return;
    }
    if (permission !== 'granted') {
      setSettingsStatus('Notification permission was not granted.');
      return;
    }

    const result = await syncPushSubscription(currentUserId);
    if (!result.ok) {
      setPushFailure(result.reason, result.detail);
      setSettingsStatus(pushStatusLabel);
      return;
    }

    try {
      await saveNotificationPreference({ userId: currentUserId, preference: notificationPreference });
      await refreshData(0, true);
      setSavedNotificationPreference(notificationPreference);
      setSettingsStatus('Saved ✓');
    } catch (err) {
      setSettingsStatus(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const wipeClientDataAndLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to wipe app cache and log out? This will clear local app data on this device.');
    if (!confirmed) return;

    setSettingsStatus('Wiping cache and logging out...');

    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null);

    try {
      localStorage.clear();
    } catch {
      // best effort
    }

    try {
      sessionStorage.clear();
    } catch {
      // best effort
    }

    try {
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const rawCookie of cookies) {
        const cookieName = rawCookie.split('=')[0]?.trim();
        if (!cookieName) continue;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    } catch {
      // best effort
    }

    if ('indexedDB' in window) {
      try {
        const indexedDbWithDiscovery = indexedDB as IDBFactory & {
          databases?: () => Promise<Array<{ name?: string }>>;
        };
        if (typeof indexedDbWithDiscovery.databases === 'function') {
          const databases = await indexedDbWithDiscovery.databases();
          await Promise.allSettled(
            databases
              .map((database) => database.name)
              .filter((name): name is string => Boolean(name))
              .map((name) => new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              })),
          );
        }
      } catch {
        // best effort
      }
    }

    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.allSettled(cacheKeys.map((key) => caches.delete(key)));
      } catch {
        // best effort
      }
    }

    setCurrentUserId(null);
    setVisitorSession(null);
    setTeamPasscode('');
    setPasscodeInput('');
    setShowSettings(false);
    setSettingsStatus('');
    setError('');
    navigate('/', { replace: true });
    window.location.assign('/');
  };

  const pushStatusLabel = (() => {
    if (pushStatus === 'enabled') return 'Notifications are enabled.';
    if (pushStatus === 'prompting') return 'Waiting for browser permission prompt…';
    if (pushStatus === 'denied') return 'Notifications are blocked in this browser/device.';
    if (pushStatus === 'unsupported') return 'This browser/device does not support push notifications.';
    if (pushStatus === 'error') return pushErrorDetail || 'Could not enable notifications right now.';
    if (!canUsePushNotifications()) return 'This browser/device does not support push notifications.';
    if (Notification.permission === 'granted') return 'Notifications are allowed by your device. Tap Enable notifications to connect this app install.';
    return 'Enable push notifications to get alerted when someone tags you in chat.';
  })();

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

  const editMessage = async (messageId: string, text: string) => {
    if (!currentUserId || !canWrite) return;
    await withWriteGuard(async () => {
      await patchMessage({ messageId, userId: currentUserId, text });
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUserId || !canWrite) return;
    await withWriteGuard(async () => {
      await removeMessage({ messageId, userId: currentUserId });
    });
  };

  const toggleMessageReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId || !canWrite) return;
    await withWriteGuard(async () => {
      await toggleReaction({ messageId, userId: currentUserId, emoji });
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

  const saveEventScore = async (payload: {
    eventId: string;
    grimaceScore: number;
    opponentScore: number;
    goalDetails: Array<{ scorerUserId: string | null; assistUserId: string | null; isOwnGoal: boolean }>;
  }) => {
    if (!canWrite) return;
    await withWriteGuard(async () => {
      await postEventScore(payload);
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
        canEditScores,
        canWrite,
        isVisitor,
        upsertUserByName,
        addMessage,
        editMessage,
        deleteMessage,
        toggleMessageReaction,
        saveNickname,
        saveLineup,
        saveEventScore,
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
            {!isVisitor && (
              <button type="button" className="settings-btn" aria-label="Open notification settings" onClick={() => setShowSettings(true)}><span aria-hidden="true">⚙️</span></button>
            )}
          </div>
        </header>


        {error && <p className="error">{error}</p>}

        {data && currentUser && (
          <main className="page-wrap">
            <Routes>
              <Route path="/" element={<Navigate to={isVisitor ? '/upcoming' : '/chat'} replace />} />
              <Route path="/upcoming" element={<UpcomingGamesPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/game" element={<NextGamePage />} />
              <Route path="/next-ref" element={<NextRefPage />} />
              <Route path="/team-stats" element={<TeamStatsPage />} />
            </Routes>
          </main>
        )}


        {showSettings && !isVisitor && currentUser && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="card modal">
              <h3>⚙️ Settings</h3>
              <p className="muted">{currentUser.name}</p>
              <div className="stack">
                <div>
                  <p><strong>Chat Notifications</strong></p>
                  <p className="muted">Choose when you want to be notified</p>
                </div>
                {([
                  { value: 'all_chats', title: 'All messages', help: 'Get notified for every chat message' },
                  { value: 'tagged_only', title: 'Mentions only', help: 'Only when someone tags you' },
                                  ] as Array<{ value: NotificationPreference; title: string; help: string }>).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-row ${notificationPreference === option.value ? 'active' : ''}`}
                    onClick={() => {
                      setNotificationPreference(option.value);
                      setSettingsStatus('');
                    }}
                  >
                    <span>
                      <strong>{option.title}</strong>
                      <small className="muted">{option.help}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="muted" style={{ minHeight: 20 }}>{settingsStatus}</p>
              <div className="settings-actions">
                <div className="row">
                  <button type="button" onClick={() => void saveNotificationSettings()} disabled={notificationPreference === savedNotificationPreference}>Save</button>
                  <button type="button" className="secondary" onClick={() => setShowSettings(false)}>Close</button>
                </div>
                <button type="button" className="secondary danger-action" onClick={() => void wipeClientDataAndLogout()}>
                  Wipe Cache
                </button>
              </div>
            </div>
          </div>
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
