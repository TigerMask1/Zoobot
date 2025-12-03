import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  Users, 
  Trophy, 
  Gamepad2, 
  ArrowRight,
  Star,
  Zap,
  Shield,
  Gift
} from 'lucide-react';

const features = [
  {
    icon: Gamepad2,
    title: '50+ Unique Characters',
    description: 'Collect and battle with a diverse roster of characters, each with unique abilities and stats.',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    icon: Trophy,
    title: 'Competitive Events',
    description: 'Participate in daily challenges, tournaments, and seasonal events to earn exclusive rewards.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Users,
    title: 'Active Community',
    description: 'Join thousands of players trading, battling, and competing on leaderboards.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Gift,
    title: 'Rich Economy',
    description: 'Multiple currencies, trading systems, auctions, and a dynamic marketplace.',
    color: 'from-pink-500 to-rose-500',
  },
];

const stats = [
  { label: 'Active Users', value: '10K+' },
  { label: 'Characters', value: '50+' },
  { label: 'Servers', value: '500+' },
  { label: 'Daily Drops', value: '100K+' },
];

export default function Home() {
  const { isAuthenticated, login } = useAuth();

  return (
    <div className="min-h-screen">
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-surface-100" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full text-primary-700 text-sm font-medium mb-8 animate-fade-in">
            <Sparkles size={16} />
            The Ultimate Discord Collection Bot
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-surface-900 mb-6 animate-slide-up">
            Collect. Battle.{' '}
            <span className="gradient-text">Dominate.</span>
          </h1>
          
          <p className="text-xl text-surface-600 max-w-2xl mx-auto mb-10 animate-slide-up animate-delay-100">
            Build your ultimate character collection, compete in epic battles, 
            and rise through the ranks in the most engaging Discord bot experience.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up animate-delay-200">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary text-lg px-8 py-3">
                Go to Dashboard
                <ArrowRight size={20} className="ml-2" />
              </Link>
            ) : (
              <button onClick={login} className="btn-primary text-lg px-8 py-3">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Get Started with Discord
              </button>
            )}
            <a 
              href="https://discord.gg/your-server" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary text-lg px-8 py-3"
            >
              Join Our Server
            </a>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white border-y border-surface-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={stat.label} 
                className="text-center animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-3xl md:text-4xl font-display font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-surface-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-surface-900 mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-lg text-surface-600 max-w-2xl mx-auto">
              Packed with features designed for the ultimate collection experience
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="card-hover p-8 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <feature.icon size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold text-surface-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-surface-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={24} className="text-accent-yellow fill-accent-yellow" />
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
            Ready to Start Your Collection?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of collectors and start your journey today.
          </p>
          {isAuthenticated ? (
            <Link 
              to="/dashboard" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl font-semibold text-lg shadow-elevated hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              Open Dashboard
              <ArrowRight size={20} />
            </Link>
          ) : (
            <button 
              onClick={login}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl font-semibold text-lg shadow-elevated hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              <Zap size={20} />
              Get Started Free
            </button>
          )}
        </div>
      </section>

      <footer className="py-12 px-4 bg-surface-900 text-surface-400">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-xl">🎮</span>
              </div>
              <span className="font-display font-bold text-lg text-white">
                Zoo Collection
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <Link to="/features" className="hover:text-white transition-colors">Features</Link>
              <a href="#" className="hover:text-white transition-colors">Support</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
            
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-lg bg-surface-800 flex items-center justify-center hover:bg-surface-700 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-surface-800 text-center text-sm">
            &copy; {new Date().getFullYear()} Zoo Collection Bot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
