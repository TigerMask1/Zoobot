import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Send,
  Image,
  Sparkles
} from 'lucide-react';

const STATUS_STYLES = {
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending Review' },
  approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Rejected' },
  revision: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Needs Revision' },
};

export default function Submissions() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    characterName: '',
    description: '',
    abilities: '',
    rarity: 'common',
    imageUrl: '',
    notes: '',
  });

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/submissions', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.characterName.trim()) {
      toast.error('Please enter a character name');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Character submitted successfully!');
        setShowModal(false);
        setFormData({
          characterName: '',
          description: '',
          abilities: '',
          rarity: 'common',
          imageUrl: '',
          notes: '',
        });
        loadSubmissions();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to submit character');
      }
    } catch (err) {
      console.error('Failed to submit:', err);
      toast.error('Failed to submit character');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
            Character Submissions
          </h1>
          <p className="text-surface-600">
            Submit your character ideas to be added to the game.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          New Submission
        </button>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles size={48} className="mx-auto mb-4 text-surface-400" />
            <h3 className="text-xl font-semibold text-surface-900 mb-2">
              No Submissions Yet
            </h3>
            <p className="text-surface-600 mb-6">
              Be the first to submit a character idea!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              Create Your First Submission
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission, index) => {
            const status = STATUS_STYLES[submission.status] || STATUS_STYLES.pending;
            const StatusIcon = status.icon;
            
            return (
              <Card 
                key={submission.id || index}
                className="p-6 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-surface-900">
                        {submission.characterName}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                        <StatusIcon size={14} />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-surface-600 text-sm line-clamp-2">
                      {submission.description || 'No description provided'}
                    </p>
                    <p className="text-surface-400 text-xs mt-2">
                      Submitted {new Date(submission.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {submission.imageUrl && (
                    <div className="w-20 h-20 rounded-lg bg-surface-100 overflow-hidden flex-shrink-0">
                      <img 
                        src={submission.imageUrl} 
                        alt={submission.characterName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {submission.feedback && (
                  <div className="mt-4 p-3 bg-surface-50 rounded-lg border border-surface-100">
                    <p className="text-sm font-medium text-surface-700 mb-1">Admin Feedback:</p>
                    <p className="text-sm text-surface-600">{submission.feedback}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Submit New Character"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Character Name *</label>
            <input
              type="text"
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              placeholder="e.g., Sparkle the Dragon"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your character's appearance and personality..."
              className="input min-h-[100px] resize-none"
              rows={4}
            />
          </div>

          <div>
            <label className="label">Abilities / Moves</label>
            <textarea
              value={formData.abilities}
              onChange={(e) => setFormData({ ...formData, abilities: e.target.value })}
              placeholder="List their special abilities or moves..."
              className="input min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rarity</label>
              <select
                value={formData.rarity}
                onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                className="input"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
            <div>
              <label className="label">Image URL (optional)</label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any other details you'd like to share..."
              className="input min-h-[60px] resize-none"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={18} className="mr-2" />
                  Submit Character
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
