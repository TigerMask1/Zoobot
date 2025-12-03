import { 
  Gamepad2, 
  Sword, 
  Coins, 
  Package, 
  Users, 
  Trophy,
  Gift,
  Calendar,
  Shield,
  Settings,
  Key,
  Sparkles
} from 'lucide-react';

const features = [
  {
    category: 'Character System',
    icon: Gamepad2,
    color: 'from-purple-500 to-indigo-500',
    items: [
      '50+ unique characters with individual stats and abilities',
      'Character leveling and progression system',
      'Custom character skins and cosmetics',
      'Character key collection system (750 keys to unlock)',
      'Community character submissions',
    ],
  },
  {
    category: 'Battle System',
    icon: Sword,
    color: 'from-red-500 to-orange-500',
    items: [
      'Turn-based combat with energy management',
      'Passive abilities and status effects',
      'Critical hits and damage calculations',
      'AI battles with dynamic difficulty',
      'Consumable items and power-ups',
    ],
  },
  {
    category: 'Economy',
    icon: Coins,
    color: 'from-amber-500 to-yellow-500',
    items: [
      'Multiple currencies (Coins, Gems, Trophies, Tokens, UST)',
      'Player trading system',
      'Universal marketplace',
      'Time-based auctions',
      'Daily work and rewards',
    ],
  },
  {
    category: 'Drops & Crates',
    icon: Package,
    color: 'from-emerald-500 to-teal-500',
    items: [
      'Random character token drops',
      'Coin, gem, and shard drops',
      'Character key drops (15% chance)',
      'Key Rush events (all drops become keys)',
      'Multi-tiered crate system',
    ],
  },
  {
    category: 'Events & Competitions',
    icon: Trophy,
    color: 'from-blue-500 to-cyan-500',
    items: [
      'Daily rotating competitive events',
      'Seasonal event passes',
      'Global leaderboards',
      'Weekly challenges',
      'Giveaways and lottery system',
    ],
  },
  {
    category: 'Server Management',
    icon: Settings,
    color: 'from-pink-500 to-rose-500',
    items: [
      'Per-server feature toggles',
      'Game bundle selection',
      'Drop channel configuration',
      'Role-based ping settings',
      'Admin permission system',
    ],
  },
];

export default function Features() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full text-primary-700 text-sm font-medium mb-6">
            <Sparkles size={16} />
            Feature-Packed
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-surface-900 mb-6">
            Powerful Features for Every{' '}
            <span className="gradient-text">Collector</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-2xl mx-auto">
            Explore all the features that make Zoo Collection the most comprehensive Discord bot experience.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto space-y-8">
          {features.map((feature, index) => (
            <div 
              key={feature.category}
              className="card p-8 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}>
                    <feature.icon size={32} className="text-white" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-surface-900 mb-4">
                    {feature.category}
                  </h2>
                  <ul className="grid md:grid-cols-2 gap-3">
                    {feature.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                        <span className="text-surface-600">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 bg-surface-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-display font-bold text-surface-900 mb-4">
            And Much More...
          </h2>
          <p className="text-lg text-surface-600 mb-8">
            We're constantly adding new features based on community feedback. 
            Join our Discord server to suggest new ideas and stay updated!
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Mail System', 'Q&A System', 'Trivia Games', 'Clans', 'Caretaking', 'Mini Games', 'Achievements', 'Crafting'].map(tag => (
              <span key={tag} className="badge-primary px-4 py-1.5 text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
