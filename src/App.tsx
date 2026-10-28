import { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import LoginScreen from './screens/LoginScreen';
import LandingScreen from './screens/LandingScreen';
import PMNameScreen from './screens/PMNameScreen';
import PMHomeScreen from './screens/PMHomeScreen';
import AddReportFlow from './screens/AddReportFlow';
import GCDashboard from './screens/GCDashboard';
import GCDetailPage from './screens/GCDetailPage';
import CSVUploadScreen from './screens/CSVUploadScreen';
import { clearSupabaseToken, supabase, type ProjectManager } from './lib/supabase';
import { accountOid } from './lib/msal';

type Screen =
  | 'landing'
  | 'pm-name'
  | 'pm-home'
  | 'pm-add-report'
  | 'gc-dashboard'
  | 'gc-detail'
  | 'csv-upload';

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0] ?? null;

  const [screen, setScreen] = useState<Screen>('landing');
  // The signed-in user's own project manager row, linked by email at sign-in (gc_link_pm); null if
  // there was no match and they have not created one yet.
  const [currentPM, setCurrentPM] = useState<ProjectManager | null>(null);
  const [pmLoading, setPMLoading] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [selectedGCId, setSelectedGCId] = useState<string | null>(null);
  const [dashboardBack, setDashboardBack] = useState<'landing' | 'pm-home'>('landing');

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

  function handleSelectPM() {
    setScreen(currentPM ? 'pm-home' : 'pm-name');
  }

  function handlePMCreated(pm: ProjectManager) {
    setCurrentPM(pm);
    setConfirmationMessage('');
    setScreen('pm-home');
  }

  function handleReportComplete(gcName: string) {
    setConfirmationMessage(`Rating submitted for ${gcName}. Thank you.`);
    setScreen('pm-home');
  }

  const headerSubtitle =
    screen === 'gc-dashboard' ? 'GC Performance Dashboard' :
    screen === 'csv-upload' ? 'Upload Bid Data' :
    'GC Rating System';

  function handleHome() {
    setScreen('landing');
    setConfirmationMessage('');
  }

  function handleSignOut() {
    clearSupabaseToken();
    setCurrentPM(null);
    setScreen('landing');
    instance.logoutRedirect();
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-navy-900 text-white">
        <Header subtitle="GC Rating System" />
        {inProgress !== InteractionStatus.None ? <LoadingSpinner /> : <LoginScreen />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white">
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
          {screen === 'landing' && (
            <LandingScreen
              onSelectPM={handleSelectPM}
              onSelectEstimator={() => { setDashboardBack('landing'); setScreen('gc-dashboard'); }}
            />
          )}

          {screen === 'pm-name' && account && (
            <PMNameScreen
              account={account}
              onCreated={handlePMCreated}
              onBack={() => setScreen('landing')}
            />
          )}

          {screen === 'pm-home' && currentPM && (
            <PMHomeScreen
              pm={currentPM}
              confirmationMessage={confirmationMessage}
              onAddReport={() => { setConfirmationMessage(''); setScreen('pm-add-report'); }}
              onViewDashboard={() => { setDashboardBack('pm-home'); setScreen('gc-dashboard'); }}
              onBack={() => setScreen('landing')}
            />
          )}

          {screen === 'pm-add-report' && currentPM && (
            <AddReportFlow
              pm={currentPM}
              onComplete={handleReportComplete}
              onBack={() => setScreen('pm-home')}
              onHome={handleHome}
            />
          )}

          {screen === 'gc-dashboard' && (
            <GCDashboard
              onBack={() => setScreen(dashboardBack)}
              backLabel={dashboardBack === 'pm-home' ? '← Back to Home' : '← Back'}
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
