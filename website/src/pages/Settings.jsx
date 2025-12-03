import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { useToast } from '../components/Toast';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Globe,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    compactMode: false,
  });

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const handleThemeChange = (themeId) => {
    setSettings(prev => ({ ...prev, theme: themeId }));
    toast.info(`Theme set to ${themeId}`);
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Settings
        </h1>
        <p className="text-surface-600">
          Customize your dashboard experience.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette size={20} className="text-primary-500" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose how the dashboard looks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {themes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    settings.theme === id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  <Icon 
                    size={24} 
                    className={`mx-auto mb-2 ${
                      settings.theme === id ? 'text-primary-600' : 'text-surface-500'
                    }`} 
                  />
                  <p className={`text-sm font-medium ${
                    settings.theme === id ? 'text-primary-700' : 'text-surface-700'
                  }`}>
                    {label}
                  </p>
                </button>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-surface-50 rounded-xl">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">Compact Mode</p>
                  <p className="text-sm text-surface-500">Reduce spacing and padding</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, compactMode: !prev.compactMode }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.compactMode ? 'bg-primary-500' : 'bg-surface-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.compactMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up animate-delay-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} className="text-primary-500" />
              Language & Region
            </CardTitle>
            <CardDescription>
              Set your preferred language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={settings.language}
              onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
              className="input"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
            <p className="text-sm text-surface-500 mt-2">
              More languages coming soon!
            </p>
          </CardContent>
        </Card>

        <Card className="animate-slide-up animate-delay-200 bg-surface-50 border-dashed">
          <CardContent className="py-8 text-center">
            <SettingsIcon size={40} className="mx-auto mb-3 text-surface-400" />
            <p className="text-surface-600">
              More settings options coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
