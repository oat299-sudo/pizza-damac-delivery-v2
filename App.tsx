
import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { CustomerView } from './views/CustomerView';
import { KitchenView } from './views/KitchenView';
import { POSView } from './views/POSView';
import { TrackView } from './views/TrackView';
import { Lock, ArrowLeft, User, Key, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from './services/supabaseClient';

const MainLayout = () => {
  const { currentView, navigateTo, isAdminLoggedIn, adminLogin, t } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Helper to handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const success = await adminLogin(username, password);
    setIsLoggingIn(false);
    if (success) {
      setError(false);
      setUsername('');
      setPassword('');
    } else {
      setError(true);
      setPassword('');
    }
  };

  // Render Logic
  if (currentView === 'customer') {
    return <CustomerView />;
  }

  // Auth Guard for Protected Views
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-800">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{t('staffAccess')}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {currentView === 'kitchen' ? t('kitchenDisplay') : t('pos')}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.trim()); // Trim whitespace
                    setError(false);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  placeholder="..."
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">{t('password')}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  placeholder="..."
                />
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-500 text-xs p-3 rounded-lg text-center font-bold animate-pulse">
                Invalid credentials.
              </div>
            )}
            
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg mt-2 disabled:opacity-50"
            >
              {isLoggingIn ? '...' : t('login')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button 
              onClick={() => navigateTo('customer')}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition"
            >
              <ArrowLeft size={16} /> {t('backToHome')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Protected Routes
  if (currentView === 'kitchen') return <KitchenView />;
  if (currentView === 'pos') return <POSView />;
  if (currentView === 'track') return <TrackView />;

  return <CustomerView />; // Fallback
};

const App = () => {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900 w-full max-w-full overflow-x-hidden">
        {!isSupabaseConfigured && (
          <div className="bg-red-600 text-white text-center p-2 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
            <AlertTriangle size={16} />
            DATABASE DISCONNECTED: Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Netlify Settings.
          </div>
        )}
        <MainLayout />
      </div>
    </StoreProvider>
  );
};

export default App;
