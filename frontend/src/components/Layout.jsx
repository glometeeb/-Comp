import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { profile, isEditor } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded text-sm font-medium ${pathname.startsWith(to) ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-blue-800 text-white px-6 py-3 flex items-center gap-4 shadow">
        <Link to="/" className="font-bold text-lg tracking-tight mr-4">CostTrack</Link>
        {navLink('/', 'Dashboard')}
        {isEditor && navLink('/upload', 'Upload')}
        {isEditor && navLink('/settings/users', 'Users')}
        {navLink('/settings/sync-log', 'Sync Log')}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-blue-200">{profile?.full_name || ''}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isEditor ? 'bg-amber-400 text-amber-900' : 'bg-blue-600'}`}>
            {profile?.role || 'VIEWER'}
          </span>
          <button onClick={handleSignOut} className="text-blue-200 hover:text-white ml-2">Sign out</button>
        </div>
      </nav>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
