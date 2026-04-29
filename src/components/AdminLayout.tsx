import { useAuth } from '../hooks/useAuth';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, FileText, LogOut, Receipt, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

export function AdminLayout() {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">Checking authorizations...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Inventory', path: '/admin/inventory', icon: Package },
    { name: 'Transactions', path: '/admin/transactions', icon: FileText },
    { name: 'Customer Debt', path: '/admin/debt', icon: Receipt },
    { name: 'Adashe Savings', path: '/admin/adashe', icon: TrendingUp },
    { name: 'Staff Auth', path: '/admin/staff', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Mazaya Admin</h1>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group",
                  isActive 
                    ? "bg-gray-900 text-white" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 mr-3 flex-shrink-0 transition-colors",
                  isActive ? "text-gray-300" : "text-gray-400 group-hover:text-gray-500"
                )} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button onClick={signOut} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
