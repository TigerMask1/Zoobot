import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  Package, 
  FileText, 
  User, 
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/servers', label: 'My Servers', icon: Server },
  { path: '/dashboard/bundles', label: 'Bundles', icon: Package },
  { path: '/dashboard/submissions', label: 'Submissions', icon: FileText },
  { path: '/dashboard/account', label: 'Account', icon: User },
];

const bottomItems = [
  { path: '/dashboard/help', label: 'Help & Support', icon: HelpCircle },
  { path: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <aside 
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-surface-200 transition-all duration-300 z-40 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full py-4">
        <div className="flex-1 px-3 space-y-1">
          {menuItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive(path)
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon size={20} className={`flex-shrink-0 ${isActive(path) ? 'text-primary-500' : ''}`} />
              {!collapsed && (
                <span className="font-medium text-sm">{label}</span>
              )}
              {isActive(path) && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
              )}
            </Link>
          ))}
        </div>

        <div className="px-3 pt-4 border-t border-surface-100 space-y-1">
          {bottomItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive(path)
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm">{label}</span>
              )}
            </Link>
          ))}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-3 mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-all duration-200"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
