import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

import Home from './pages/Home';
import Features from './pages/Features';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Bundles from './pages/Bundles';
import Submissions from './pages/Submissions';
import Account from './pages/Account';
import Help from './pages/Help';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/features" element={<Features />} />
              <Route path="/login" element={<Login />} />
            </Route>
            
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="servers" element={<Servers />} />
              <Route path="bundles" element={<Bundles />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="account" element={<Account />} />
              <Route path="help" element={<Help />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
