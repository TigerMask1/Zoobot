import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { 
  Server, 
  Package, 
  FileText, 
  User, 
  TrendingUp,
  Users,
  Coins,
  Star,
  ArrowRight,
  Clock
} from 'lucide-react';

const quickActions = [
  { icon: Server, label: 'My Servers', path: '/dashboard/servers', color: 'from-blue-500 to-cyan-500' },
  { icon: Package, label: 'Bundles', path: '/dashboard/bundles', color: 'from-purple-500 to-indigo-500' },
  { icon: FileText, label: 'Submissions', path: '/dashboard/submissions', color: 'from-emerald-500 to-teal-500' },
  { icon: User, label: 'Account', path: '/dashboard/account', color: 'from-pink-500 to-rose-500' },
];

export default function Dashboard() {
  const { user, guilds } = useAuth();

  const managedGuilds = guilds.filter(g => 
    (parseInt(g.permissions) & 0x20) === 0x20 || g.owner
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Welcome back, {user?.global_name || user?.username}!
        </h1>
        <p className="text-surface-600">
          Manage your servers, submissions, and account settings from here.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {quickActions.map((action, index) => (
          <Link
            key={action.path}
            to={action.path}
            className="card-hover p-6 group animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
              <action.icon size={24} className="text-white" />
            </div>
            <h3 className="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
              {action.label}
            </h3>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="animate-slide-up animate-delay-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server size={20} className="text-primary-500" />
              Your Servers
            </CardTitle>
            <CardDescription>
              Servers where you have admin permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {managedGuilds.length === 0 ? (
              <div className="text-center py-8 text-surface-500">
                <Server size={40} className="mx-auto mb-3 opacity-50" />
                <p>No servers with admin access found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {managedGuilds.slice(0, 5).map(guild => (
                  <div 
                    key={guild.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors"
                  >
                    {guild.icon ? (
                      <img
                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                        alt={guild.name}
                        className="w-10 h-10 rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center">
                        <span className="text-surface-600 font-semibold">
                          {guild.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 truncate">
                        {guild.name}
                      </p>
                      {guild.owner && (
                        <span className="badge-primary text-xs">Owner</span>
                      )}
                    </div>
                  </div>
                ))}
                {managedGuilds.length > 5 && (
                  <Link 
                    to="/dashboard/servers"
                    className="flex items-center justify-center gap-2 py-3 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View all {managedGuilds.length} servers
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-slide-up animate-delay-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} className="text-primary-500" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Your latest actions and events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-surface-500">
              <Clock size={40} className="mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm mt-1">Start using the bot to see your activity here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 animate-slide-up animate-delay-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star size={20} className="text-accent-yellow" />
            Quick Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
              <h4 className="font-semibold text-blue-900 mb-1">Configure Your Servers</h4>
              <p className="text-sm text-blue-700">
                Set up drop channels, game bundles, and notification settings for each server.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
              <h4 className="font-semibold text-purple-900 mb-1">Submit Characters</h4>
              <p className="text-sm text-purple-700">
                Create and submit your own character ideas to be added to the game.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
              <h4 className="font-semibold text-emerald-900 mb-1">Manage Bundles</h4>
              <p className="text-sm text-emerald-700">
                Choose which character bundles are active in your servers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
