import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { 
  Server, 
  Settings, 
  Bell, 
  Package, 
  Hash,
  Check,
  X,
  ExternalLink,
  Crown,
  Shield
} from 'lucide-react';

export default function Servers() {
  const { guilds, refreshGuilds } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverConfig, setServerConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  const managedGuilds = guilds.filter(g => 
    (parseInt(g.permissions) & 0x20) === 0x20 || g.owner
  );

  const loadServerConfig = async (guildId) => {
    setConfigLoading(true);
    try {
      const response = await fetch(`/api/servers/${guildId}/config`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setServerConfig(data);
      } else {
        toast.error('Failed to load server configuration');
      }
    } catch (err) {
      console.error('Failed to load server config:', err);
      toast.error('Failed to load server configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleServerClick = (guild) => {
    setSelectedServer(guild);
    loadServerConfig(guild.id);
  };

  const updateConfig = async (key, value) => {
    if (!selectedServer) return;
    
    try {
      const response = await fetch(`/api/servers/${selectedServer.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
      
      if (response.ok) {
        setServerConfig(prev => ({ ...prev, [key]: value }));
        toast.success('Configuration updated!');
      } else {
        toast.error('Failed to update configuration');
      }
    } catch (err) {
      console.error('Failed to update config:', err);
      toast.error('Failed to update configuration');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          My Servers
        </h1>
        <p className="text-surface-600">
          Configure bot settings for servers where you have admin permissions.
        </p>
      </div>

      {managedGuilds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Server size={48} className="mx-auto mb-4 text-surface-400" />
            <h3 className="text-xl font-semibold text-surface-900 mb-2">
              No Servers Found
            </h3>
            <p className="text-surface-600 mb-6">
              You don't have admin access to any servers with the bot installed.
            </p>
            <a 
              href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Add Bot to Server
              <ExternalLink size={16} className="ml-2" />
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {managedGuilds.map((guild, index) => (
            <div
              key={guild.id}
              onClick={() => handleServerClick(guild)}
              className="card-hover p-6 cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4 mb-4">
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`}
                    alt={guild.name}
                    className="w-14 h-14 rounded-xl shadow-soft"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-surface-200 to-surface-300 flex items-center justify-center">
                    <span className="text-xl font-bold text-surface-600">
                      {guild.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-900 truncate">
                    {guild.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {guild.owner ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Crown size={12} />
                        Owner
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                        <Shield size={12} />
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-surface-500">
                <span>Click to configure</span>
                <Settings size={16} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selectedServer}
        onClose={() => {
          setSelectedServer(null);
          setServerConfig(null);
        }}
        title={selectedServer?.name}
        size="lg"
      >
        {configLoading ? (
          <div className="py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : serverConfig ? (
          <div className="space-y-6">
            <div className="p-4 bg-surface-50 rounded-xl">
              <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Package size={18} />
                Game Bundle
              </h4>
              <select 
                value={serverConfig.game || 'default'}
                onChange={(e) => updateConfig('game', e.target.value)}
                className="input"
              >
                <option value="default">Default Bundle</option>
                <option value="animals">Animals</option>
                <option value="fantasy">Fantasy</option>
                <option value="scifi">Sci-Fi</option>
              </select>
            </div>

            <div className="p-4 bg-surface-50 rounded-xl">
              <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Hash size={18} />
                Drop Channel
              </h4>
              <input
                type="text"
                value={serverConfig.dropChannelId || ''}
                onChange={(e) => updateConfig('dropChannelId', e.target.value)}
                placeholder="Channel ID for drops"
                className="input"
              />
            </div>

            <div className="p-4 bg-surface-50 rounded-xl">
              <h4 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Bell size={18} />
                Notifications
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'dropPing', label: 'Ping on drops' },
                  { key: 'eventPing', label: 'Ping on events' },
                  { key: 'giveawayPing', label: 'Ping on giveaways' },
                  { key: 'lotteryPing', label: 'Ping on lottery' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between">
                    <span className="text-surface-700">{label}</span>
                    <button
                      onClick={() => updateConfig(key, !serverConfig[key])}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        serverConfig[key] ? 'bg-primary-500' : 'bg-surface-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        serverConfig[key] ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-surface-500">
            <p>Server configuration not available.</p>
            <p className="text-sm mt-1">Make sure the bot is in this server.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
