import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { 
  HelpCircle, 
  MessageCircle, 
  Book, 
  ExternalLink,
  Mail,
  FileQuestion
} from 'lucide-react';

const helpTopics = [
  {
    question: 'How do I start collecting characters?',
    answer: 'Characters drop randomly in configured channels. When a drop appears, be the first to react or type the catch command to claim it!',
  },
  {
    question: 'What are character keys?',
    answer: 'Character keys are an alternative way to unlock characters. Collect 750 keys for a specific character to unlock them. Keys drop during Key Rush events and have a 15% chance during normal gameplay.',
  },
  {
    question: 'How do I configure the bot for my server?',
    answer: 'Go to the "My Servers" section in the dashboard. Click on your server to access settings like drop channels, game bundles, and notification preferences.',
  },
  {
    question: 'How do character bundles work?',
    answer: 'Bundles are collections of characters themed around specific games or categories. Each server can choose which bundle is active for drops and crates.',
  },
  {
    question: 'Can I submit my own character ideas?',
    answer: 'Yes! Use the Submissions page to submit your character ideas. Include details like name, abilities, and optionally an image. Our team reviews all submissions.',
  },
];

export default function Help() {
  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Help & Support
        </h1>
        <p className="text-surface-600">
          Find answers to common questions and get help.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="p-6 animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <MessageCircle size={24} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">Discord Server</h3>
              <p className="text-sm text-surface-500">Join for live support</p>
            </div>
          </div>
          <a 
            href="https://discord.gg/your-server" 
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full mt-4"
          >
            Join Server
            <ExternalLink size={16} className="ml-2" />
          </a>
        </Card>

        <Card className="p-6 animate-slide-up animate-delay-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Book size={24} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">Documentation</h3>
              <p className="text-sm text-surface-500">Read the full guide</p>
            </div>
          </div>
          <a 
            href="/features" 
            className="btn-secondary w-full mt-4"
          >
            View Docs
            <ExternalLink size={16} className="ml-2" />
          </a>
        </Card>
      </div>

      <Card className="animate-slide-up animate-delay-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion size={20} className="text-primary-500" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {helpTopics.map((topic, index) => (
              <div 
                key={index}
                className="p-4 rounded-lg bg-surface-50 hover:bg-surface-100 transition-colors"
              >
                <h4 className="font-semibold text-surface-900 mb-2">
                  {topic.question}
                </h4>
                <p className="text-surface-600 text-sm">
                  {topic.answer}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 animate-slide-up animate-delay-300">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Mail size={24} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900">Still need help?</h3>
              <p className="text-sm text-surface-500">
                Join our Discord server and ask in the support channel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
