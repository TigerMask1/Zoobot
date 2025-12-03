import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/features', label: 'Features', icon: Sparkles },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-surface-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow group-hover:shadow-elevated transition-all duration-300">
                <span className="text-xl">🎮</span>
              </div>
              <span className="font-display font-bold text-xl text-surface-900 hidden sm:block">
                Zoo Collection
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(path)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-100 transition-all duration-200"
                >
                  <img
                    src={user.avatar 
                      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
                      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`
                    }
                    alt={user.username}
                    className="w-8 h-8 rounded-full ring-2 ring-surface-200"
                  />
                  <span className="hidden sm:block font-medium text-surface-800">
                    {user.global_name || user.username}
                  </span>
                  <ChevronDown size={16} className={`text-surface-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserMenuOpen(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-56 py-2 bg-white rounded-xl shadow-elevated border border-surface-200 z-50 animate-scale-in origin-top-right">
                      <div className="px-4 py-3 border-b border-surface-100">
                        <p className="text-sm font-semibold text-surface-900">
                          {user.global_name || user.username}
                        </p>
                        <p className="text-xs text-surface-500">
                          @{user.username}
                        </p>
                      </div>
                      
                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                      >
                        <LayoutDashboard size={18} />
                        Dashboard
                      </Link>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-accent-red hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={login}
                className="btn-primary"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Login with Discord
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden btn-ghost p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-surface-200 animate-slide-down">
            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  isActive(path)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-surface-600'
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
