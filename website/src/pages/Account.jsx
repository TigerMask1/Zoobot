import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/Card';
import { useToast } from '../components/Toast';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Palette,
  LogOut,
  ExternalLink,
  Check
} from 'lucide-react';

export default function Account() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    discordNotifications: true,
    marketingEmails: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });
      
      if (response.ok) {
        toast.success('Preferences saved successfully!');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Account Settings
        </h1>
        <p className="text-surface-600">
          Manage your account information and preferences.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} className="text-primary-500" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your Discord account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <img
                src={user?.avatar 
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                  : `https://cdn.discordapp.com/embed/avatars/${parseInt(user?.discriminator || '0') % 5}.png`
                }
                alt={user?.username}
                className="w-20 h-20 rounded-xl ring-4 ring-surface-100 shadow-soft"
              />
              <div>
                <h3 className="text-xl font-semibold text-surface-900">
                  {user?.global_name || user?.username}
                </h3>
                <p className="text-surface-500">@{user?.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="badge-primary">
                    <Shield size={12} className="mr-1" />
                    Discord Connected
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up animate-delay-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} className="text-primary-500" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to be notified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates and alerts via email' },
                { key: 'discordNotifications', label: 'Discord Notifications', desc: 'Get notified through Discord DMs' },
                { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Receive news about new features and events' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-surface-50">
                  <div>
                    <p className="font-medium text-surface-900">{label}</p>
                    <p className="text-sm text-surface-500">{desc}</p>
                  </div>
                  <button
                    onClick={() => setPreferences(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      preferences[key] ? 'bg-primary-500' : 'bg-surface-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      preferences[key] ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <button
              onClick={handleSavePreferences}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : (
                <>
                  <Check size={18} className="mr-2" />
                  Save Preferences
                </>
              )}
            </button>
          </CardFooter>
        </Card>

        <Card className="animate-slide-up animate-delay-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} className="text-primary-500" />
              Connected Services
            </CardTitle>
            <CardDescription>
              Third-party services linked to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-surface-900">Discord</p>
                  <p className="text-sm text-surface-500">Connected as @{user?.username}</p>
                </div>
              </div>
              <span className="badge-success">
                <Check size={12} className="mr-1" />
                Connected
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up animate-delay-300 border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent-red">
              <LogOut size={20} />
              Sign Out
            </CardTitle>
            <CardDescription>
              Sign out of your account on this device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-surface-600 mb-4">
              You'll need to sign in again with Discord to access your dashboard.
            </p>
            <button
              onClick={logout}
              className="btn-danger"
            >
              <LogOut size={18} className="mr-2" />
              Sign Out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
