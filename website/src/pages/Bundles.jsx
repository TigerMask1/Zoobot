import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { 
  Package, 
  Users, 
  Sparkles,
  Check,
  ChevronRight,
  Search
} from 'lucide-react';

const BUNDLES = [
  {
    id: 'default',
    name: 'Default Bundle',
    description: 'The original character collection with 50+ unique characters.',
    characterCount: 50,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'animals',
    name: 'Animal Kingdom',
    description: 'Cute and wild animals from around the world.',
    characterCount: 35,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'fantasy',
    name: 'Fantasy Realm',
    description: 'Dragons, wizards, and mythical creatures.',
    characterCount: 40,
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'scifi',
    name: 'Sci-Fi Universe',
    description: 'Robots, aliens, and futuristic heroes.',
    characterCount: 30,
    color: 'from-pink-500 to-rose-500',
  },
];

export default function Bundles() {
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState([]);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bundles', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBundles(data.bundles || BUNDLES);
      } else {
        setBundles(BUNDLES);
      }
    } catch (err) {
      console.error('Failed to load bundles:', err);
      setBundles(BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  const loadBundleCharacters = async (bundleId) => {
    try {
      const response = await fetch(`/api/bundles/${bundleId}/characters`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
      setCharacters([]);
    }
  };

  const handleBundleClick = (bundle) => {
    setSelectedBundle(bundle);
    loadBundleCharacters(bundle.id);
  };

  const filteredCharacters = characters.filter(char =>
    char.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Character Bundles
        </h1>
        <p className="text-surface-600">
          Explore different character bundles available for your servers.
        </p>
      </div>

      {selectedBundle ? (
        <div className="animate-fade-in">
          <button
            onClick={() => {
              setSelectedBundle(null);
              setCharacters([]);
              setSearchQuery('');
            }}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6 font-medium"
          >
            <ChevronRight size={16} className="rotate-180" />
            Back to Bundles
          </button>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedBundle.color} flex items-center justify-center shadow-lg`}>
                  <Package size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-surface-900">
                    {selectedBundle.name}
                  </h2>
                  <p className="text-surface-600">{selectedBundle.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="relative mb-6">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>

          {characters.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Sparkles size={48} className="mx-auto mb-4 text-surface-400" />
                <p className="text-surface-600">
                  Character list not available. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCharacters.map((char, index) => (
                <Card 
                  key={char.id || index}
                  className="p-4 animate-slide-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-surface-100 flex items-center justify-center text-2xl">
                      {char.emoji || '🎭'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900">{char.name}</h3>
                      <p className="text-sm text-surface-500">
                        {char.rarity || 'Common'}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {(bundles.length > 0 ? bundles : BUNDLES).map((bundle, index) => (
            <div
              key={bundle.id}
              onClick={() => handleBundleClick(bundle)}
              className="card-hover p-6 cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${bundle.color} flex items-center justify-center shadow-lg`}>
                  <Package size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-surface-900">
                    {bundle.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-surface-500 mt-1">
                    <Users size={14} />
                    {bundle.characterCount} characters
                  </div>
                </div>
              </div>
              <p className="text-surface-600">{bundle.description}</p>
              <div className="flex items-center justify-end text-primary-600 font-medium mt-4">
                View Characters
                <ChevronRight size={16} className="ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
