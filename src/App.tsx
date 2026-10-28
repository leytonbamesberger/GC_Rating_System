import { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import PMNameScreen from './screens/PMNameScreen';
import AddReportFlow from './screens/AddReportFlow';
import GCDashboard from './screens/GCDashboard';
import GCDetailPage from './screens/GCDetailPage';
import CSVUploadScreen from './screens/CSVUploadScreen';
import { clearSupabaseToken, supabase, type ProjectManager } from './lib/supabase';
import { accountOid } from './lib/msal';

type Screen =
  | 'home'
  | 'pm-name'
  | 'add-report'
  | 'gc-dashboard'
  | 'gc-detail'
  | 'csv-upload';

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0] ?? null;

  const [screen, setScreen] = useState<Screen>('home');
  // The signed-in user's own project manager row, linked by email at sign-in (gc_link_pm); null if
  // there was no match. Only needed to file a rating, so a person without one (an estimator who only
  // views the dashboard) is asked for their name the first time they add a report.
  const [currentPM, setCurrentPM] = useState<ProjectManager | null>(null);
  const [pmLoading, setPMLoading] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [selectedGCId, setSelectedGCId] = useState<string | null>(null);

  const oid = account ? accountOid(account) : null;

  useEffect(() => {
    if (!oid) {
      setCurrentPM(null);
      return;
    }
    let cancelled = false;
    setPMLoading(true);
    supabase.rpc('gc_link_pm').then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error('[app] could not link project manager:', error);
      setCurrentPM((data as ProjectManager[] | null)?.[0] ?? null);
      setPMLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [oid]);

  function handleAddReport() {
    setConfirmationMessage('');
    setScreen(currentPM ? 'add-report' : 'pm-name');
  }

  function handlePMCreated(pm: ProjectManager) {
    setCurrentPM(pm);
    setScreen('add-report');
  }

  function handleReportComplete(gcName: string) {
    setConfirmationMessage(`Rating submitted for ${gcName}. Thank you.`);
    setScreen('home');
  }

  const headerSubtitle =
    screen === 'gc-dashboard' ? 'GC Performance Dashboard' :
    screen === 'csv-upload' ? 'Upload Bid Data' :
    'GC Rating System';

  function handleHome() {
    setScreen('home');
    setConfirmationMessage('');
  }

  function handleSignOut() {
    clearSupabaseToken();
    setCurrentPM(null);
    setScreen('home');
    instance.logoutRedirect();
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white text-legacy-blue-dark">
        <Header subtitle="GC Rating System" />
        {inProgress !== InteractionStatus.None ? <LoadingSpinner /> : <LoginScreen />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-legacy-blue-dark">
      <Header
        subtitle={headerSubtitle}
        onHome={handleHome}
        userName={currentPM?.name ?? account?.name ?? account?.username}
        onSignOut={handleSignOut}
      />

      {pmLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {screen === 'home' && (
            <HomeScreen
              name={currentPM?.name ?? account?.name ?? account?.username ?? ''}
              confirmationMessage={confirmationMessage}
              onAddReport={handleAddReport}
              onViewDashboard={() => setScreen('gc-dashboard')}
            />
          )}

          {screen === 'pm-name' && account && (
            <PMNameScreen
              account={account}
              onCreated={handlePMCreated}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'add-report' && currentPM && (
            <AddReportFlow
              pm={currentPM}
              onComplete={handleReportComplete}
              onBack={() => setScreen('home')}
              onHome={handleHome}
            />
          )}

          {screen === 'gc-dashboard' && (
            <GCDashboard
              onBack={() => setScreen('home')}
              backLabel="← Back to Home"
              onSelectGC={(id) => { setSelectedGCId(id); setScreen('gc-detail'); }}
              onUploadCSV={() => setScreen('csv-upload')}
            />
          )}

          {screen === 'gc-detail' && selectedGCId && (
            <GCDetailPage
              gcId={selectedGCId}
              onBack={() => setScreen('gc-dashboard')}
            />
          )}

          {screen === 'csv-upload' && (
            <CSVUploadScreen
              onBack={() => setScreen('gc-dashboard')}
              onComplete={() => setScreen('gc-dashboard')}
            />
          )}
        </>
      )}
    </div>
  );
}
