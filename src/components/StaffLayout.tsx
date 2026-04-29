import { useAuth } from '../hooks/useAuth';
import { Navigate, Outlet, Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export function StaffLayout() {
  const { user, signOut, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect admins away from the staff/POS interface if they should only have admin console access
  if (user.role === 'admin' || user.role === 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white font-bold leading-none">MK</div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Mazaya <span className="text-indigo-600">Kitchen</span></h1>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold uppercase tracking-wider">
            {user.role}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Session</p>
            <p className="text-sm font-bold">{user.name || user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 uppercase">
              {(user.name || user.email || 'U').charAt(0)}
            </div>
            <button 
              onClick={signOut}
              className="p-2 ml-1 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
