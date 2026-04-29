/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './hooks/useAuth';

// Layouts
import { StaffLayout } from './components/StaffLayout';
import { AdminLayout } from './components/AdminLayout';

// Pages
import Login from './pages/Login';
const POS = lazy(() => import('./pages/POS'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminInventory = lazy(() => import('./pages/AdminInventory'));
const AdminTransactions = lazy(() => import('./pages/AdminTransactions'));
const AdminStaff = lazy(() => import('./pages/AdminStaff'));
const AdminDebt = lazy(() => import('./pages/AdminDebt'));
const AdminAdashe = lazy(() => import('./pages/AdminAdashe'));

const Loading = () => <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">Loading...</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Staff Routes */}
            <Route path="/" element={<StaffLayout />}>
              <Route index element={<POS />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="debt" element={<AdminDebt />} />
              <Route path="adashe" element={<AdminAdashe />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
