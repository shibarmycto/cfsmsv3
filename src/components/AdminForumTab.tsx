import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Eye, MessageSquare, Users, Pin, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ForumChannel {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  is_approved: boolean;
  member_count: number;
  post_count: number;
  created_at: string;
  created_by: string;
}

interface ForumPost {
  id: string;
  channel_id: string;
  author_id: string;
  title: string;
  content: string;
  is_approved: boolean;
  is_pinned: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
}

interface AdminForumTabProps {
  userId: string;
}

export default function AdminForumTab({ userId }: AdminForumTabProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('channels');
  const [pendingChannels, setPendingChannels] = useState<ForumChannel[]>([]);
  const [pendingPosts, setPendingPosts] = useState<ForumPost[]>([]);
  const [approvedChannels, setApprovedChannels] = useState<ForumChannel[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPendingChannels();
    fetchPendingPosts();
    fetchApprovedChannels();
  }, []);

  const fetchPendingChannels = async () => {
    const { data } = await supabase
      .from('forum_channels')
      .select('*')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    
    if (data) {
      setPendingChannels(data);
      fetchUsernames(data.map(c => c.created_by));
    }
  };

  const fetchApprovedChannels = async () => {
    const { data } = await supabase
      .from('forum_channels')
      .select('*')
      .eq('is_approved', true)
      .order('post_count', { ascending: false });
    
    if (data) setApprovedChannels(data);
  };

  const fetchPendingPosts = async () => {
    const { data } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    
    if (data) {
      setPendingPosts(data);
      fetchUsernames(data.map(p => p.author_id));
    }
  };

  const fetchUsernames = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    const { data } = await supabase
      .from('wallets')
      .select('user_id, username')
      .in('user_id', userIds);
    
    if (data) {
      const newUsernames: Record<string, string> = {};
      data.forEach(w => {
        newUsernames[w.user_id] = w.username;
      });
      setUsernames(prev => ({ ...prev, ...newUsernames }));
    }
  };

  const handleApproveChannel = async (channelId: string) => {
    const { error } = await supabase
      .from('forum_channels')
      .update({
        is_approved: true,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    if (error) {
      toast({ title: 'Failed to approve channel', variant: 'destructive' });
    } else {
      toast({ title: 'Channel approved!' });
      fetchPendingChannels();
      fetchApprovedChannels();
    }
  };

  const handleRejectChannel = async (channelId: string) => {
    const { error } = await supabase
      .from('forum_channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      toast({ title: 'Failed to delete channel', variant: 'destructive' });
    } else {
      toast({ title: 'Channel rejected and deleted' });
      fetchPendingChannels();
    }
  };

  const handleApprovePost = async (postId: string) => {
    const { error } = await supabase
      .from('forum_posts')
      .update({
        is_approved: true,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (error) {
      toast({ title: 'Failed to approve post', variant: 'destructive' });
    } else {
      toast({ title: 'Post approved!' });
      fetchPendingPosts();
    }
  };

  const handleRejectPost = async (postId: string) => {
    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast({ title: 'Failed to delete post', variant: 'destructive' });
    } else {
      toast({ title: 'Post rejected and deleted' });
      fetchPendingPosts();
    }
  };

  const handleTogglePin = async (postId: string, currentlyPinned: boolean) => {
    const { error } = await supabase
      .from('forum_posts')
      .update({ is_pinned: !currentlyPinned })
      .eq('id', postId);

    if (!error) {
      toast({ title: currentlyPinned ? 'Post unpinned' : 'Post pinned!' });
      fetchPendingPosts();
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    const { error } = await supabase
      .from('forum_channels')
      .delete()
      .eq('id', channelId);

    if (!error) {
      toast({ title: 'Channel deleted' });
      fetchApprovedChannels();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Community Forum</h2>
          <p className="text-muted-foreground">Manage channels and posts</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {pendingChannels.length} pending channels
          </Badge>
          <Badge variant="secondary">
            {pendingPosts.length} pending posts
          </Badge>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="channels">
            Pending Channels ({pendingChannels.length})
          </TabsTrigger>
          <TabsTrigger value="posts">
            Pending Posts ({pendingPosts.length})
          </TabsTrigger>
          <TabsTrigger value="manage">
            Manage Channels
          </TabsTrigger>
        </TabsList>

        {/* Pending Channels */}
        <TabsContent value="channels">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {pendingChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="bg-secondary/30 border border-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{channel.icon}</span>
                      <div>
                        <h3 className="font-semibold">{channel.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {channel.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created by @{usernames[channel.created_by] || 'Unknown'} • {formatDate(channel.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success"
                        onClick={() => handleApproveChannel(channel.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive"
                        onClick={() => handleRejectChannel(channel.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingChannels.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No pending channels to review
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Pending Posts */}
        <TabsContent value="posts">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {pendingPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-secondary/30 border border-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                        {post.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        By @{usernames[post.author_id] || 'Unknown'} • {formatDate(post.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success"
                        onClick={() => handleApprovePost(post.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive"
                        onClick={() => handleRejectPost(post.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingPosts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No pending posts to review
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Manage Approved Channels */}
        <TabsContent value="manage">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {approvedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="bg-secondary/30 border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{channel.icon}</span>
                      <div>
                        <h3 className="font-semibold">{channel.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {channel.member_count} members
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {channel.post_count} posts
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeleteChannel(channel.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {approvedChannels.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No approved channels yet
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
