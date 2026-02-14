import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, Users, Mail, MailOpen, Send, Plus, Search,
  Phone, Building2, Tag, Calendar, ChevronRight, Inbox,
  CheckCircle2, XCircle, Clock, Repeat, BarChart3, Zap,
  UserPlus, Trash2, Edit, ArrowUpRight
} from 'lucide-react';

type CRMStage = 'new' | 'welcome_sent' | 'warm' | 'booking' | 'follow_up' | 'successful' | 'not_interested' | 'try_again';

interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  stage: CRMStage;
  notes: string | null;
  tags: string[];
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CRMEmail {
  id: string;
  user_id: string;
  contact_id: string | null;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  direction: 'outbound' | 'inbound';
  status: string;
  created_at: string;
}

interface Subscription {
  id: string;
  started_at: string;
  expires_at: string;
  is_active: boolean;
}

const STAGES: { key: CRMStage; label: string; icon: any; color: string }[] = [
  { key: 'new', label: 'New', icon: UserPlus, color: 'bg-blue-500/20 text-blue-400' },
  { key: 'welcome_sent', label: 'Welcome Sent', icon: Send, color: 'bg-cyan-500/20 text-cyan-400' },
  { key: 'warm', label: 'Warm Lead', icon: Zap, color: 'bg-amber-500/20 text-amber-400' },
  { key: 'booking', label: 'Booking', icon: Calendar, color: 'bg-purple-500/20 text-purple-400' },
  { key: 'follow_up', label: 'Follow Up', icon: Repeat, color: 'bg-orange-500/20 text-orange-400' },
  { key: 'successful', label: 'Successful', icon: CheckCircle2, color: 'bg-green-500/20 text-green-400' },
  { key: 'not_interested', label: 'Not Interested', icon: XCircle, color: 'bg-red-500/20 text-red-400' },
  { key: 'try_again', label: 'Try Again', icon: Clock, color: 'bg-gray-500/20 text-gray-400' },
];

export default function CRM() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emails, setEmails] = useState<CRMEmail[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<CRMStage | 'all'>('all');

  // Add contact form
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  // Bulk import
  const [bulkEmails, setBulkEmails] = useState('');

  // Compose email
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchContacts(), fetchEmails(), fetchSubscription()]);
    setIsLoading(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (data) setContacts(data as Contact[]);
  };

  const fetchEmails = async () => {
    const { data } = await supabase
      .from('crm_emails')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setEmails(data as CRMEmail[]);
  };

  const fetchSubscription = async () => {
    const { data } = await supabase
      .from('crm_subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const isExpired = new Date(data.expires_at) < new Date();
      if (isExpired) {
        await supabase.from('crm_subscriptions').update({ is_active: false }).eq('id', data.id);
        setSubscription(null);
      } else {
        setSubscription(data as Subscription);
      }
    }
  };

  const handleActivateCRM = async () => {
    if ((profile?.sms_credits || 0) < 20) {
      toast.error('You need 20 credits to activate CRM (30 days)');
      return;
    }
    // Deduct credits
    const { error: creditError } = await supabase
      .from('profiles')
      .update({ sms_credits: (profile?.sms_credits || 0) - 20 })
      .eq('user_id', user!.id);
    if (creditError) { toast.error('Failed to deduct credits'); return; }

    const { error } = await supabase.from('crm_subscriptions').insert({
      user_id: user!.id,
      credits_charged: 20,
    });
    if (error) { toast.error('Failed to activate CRM'); return; }
    toast.success('CRM activated for 30 days!');
    await refreshProfile();
    fetchSubscription();
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    const { error } = await supabase.from('crm_contacts').insert({
      user_id: user!.id,
      name: newContact.name.trim(),
      email: newContact.email.trim(),
      phone: newContact.phone.trim() || null,
      company: newContact.company.trim() || null,
      notes: newContact.notes.trim() || null,
    });
    if (error) { toast.error('Failed to add contact'); return; }
    toast.success('Contact added!');
    setNewContact({ name: '', email: '', phone: '', company: '', notes: '' });
    setShowAddContact(false);
    fetchContacts();
  };

  const handleBulkImport = async () => {
    const emailList = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (emailList.length === 0) { toast.error('No valid emails found'); return; }

    const contacts = emailList.map(email => ({
      user_id: user!.id,
      name: email.split('@')[0],
      email,
      stage: 'new' as CRMStage,
    }));

    const { error } = await supabase.from('crm_contacts').insert(contacts);
    if (error) { toast.error('Import failed'); return; }
    toast.success(`${emailList.length} contacts imported!`);
    setBulkEmails('');
    fetchContacts();
  };

  const handleUpdateStage = async (contactId: string, newStage: CRMStage) => {
    const { error } = await supabase.from('crm_contacts')
      .update({ stage: newStage })
      .eq('id', contactId);
    if (error) { toast.error('Failed to update'); return; }

    // Log activity
    await supabase.from('crm_activities').insert({
      user_id: user!.id,
      contact_id: contactId,
      activity_type: 'stage_change',
      description: `Moved to ${newStage}`,
    });

    toast.success('Stage updated');
    fetchContacts();
    if (selectedContact?.id === contactId) {
      setSelectedContact(prev => prev ? { ...prev, stage: newStage } : null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase.from('crm_contacts').delete().eq('id', contactId);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Contact deleted');
    if (selectedContact?.id === contactId) setSelectedContact(null);
    fetchContacts();
  };

  const handleSendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error('Fill in all fields');
      return;
    }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-send-email', {
        body: {
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Log email in DB
      const contact = contacts.find(c => c.email === composeTo.trim());
      await supabase.from('crm_emails').insert({
        user_id: user!.id,
        contact_id: contact?.id || null,
        from_email: `crm@cfblockchains.com`,
        to_email: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        direction: 'outbound',
        status: 'sent',
      });

      // Update contact stage if new
      if (contact && contact.stage === 'new') {
        handleUpdateStage(contact.id, 'welcome_sent');
      }

      toast.success('Email sent!');
      setShowCompose(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeTo('');
      fetchEmails();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWelcomeToAll = async () => {
    const newContacts = contacts.filter(c => c.stage === 'new');
    if (newContacts.length === 0) { toast.error('No new contacts to send welcome to'); return; }

    for (const contact of newContacts) {
      try {
        await supabase.functions.invoke('crm-send-email', {
          body: {
            to: contact.email,
            subject: `Welcome to ${profile?.full_name || 'our network'}!`,
            body: `Hi ${contact.name},\n\nThank you for connecting with us. We'd love to learn more about how we can help you.\n\nBest regards,\n${profile?.full_name || 'CF Team'}`,
          },
        });
        await supabase.from('crm_emails').insert({
          user_id: user!.id,
          contact_id: contact.id,
          from_email: 'crm@cfblockchains.com',
          to_email: contact.email,
          subject: `Welcome to ${profile?.full_name || 'our network'}!`,
          body: `Welcome email sent automatically`,
          direction: 'outbound',
          status: 'sent',
        });
        await handleUpdateStage(contact.id, 'welcome_sent');
      } catch (e) {
        console.error(`Failed to send to ${contact.email}:`, e);
      }
    }
    toast.success(`Welcome emails sent to ${newContacts.length} contacts!`);
    fetchContacts();
    fetchEmails();
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = selectedStageFilter === 'all' || c.stage === selectedStageFilter;
    return matchesSearch && matchesStage;
  });

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s.key] = contacts.filter(c => c.stage === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not subscribed view
  if (!subscription) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">CF CRM</h1>
                <p className="text-xs text-muted-foreground">Customer Relationship Manager</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-12 max-w-lg">
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Activate CF CRM</CardTitle>
              <p className="text-muted-foreground">20 Credits / 30 Days</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Add unlimited contacts</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Send emails via @cfblockchains.com</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> AI-powered pipeline automation</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Inbound email inbox</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Full sales pipeline management</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Bulk import contacts</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Your balance: <span className="font-bold text-primary">{profile?.sms_credits || 0} credits</span></p>
              </div>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleActivateCRM}
                disabled={(profile?.sms_credits || 0) < 20}
              >
                Activate CRM — 20 Credits
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
                ← Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">CF CRM</h1>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(subscription.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-400 border-green-500/30">
                {contacts.length} contacts
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm"><BarChart3 className="w-4 h-4 mr-1" /> Pipeline</TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs sm:text-sm"><Users className="w-4 h-4 mr-1" /> Contacts</TabsTrigger>
            <TabsTrigger value="inbox" className="text-xs sm:text-sm"><Inbox className="w-4 h-4 mr-1" /> Inbox</TabsTrigger>
            <TabsTrigger value="compose" className="text-xs sm:text-sm"><Send className="w-4 h-4 mr-1" /> Send</TabsTrigger>
          </TabsList>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Sales Pipeline</h2>
              <Button size="sm" onClick={handleSendWelcomeToAll} variant="outline">
                <Send className="w-4 h-4 mr-1" /> Send Welcome to All New
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.map(stage => (
                <button
                  key={stage.key}
                  onClick={() => {
                    setSelectedStageFilter(stage.key);
                    setActiveTab('contacts');
                  }}
                  className={`${stage.color} rounded-lg p-3 text-center transition-all hover:scale-105 active:scale-95`}
                >
                  <stage.icon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs font-medium">{stage.label}</p>
                  <p className="text-lg font-bold">{stageCounts[stage.key] || 0}</p>
                </button>
              ))}
            </div>

            {/* Recent activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Emails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {emails.slice(0, 10).map(email => (
                  <div key={email.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                    {email.direction === 'outbound' ? (
                      <Send className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <MailOpen className="w-4 h-4 text-green-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{email.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.direction === 'outbound' ? `→ ${email.to_email}` : `← ${email.from_email}`}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(email.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {emails.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No emails yet. Send a welcome email!</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Button size="sm" onClick={() => setShowAddContact(!showAddContact)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Stage filter */}
            <div className="flex gap-1 overflow-x-auto pb-2">
              <Badge 
                variant={selectedStageFilter === 'all' ? 'default' : 'outline'} 
                className="cursor-pointer shrink-0"
                onClick={() => setSelectedStageFilter('all')}
              >
                All ({contacts.length})
              </Badge>
              {STAGES.map(s => (
                <Badge 
                  key={s.key}
                  variant={selectedStageFilter === s.key ? 'default' : 'outline'}
                  className="cursor-pointer shrink-0"
                  onClick={() => setSelectedStageFilter(s.key)}
                >
                  {s.label} ({stageCounts[s.key] || 0})
                </Badge>
              ))}
            </div>

            {/* Add Contact Form */}
            {showAddContact && (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div>
                      <Label className="text-xs">Email *</Label>
                      <Input value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} placeholder="john@example.com" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} placeholder="+44..." />
                    </div>
                    <div>
                      <Label className="text-xs">Company</Label>
                      <Input value={newContact.company} onChange={e => setNewContact({...newContact, company: e.target.value})} placeholder="Acme Inc" />
                    </div>
                  </div>
                  <Textarea value={newContact.notes} onChange={e => setNewContact({...newContact, notes: e.target.value})} placeholder="Notes..." rows={2} />
                  <div className="flex gap-2">
                    <Button onClick={handleAddContact} size="sm">Add Contact</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAddContact(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bulk Import */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Bulk Import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={bulkEmails}
                  onChange={e => setBulkEmails(e.target.value)}
                  placeholder="Paste emails (one per line, or comma-separated)..."
                  rows={3}
                />
                <Button size="sm" onClick={handleBulkImport} disabled={!bulkEmails.trim()}>
                  <UserPlus className="w-4 h-4 mr-1" /> Import Contacts
                </Button>
              </CardContent>
            </Card>

            {/* Contact List */}
            <div className="space-y-2">
              {filteredContacts.map(contact => {
                const stageInfo = STAGES.find(s => s.key === contact.stage);
                return (
                  <Card key={contact.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => setSelectedContact(contact)}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold shrink-0">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] ${stageInfo?.color || ''}`}>{stageInfo?.label}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No contacts found</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Inbox Tab */}
          <TabsContent value="inbox" className="space-y-4">
            <h2 className="text-lg font-bold">Email Inbox</h2>
            <div className="space-y-2">
              {emails.filter(e => e.direction === 'inbound').length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Inbox className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No inbound emails yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Replies to your emails will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                emails.filter(e => e.direction === 'inbound').map(email => (
                  <Card key={email.id} className="hover:border-primary/30 transition-all">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <MailOpen className="w-5 h-5 text-green-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">From: {email.from_email}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.body}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(email.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Move to warm if replied */}
                      {email.contact_id && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(email.contact_id!, 'warm');
                          }}>
                            <Zap className="w-3 h-3 mr-1" /> Move to Warm
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(email.contact_id!, 'booking');
                          }}>
                            <Calendar className="w-3 h-3 mr-1" /> Book Meeting
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {/* All emails */}
              <h3 className="text-sm font-semibold mt-6">All Sent Emails</h3>
              {emails.filter(e => e.direction === 'outbound').map(email => (
                <Card key={email.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <Send className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-muted-foreground">To: {email.to_email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{email.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-4">
            <h2 className="text-lg font-bold">Compose Email</h2>
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label>To</Label>
                  <Input 
                    value={composeTo} 
                    onChange={e => setComposeTo(e.target.value)} 
                    placeholder="recipient@example.com"
                    list="contact-emails"
                  />
                  <datalist id="contact-emails">
                    {contacts.map(c => <option key={c.id} value={c.email}>{c.name}</option>)}
                  </datalist>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Email subject..." />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your email..." rows={8} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSendEmail} disabled={isSending}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Sent from: crm@cfblockchains.com</p>
              </CardContent>
            </Card>

            {/* Quick send to all contacts in a stage */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Bulk Email by Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Send to all contacts in a specific pipeline stage</p>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.filter(s => ['new', 'warm', 'follow_up', 'try_again'].includes(s.key)).map(stage => (
                    <Button key={stage.key} variant="outline" size="sm" onClick={() => {
                      const stageContacts = contacts.filter(c => c.stage === stage.key);
                      if (stageContacts.length === 0) { toast.error(`No contacts in ${stage.label}`); return; }
                      setComposeTo(stageContacts.map(c => c.email).join(', '));
                      toast.info(`${stageContacts.length} recipients added`);
                    }}>
                      <stage.icon className="w-3 h-3 mr-1" /> {stage.label} ({stageCounts[stage.key] || 0})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedContact(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selectedContact.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>✕</Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" /> {selectedContact.email}
              </div>
              {selectedContact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" /> {selectedContact.phone}
                </div>
              )}
              {selectedContact.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" /> {selectedContact.company}
                </div>
              )}
              {selectedContact.notes && (
                <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3">{selectedContact.notes}</p>
              )}

              {/* Pipeline stages */}
              <div>
                <p className="text-xs font-semibold mb-2">Move to Stage:</p>
                <div className="grid grid-cols-2 gap-1">
                  {STAGES.map(stage => (
                    <Button
                      key={stage.key}
                      variant={selectedContact.stage === stage.key ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs justify-start"
                      onClick={() => handleUpdateStage(selectedContact.id, stage.key)}
                    >
                      <stage.icon className="w-3 h-3 mr-1" /> {stage.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => {
                  setComposeTo(selectedContact.email);
                  setActiveTab('compose');
                  setSelectedContact(null);
                }}>
                  <Send className="w-4 h-4 mr-1" /> Email
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteContact(selectedContact.id)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
