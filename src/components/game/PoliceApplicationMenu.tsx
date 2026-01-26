import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Shield, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PoliceApplicationMenuProps {
  character: any;
  onClose: () => void;
}

export default function PoliceApplicationMenu({ character, onClose }: PoliceApplicationMenuProps) {
  const [reason, setReason] = useState('');
  const [experience, setExperience] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExistingApplication();
  }, []);

  const fetchExistingApplication = async () => {
    const { data } = await supabase
      .from('game_police_applications')
      .select('*')
      .eq('character_id', character.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setExistingApplication(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for applying');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('game_police_applications').insert({
        character_id: character.id,
        user_id: user.id,
        character_name: character.name,
        reason: reason.trim(),
        experience: experience.trim() || null
      });

      if (error) throw error;

      toast.success('Application submitted! Wait for admin review.');
      fetchExistingApplication();
    } catch (error) {
      toast.error('Failed to submit application');
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-yellow-500">
            <Clock className="w-4 h-4" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle className="w-4 h-4" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="w-4 h-4" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            Police Application
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {character.current_job === 'police' ? (
          <div className="text-center py-8">
            <Shield className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            <p className="text-lg font-medium">You are already a Police Officer!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Protect the city and arrest criminals.
            </p>
          </div>
        ) : existingApplication ? (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium">Your Application</p>
                {getStatusBadge(existingApplication.status)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Submitted: {new Date(existingApplication.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm">{existingApplication.reason}</p>
              
              {existingApplication.admin_notes && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Admin Notes:</p>
                  <p className="text-sm">{existingApplication.admin_notes}</p>
                </div>
              )}
            </div>

            {existingApplication.status === 'rejected' && (
              <Button className="w-full" onClick={() => setExistingApplication(null)}>
                Submit New Application
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Apply to join the CF City Police Department. Your application will be reviewed by administrators.
            </p>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Why do you want to be a police officer? *
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="I want to protect the citizens of CF City..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Previous roleplay experience (optional)
              </label>
              <Textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="I have played on other RP servers..."
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
