import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import VerifiedBadge from '@/components/VerifiedBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Plus,
  Users,
  TrendingUp,
  Heart,
  MessageCircle,
  Eye,
  Send,
  UserPlus,
  ArrowLeft,
  Crown,
  ThumbsUp,
  Reply,
  Hash,
} from 'lucide-react';

interface ForumChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  member_count: number;
  post_count: number;
  is_approved: boolean;
  created_at: string;
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
  reaction_count: number;
  created_at: string;
}

interface ForumReply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  reaction_count: number;
  created_at: string;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_username?: string;
  sender_is_verified?: boolean;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  posts_count: number;
  replies_count: number;
  reactions_received: number;
  reputation_score: number;
  is_verified: boolean;
}

export default function Forum() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('channels');
  const [channels, setChannels] = useState<ForumChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ForumChannel | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [verifiedUsers, setVerifiedUsers] = useState<Record<string, boolean>>({});
  const [joinedChannels, setJoinedChannels] = useState<string[]>([]);
  
  // Form states
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelIcon, setNewChannelIcon] = useState('💬');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newReply, setNewReply] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChannels();
      fetchLeaderboard();
      fetchJoinedChannels();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChannel) {
      fetchPosts(selectedChannel.id);
      fetchChannelMessages(selectedChannel.id);
      
      // Subscribe to realtime messages
      const channel = supabase
        .channel(`forum-chat-${selectedChannel.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'forum_channel_messages',
            filter: `channel_id=eq.${selectedChannel.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as ChannelMessage;
            // Fetch username and verification status for new message
            const { data: wallet } = await supabase
              .from('wallets')
              .select('username, is_verified')
              .eq('user_id', newMsg.sender_id)
              .maybeSingle();
            
            setChannelMessages(prev => [...prev, {
              ...newMsg,
              sender_username: wallet?.username || 'User',
              sender_is_verified: wallet?.is_verified || false
            }]);
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedPost) {
      fetchReplies(selectedPost.id);
    }
  }, [selectedPost]);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('forum_channels')
      .select('*')
      .eq('is_approved', true)
      .order('post_count', { ascending: false });
    
    if (data) setChannels(data);
  };

  const fetchJoinedChannels = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('forum_channel_members')
      .select('channel_id')
      .eq('user_id', user.id);
    
    if (data) setJoinedChannels(data.map(d => d.channel_id));
  };

  const fetchPosts = async (channelId: string) => {
    const { data } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_approved', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (data) {
      setPosts(data);
      // Fetch usernames for post authors
      const authorIds = [...new Set(data.map(p => p.author_id))];
      fetchUsernames(authorIds);
    }
  };

  const fetchReplies = async (postId: string) => {
    const { data } = await supabase
      .from('forum_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setReplies(data);
      const authorIds = [...new Set(data.map(r => r.author_id))];
      fetchUsernames(authorIds);
    }
  };

  const fetchChannelMessages = async (channelId: string) => {
    const { data } = await supabase
      .from('forum_channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (data) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: wallets } = await supabase
        .from('wallets')
        .select('user_id, username, is_verified')
        .in('user_id', senderIds);
      
      const usernameMap: Record<string, string> = {};
      const verifiedMap: Record<string, boolean> = {};
      wallets?.forEach(w => {
        usernameMap[w.user_id] = w.username;
        verifiedMap[w.user_id] = w.is_verified || false;
      });
      
      setChannelMessages(data.map(m => ({
        ...m,
        sender_username: usernameMap[m.sender_id] || 'User',
        sender_is_verified: verifiedMap[m.sender_id] || false
      })));
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase.rpc('get_forum_leaderboard', { limit_count: 50 });
    if (data) setLeaderboard(data);
  };

  const fetchUsernames = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    const { data } = await supabase
      .from('wallets')
      .select('user_id, username, is_verified')
      .in('user_id', userIds);
    
    if (data) {
      const newUsernames: Record<string, string> = {};
      const newVerified: Record<string, boolean> = {};
      data.forEach(w => {
        newUsernames[w.user_id] = w.username;
        newVerified[w.user_id] = w.is_verified || false;
      });
      setUsernames(prev => ({ ...prev, ...newUsernames }));
      setVerifiedUsers(prev => ({ ...prev, ...newVerified }));
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast({ title: 'Please enter a channel name', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('forum_channels').insert({
      name: newChannelName,
      description: newChannelDesc,
      icon: newChannelIcon,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Failed to create channel', variant: 'destructive' });
    } else {
      toast({ title: 'Channel submitted for approval!' });
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelIcon('💬');
      setShowCreateChannel(false);
    }
  };

  const handleCreatePost = async () => {
    if (!selectedChannel || !newPostTitle.trim() || !newPostContent.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('forum_posts').insert({
      channel_id: selectedChannel.id,
      author_id: user?.id,
      title: newPostTitle,
      content: newPostContent,
    });

    if (error) {
      toast({ title: 'Failed to create post', variant: 'destructive' });
    } else {
      toast({ title: 'Post submitted for approval!' });
      setNewPostTitle('');
      setNewPostContent('');
      setShowCreatePost(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedPost || !newReply.trim()) return;

    const { error } = await supabase.from('forum_replies').insert({
      post_id: selectedPost.id,
      author_id: user?.id,
      content: newReply,
    });

    if (error) {
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    } else {
      setNewReply('');
      fetchReplies(selectedPost.id);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChannel || !newMessage.trim()) return;

    const { error } = await supabase.from('forum_channel_messages').insert({
      channel_id: selectedChannel.id,
      sender_id: user?.id,
      message: newMessage,
    });

    if (error) {
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } else {
      setNewMessage('');
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    const { error } = await supabase.from('forum_channel_members').insert({
      channel_id: channelId,
      user_id: user?.id,
    });

    if (error) {
      toast({ title: 'Failed to join channel', variant: 'destructive' });
    } else {
      toast({ title: 'Joined channel!' });
      setJoinedChannels(prev => [...prev, channelId]);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    const { error } = await supabase
      .from('forum_channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user?.id);

    if (!error) {
      setJoinedChannels(prev => prev.filter(id => id !== channelId));
    }
  };

  const handleReaction = async (postId?: string, replyId?: string) => {
    if (!postId && !replyId) return;

    const { error } = await supabase.from('forum_reactions').insert({
      user_id: user?.id,
      post_id: postId || null,
      reply_id: replyId || null,
      reaction_type: '👍',
    });

    if (!error) {
      if (postId && selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, reaction_count: prev.reaction_count + 1 } : null);
      }
      fetchReplies(selectedPost?.id || '');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="animate-pulse-glow w-16 h-16 rounded-2xl bg-primary/20" />
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-bold text-primary">CF Community</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Back navigation when viewing channel/post */}
        {(selectedChannel || selectedPost) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedPost) {
                setSelectedPost(null);
              } else if (selectedChannel) {
                setSelectedChannel(null);
                setShowGroupChat(false);
              }
            }}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Main Content */}
        {!selectedChannel ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="channels" className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">Channels</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger value="discover" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Discover</span>
              </TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
            <TabsContent value="channels">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Forum Channels</h2>
                <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Channel
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Channel</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Icon (emoji)"
                          value={newChannelIcon}
                          onChange={(e) => setNewChannelIcon(e.target.value)}
                          className="w-20"
                        />
                        <Input
                          placeholder="Channel name"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="Description (optional)"
                        value={newChannelDesc}
                        onChange={(e) => setNewChannelDesc(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Channels require admin approval before becoming visible.
                      </p>
                      <Button onClick={handleCreateChannel} className="w-full">
                        Submit for Approval
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="bg-card/50 border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedChannel(channel)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{channel.icon}</span>
                        <div>
                          <h3 className="font-semibold">{channel.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {channel.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      {joinedChannels.includes(channel.id) && (
                        <Badge variant="secondary">Joined</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
                ))}
                {channels.length === 0 && (
                  <p className="text-muted-foreground col-span-2 text-center py-8">
                    No channels yet. Be the first to create one!
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <div className="bg-card/50 border border-border rounded-lg p-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Community Leaderboard
                </h2>
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        entry.rank <= 3 ? 'bg-primary/10' : 'bg-secondary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-bold w-8 ${
                          entry.rank === 1 ? 'text-yellow-500' :
                          entry.rank === 2 ? 'text-gray-400' :
                          entry.rank === 3 ? 'text-amber-600' : ''
                        }`}>
                          #{entry.rank}
                        </span>
                        <span className="font-medium flex items-center gap-1">
                          @{entry.username || 'Anonymous'}
                          {entry.is_verified && <VerifiedBadge size="sm" />}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{entry.posts_count} posts</span>
                        <span>{entry.replies_count} replies</span>
                        <span className="text-primary font-semibold">{entry.reputation_score} rep</span>
                      </div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No rankings yet. Start posting to climb the leaderboard!
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Discover Tab */}
            <TabsContent value="discover">
              <div className="bg-card/50 border border-border rounded-lg p-4">
                <h2 className="text-xl font-bold mb-4">Discover Members</h2>
                <p className="text-muted-foreground mb-4">
                  Find and follow community members through the leaderboard or channel discussions.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {leaderboard.slice(0, 10).map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium flex items-center gap-1">
                          @{member.username || 'Anonymous'}
                          {member.is_verified && <VerifiedBadge size="sm" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.posts_count} posts • {member.reputation_score} rep
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : !selectedPost ? (
          /* Channel View */
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedChannel.icon}</span>
                <div>
                  <h2 className="text-xl font-bold">{selectedChannel.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedChannel.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {joinedChannels.includes(selectedChannel.id) ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowGroupChat(!showGroupChat)}>
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {showGroupChat ? 'Posts' : 'Chat'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleLeaveChannel(selectedChannel.id)}>
                      Leave
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleJoinChannel(selectedChannel.id)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join
                  </Button>
                )}
              </div>
            </div>

            {showGroupChat && joinedChannels.includes(selectedChannel.id) ? (
              /* Group Chat */
              <div className="bg-card/50 border border-border rounded-lg h-[500px] flex flex-col">
                <div className="p-3 border-b border-border">
                  <h3 className="font-semibold">Group Chat</h3>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {channelMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          @{msg.sender_username}
                          {msg.sender_is_verified && <VerifiedBadge size="sm" />}
                        </span>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            msg.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary'
                          }`}
                        >
                          {msg.message}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Posts List */
              <div>
                <div className="flex justify-end mb-4">
                  <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        New Post
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Post</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Post title"
                          value={newPostTitle}
                          onChange={(e) => setNewPostTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="Write your post content..."
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          rows={5}
                        />
                        <p className="text-xs text-muted-foreground">
                          Posts require admin approval before becoming visible.
                        </p>
                        <Button onClick={handleCreatePost} className="w-full">
                          Submit for Approval
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-card/50 border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {post.is_pinned && <Badge variant="secondary">📌 Pinned</Badge>}
                            <h3 className="font-semibold">{post.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          @{usernames[post.author_id] || 'User'}
                          {verifiedUsers[post.author_id] && <VerifiedBadge size="sm" />}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {post.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.reply_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.reaction_count}
                        </span>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No posts yet. Be the first to post!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Post View */
          <div>
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-4">
              <h2 className="text-xl font-bold mb-2">{selectedPost.title}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  @{usernames[selectedPost.author_id] || 'User'}
                  {verifiedUsers[selectedPost.author_id] && <VerifiedBadge size="sm" />}
                </span>
                <span>{formatTime(selectedPost.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReaction(selectedPost.id)}
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  {selectedPost.reaction_count}
                </Button>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {selectedPost.view_count} views
                </span>
              </div>
            </div>

            {/* Replies */}
            <div className="space-y-3 mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Reply className="w-4 h-4" />
                Replies ({replies.length})
              </h3>
              {replies.map((reply) => (
                <div key={reply.id} className="bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                      @{usernames[reply.author_id] || 'User'}
                      {verifiedUsers[reply.author_id] && <VerifiedBadge size="sm" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTime(reply.created_at)}</span>
                  </div>
                  <p className="text-sm">{reply.content}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleReaction(undefined, reply.id)}
                  >
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    {reply.reaction_count}
                  </Button>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <div className="flex gap-2">
              <Input
                placeholder="Write a reply..."
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              />
              <Button onClick={handleSendReply}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
