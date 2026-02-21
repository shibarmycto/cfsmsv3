import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Store, Package, ShoppingCart, Wallet, CreditCard, Search,
  Plus, Tag, Truck, MessageSquare, ArrowRight, ExternalLink,
  ChevronDown, Eye, Heart, Clock, CheckCircle2, XCircle,
  Send, RefreshCw, Download, DollarSign, Filter,
} from 'lucide-react';

interface Seller {
  id: string;
  user_id: string;
  store_name: string;
  store_slug: string;
  store_description: string | null;
  is_approved: boolean;
  is_active: boolean;
  total_sales: number;
  total_revenue: number;
  created_at: string;
}

interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  item_type: string;
  condition: string;
  quantity: number;
  images: string[];
  digital_download_url: string | null;
  is_approved: boolean;
  is_active: boolean;
  total_sold: number;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  quantity: number;
  total_price: number;
  status: string;
  shipping_address: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  is_digital: boolean;
  digital_download_url: string | null;
  placed_at: string;
  accepted_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
}

interface MarketMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface MarketWallet {
  id: string;
  user_id: string;
  card_id: string | null;
  balance: number;
  total_spent: number;
  total_received: number;
}

export default function YesMarketplaceTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<'browse' | 'my-store' | 'orders' | 'wallet' | 'messages'>('browse');
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [wallet, setWallet] = useState<MarketWallet | null>(null);
  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [credits, setCredits] = useState(0);

  // Store application form
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeEmail, setStoreEmail] = useState('');

  // Listing form
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingCategory, setListingCategory] = useState('electronics');
  const [listingType, setListingType] = useState('physical');
  const [listingCondition, setListingCondition] = useState('new');
  const [listingQuantity, setListingQuantity] = useState('1');
  const [listingDigitalUrl, setListingDigitalUrl] = useState('');

  // Buy/order
  const [buyingListing, setBuyingListing] = useState<Listing | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('1');

  // Messages
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Convert credits
  const [convertAmount, setConvertAmount] = useState('');

  // Tracking
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  useEffect(() => {
    fetchAll();
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel('marketplace-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_marketplace_orders' }, () => {
        fetchOrders();
        fetchSellerOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yes_marketplace_messages' }, () => {
        if (selectedOrderId) fetchMessages(selectedOrderId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, selectedOrderId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchSeller(), fetchListings(), fetchOrders(), fetchWallet(), fetchCards(), fetchCredits(), fetchSellerOrders(),
    ]);
    setLoading(false);
  };

  const fetchSeller = async () => {
    const { data } = await supabase.from('yes_marketplace_sellers').select('*').eq('user_id', userId).maybeSingle();
    if (data) {
      setSeller(data as any);
      const { data: items } = await supabase.from('yes_marketplace_listings').select('*').eq('seller_id', data.id).order('created_at', { ascending: false });
      if (items) setMyListings(items as any[]);
    }
  };

  const fetchListings = async () => {
    const { data } = await supabase.from('yes_marketplace_listings').select('*').eq('is_approved', true).eq('is_active', true).order('created_at', { ascending: false });
    if (data) setListings(data as any[]);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('yes_marketplace_orders').select('*').eq('buyer_id', userId).order('created_at', { ascending: false });
    if (data) setOrders(data as any[]);
  };

  const fetchSellerOrders = async () => {
    if (!seller) return;
    const { data } = await supabase.from('yes_marketplace_orders').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false });
    if (data) setSellerOrders(data as any[]);
  };

  const fetchWallet = async () => {
    const { data } = await supabase.from('yes_marketplace_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (data) setWallet(data as any);
  };

  const fetchCards = async () => {
    const { data } = await supabase.from('yes_bank_cards').select('*').eq('user_id', userId).eq('status', 'active');
    if (data) setCards(data as any[]);
  };

  const fetchCredits = async () => {
    const { data } = await supabase.from('profiles').select('sms_credits').eq('user_id', userId).maybeSingle();
    if (data) setCredits(data.sms_credits || 0);
  };

  const fetchMessages = async (orderId: string) => {
    const { data } = await supabase.from('yes_marketplace_messages').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
    if (data) setMessages(data as any[]);
  };

  const handleApplyStore = async () => {
    if (!storeName.trim()) { toast({ title: 'Error', description: 'Store name required', variant: 'destructive' }); return; }
    const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const { error } = await supabase.from('yes_marketplace_sellers').insert({
      user_id: userId, store_name: storeName, store_slug: slug,
      store_description: storeDesc || null, contact_email: storeEmail || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Application Submitted', description: 'Your store application is pending admin approval.' });
    setStoreName(''); setStoreDesc(''); setStoreEmail('');
    fetchSeller();
  };

  const handleCreateListing = async () => {
    if (!seller || !listingTitle.trim() || !listingPrice) return;
    const { error } = await supabase.from('yes_marketplace_listings').insert({
      seller_id: seller.id, title: listingTitle, description: listingDesc,
      price: parseFloat(listingPrice), category: listingCategory, item_type: listingType,
      condition: listingCondition, quantity: parseInt(listingQuantity) || 1,
      digital_download_url: listingType === 'digital' ? listingDigitalUrl : null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Listing Created', description: 'Your item is pending admin approval.' });
    setShowListingForm(false);
    setListingTitle(''); setListingDesc(''); setListingPrice('');
    fetchSeller();
  };

  const handleBuy = async (listing: Listing) => {
    if (!wallet || wallet.balance < listing.price * parseInt(buyQuantity || '1')) {
      toast({ title: 'Insufficient Balance', description: 'Top up your Yes Market wallet first.', variant: 'destructive' });
      return;
    }
    if (listing.item_type === 'physical' && !shippingAddress.trim()) {
      toast({ title: 'Address Required', description: 'Enter a shipping address for physical items.', variant: 'destructive' }); return;
    }
    const qty = parseInt(buyQuantity || '1');
    const total = listing.price * qty;
    const orderNumber = `YM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Deduct from wallet
    const { error: walletErr } = await supabase.from('yes_marketplace_wallets').update({
      balance: wallet.balance - total, total_spent: wallet.total_spent + total,
    }).eq('id', wallet.id);
    if (walletErr) { toast({ title: 'Error', description: walletErr.message, variant: 'destructive' }); return; }

    // Create order
    const { error: orderErr } = await supabase.from('yes_marketplace_orders').insert({
      order_number: orderNumber, buyer_id: userId, seller_id: listing.seller_id,
      listing_id: listing.id, quantity: qty, total_price: total,
      shipping_address: listing.item_type === 'physical' ? shippingAddress : null,
      is_digital: listing.item_type === 'digital',
      digital_download_url: listing.item_type === 'digital' ? listing.digital_download_url : null,
    });
    if (orderErr) { toast({ title: 'Error', description: orderErr.message, variant: 'destructive' }); return; }

    // Credit seller wallet
    const { data: sellerData } = await supabase.from('yes_marketplace_sellers').select('user_id').eq('id', listing.seller_id).single();
    if (sellerData) {
      const { data: sellerWallet } = await supabase.from('yes_marketplace_wallets').select('*').eq('user_id', sellerData.user_id).maybeSingle();
      if (sellerWallet) {
        await supabase.from('yes_marketplace_wallets').update({
          balance: (sellerWallet as any).balance + total, total_received: (sellerWallet as any).total_received + total,
        }).eq('id', (sellerWallet as any).id);
      }
    }

    // Update listing sold count
    await supabase.from('yes_marketplace_listings').update({
      total_sold: listing.total_sold + qty, quantity: listing.quantity - qty,
    }).eq('id', listing.id);

    toast({ title: 'Order Placed!', description: `Order ${orderNumber} confirmed. $${total.toFixed(2)} deducted.` });
    setBuyingListing(null); setShippingAddress(''); setBuyQuantity('1');
    fetchAll();
  };

  const handleConvertCredits = async () => {
    const amount = parseFloat(convertAmount);
    if (!amount || amount <= 0 || amount > credits) {
      toast({ title: 'Invalid Amount', description: 'Enter a valid credit amount.', variant: 'destructive' }); return;
    }

    // Deduct credits
    const { error: creditErr } = await supabase.from('profiles').update({ sms_credits: credits - amount }).eq('user_id', userId);
    if (creditErr) { toast({ title: 'Error', description: creditErr.message, variant: 'destructive' }); return; }

    // Create/update marketplace wallet
    if (wallet) {
      await supabase.from('yes_marketplace_wallets').update({ balance: wallet.balance + amount }).eq('id', wallet.id);
    } else {
      await supabase.from('yes_marketplace_wallets').insert({ user_id: userId, balance: amount });
    }

    // If user has a Yes Card, also top it up
    if (cards.length > 0) {
      const card = cards[0];
      await supabase.from('yes_bank_cards').update({ balance: card.balance + amount }).eq('id', card.id);
      await supabase.from('yes_card_topups').insert({ user_id: userId, card_id: card.id, credits_converted: amount, usd_amount: amount });
    }

    toast({ title: 'Converted!', description: `$${amount.toFixed(2)} added to your Yes Market wallet.` });
    setConvertAmount('');
    fetchAll();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const updateData: any = { status };
    if (status === 'accepted') updateData.accepted_at = new Date().toISOString();
    if (status === 'dispatched') {
      updateData.dispatched_at = new Date().toISOString();
      if (trackingNumber) updateData.tracking_number = trackingNumber;
      if (trackingUrl) updateData.tracking_url = trackingUrl;
    }
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();

    const { error } = await supabase.from('yes_marketplace_orders').update(updateData).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Order Updated', description: `Status changed to ${status}.` });
    setTrackingNumber(''); setTrackingUrl('');
    fetchSellerOrders(); fetchOrders();
  };

  const handleSendMessage = async () => {
    if (!selectedOrderId || !newMessage.trim()) return;
    const { error } = await supabase.from('yes_marketplace_messages').insert({
      order_id: selectedOrderId, sender_id: userId, message: newMessage,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setNewMessage('');
    fetchMessages(selectedOrderId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed': return 'bg-blue-500/20 text-blue-400';
      case 'accepted': return 'bg-amber-500/20 text-amber-400';
      case 'dispatched': return 'bg-purple-500/20 text-purple-400';
      case 'delivered': return 'bg-green-500/20 text-green-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const categories = ['electronics', 'clothing', 'digital', 'gaming', 'crypto', 'services', 'collectibles', 'other'];
  const filteredListings = listings.filter(l => {
    const matchSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || l.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === 'all' || l.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse-glow w-12 h-12 rounded-xl bg-primary/20" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6" style={{ background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(45 70% 15% / 0.3) 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Store className="w-8 h-8 text-amber-400" />
          <h2 className="text-2xl font-bold">Yes Marketplace</h2>
        </div>
        <p className="text-muted-foreground">Buy & sell digital and physical goods — zero fees, same-day settlement</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">No Listing Fees</span>
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">0% Commission</span>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">Yes Card Accepted</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'browse' as const, icon: Search, label: 'Browse' },
          { id: 'my-store' as const, icon: Store, label: 'My Store' },
          { id: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
          { id: 'wallet' as const, icon: Wallet, label: 'Wallet' },
          { id: 'messages' as const, icon: MessageSquare, label: 'Messages' },
        ].map(tab => (
          <Button key={tab.id} variant={activeView === tab.id ? 'default' : 'outline'} size="sm" onClick={() => setActiveView(tab.id)} className="gap-1">
            <tab.icon className="w-4 h-4" />{tab.label}
          </Button>
        ))}
      </div>

      {/* Browse */}
      {activeView === 'browse' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search listings..." className="pl-10 bg-secondary/50" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm">
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>

          {filteredListings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No listings found</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map(listing => (
                <div key={listing.id} className="glass-card p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setBuyingListing(listing)}>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${listing.item_type === 'digital' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {listing.item_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{listing.condition}</span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">{listing.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{listing.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-amber-400">${listing.price.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{listing.quantity} available</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs bg-secondary/50 px-2 py-0.5 rounded">{listing.category}</span>
                    <span className="text-xs text-muted-foreground">{listing.total_sold} sold</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buy Modal */}
          {buyingListing && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBuyingListing(null)}>
              <div className="glass-card p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold">Buy: {buyingListing.title}</h3>
                <p className="text-muted-foreground text-sm">{buyingListing.description}</p>
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Price</span><span className="font-bold text-amber-400">${buyingListing.price.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Type</span><span>{buyingListing.item_type}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Available</span><span>{buyingListing.quantity}</span></div>
                </div>
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input type="number" min="1" max={buyingListing.quantity} value={buyQuantity} onChange={e => setBuyQuantity(e.target.value)} className="bg-secondary/50" />
                </div>
                {buyingListing.item_type === 'physical' && (
                  <div>
                    <label className="text-sm font-medium">Shipping Address</label>
                    <Textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Full shipping address..." className="bg-secondary/50" />
                  </div>
                )}
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-amber-400">${(buyingListing.price * parseInt(buyQuantity || '1')).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Wallet balance: ${wallet?.balance.toFixed(2) || '0.00'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBuyingListing(null)} className="flex-1">Cancel</Button>
                  <Button onClick={() => handleBuy(buyingListing)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black">Buy Now</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* My Store */}
      {activeView === 'my-store' && (
        <div className="space-y-4">
          {!seller ? (
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2"><Store className="w-5 h-5 text-amber-400" />Apply to Sell</h3>
              <p className="text-muted-foreground text-sm">Create your store and start selling. No fees, no commission — ever.</p>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Store Name" className="bg-secondary/50" />
              <Textarea value={storeDesc} onChange={e => setStoreDesc(e.target.value)} placeholder="Store description..." className="bg-secondary/50" />
              <Input value={storeEmail} onChange={e => setStoreEmail(e.target.value)} placeholder="Contact email (optional)" className="bg-secondary/50" />
              <Button onClick={handleApplyStore} className="bg-amber-500 hover:bg-amber-600 text-black w-full">Submit Application</Button>
            </div>
          ) : !seller.is_approved ? (
            <div className="glass-card p-6 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-amber-400" />
              <h3 className="text-xl font-bold">Application Pending</h3>
              <p className="text-muted-foreground">Your store "{seller.store_name}" is awaiting admin approval.</p>
              <p className="text-xs text-muted-foreground mt-2">Store URL: yes-market/{seller.store_slug}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{seller.store_name}</h3>
                  <p className="text-xs text-muted-foreground">yes-market/{seller.store_slug} • {seller.total_sales} sales • ${seller.total_revenue.toFixed(2)} revenue</p>
                </div>
                <Button size="sm" onClick={() => setShowListingForm(true)} className="gap-1 bg-amber-500 hover:bg-amber-600 text-black">
                  <Plus className="w-4 h-4" />List Item
                </Button>
              </div>

              {showListingForm && (
                <div className="glass-card p-4 space-y-3">
                  <h4 className="font-semibold">New Listing</h4>
                  <Input value={listingTitle} onChange={e => setListingTitle(e.target.value)} placeholder="Item title" className="bg-secondary/50" />
                  <Textarea value={listingDesc} onChange={e => setListingDesc(e.target.value)} placeholder="Description..." className="bg-secondary/50" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Price ($)</label>
                      <Input type="number" value={listingPrice} onChange={e => setListingPrice(e.target.value)} placeholder="0.00" className="bg-secondary/50" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Quantity</label>
                      <Input type="number" value={listingQuantity} onChange={e => setListingQuantity(e.target.value)} className="bg-secondary/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <select value={listingCategory} onChange={e => setListingCategory(e.target.value)} className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm">
                      {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                    <select value={listingType} onChange={e => setListingType(e.target.value)} className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm">
                      <option value="physical">Physical</option>
                      <option value="digital">Digital</option>
                    </select>
                    <select value={listingCondition} onChange={e => setListingCondition(e.target.value)} className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm">
                      <option value="new">New</option>
                      <option value="used">Used</option>
                      <option value="refurbished">Refurbished</option>
                    </select>
                  </div>
                  {listingType === 'digital' && (
                    <Input value={listingDigitalUrl} onChange={e => setListingDigitalUrl(e.target.value)} placeholder="Digital download URL" className="bg-secondary/50" />
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowListingForm(false)}>Cancel</Button>
                    <Button onClick={handleCreateListing} className="bg-amber-500 hover:bg-amber-600 text-black">Create Listing</Button>
                  </div>
                </div>
              )}

              {/* My Listings */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Your Listings ({myListings.length})</h4>
                {myListings.map(item => (
                  <div key={item.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} • {item.quantity} left • {item.total_sold} sold</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {item.is_approved ? 'Live' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Seller Orders */}
              {sellerOrders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Incoming Orders ({sellerOrders.length})</h4>
                  {sellerOrders.map(order => (
                    <div key={order.id} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-primary">{order.order_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>{order.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Qty: {order.quantity} • ${order.total_price.toFixed(2)}</span>
                      </div>
                      {order.shipping_address && <p className="text-xs text-muted-foreground">Ship to: {order.shipping_address}</p>}
                      <div className="flex gap-2 flex-wrap">
                        {order.status === 'placed' && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateOrderStatus(order.id, 'accepted')} className="text-xs">Accept Order</Button>
                        )}
                        {order.status === 'accepted' && (
                          <div className="flex gap-2 items-end w-full">
                            <div className="flex-1 space-y-1">
                              <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking #" className="bg-secondary/50 h-8 text-xs" />
                              <Input value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="Tracking URL" className="bg-secondary/50 h-8 text-xs" />
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateOrderStatus(order.id, 'dispatched')} className="text-xs">
                              <Truck className="w-3 h-3 mr-1" />Dispatch
                            </Button>
                          </div>
                        )}
                        {order.status === 'dispatched' && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} className="text-xs">Mark Delivered</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedOrderId(order.id); fetchMessages(order.id); setActiveView('messages'); }} className="text-xs">
                          <MessageSquare className="w-3 h-3 mr-1" />Message
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders */}
      {activeView === 'orders' && (
        <div className="space-y-3">
          <h3 className="font-bold text-lg">My Orders</h3>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No orders yet</p>
            </div>
          ) : orders.map(order => (
            <div key={order.id} className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-primary">{order.order_number}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>{order.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Qty: {order.quantity}</span>
                <span className="font-bold text-amber-400">${order.total_price.toFixed(2)}</span>
              </div>
              {/* Order Timeline */}
              <div className="flex items-center gap-1 text-xs">
                {['placed', 'accepted', 'dispatched', 'delivered'].map((step, i) => {
                  const steps = ['placed', 'accepted', 'dispatched', 'delivered'];
                  const currentIdx = steps.indexOf(order.status);
                  const active = i <= currentIdx;
                  return (
                    <div key={step} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-muted'}`} />
                      <span className={active ? 'text-green-400' : 'text-muted-foreground'}>{step}</span>
                      {i < 3 && <div className={`w-4 h-0.5 ${active && i < currentIdx ? 'bg-green-400' : 'bg-muted'}`} />}
                    </div>
                  );
                })}
              </div>
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Truck className="w-3 h-3" />Track: {order.tracking_number || 'View'} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {order.is_digital && order.digital_download_url && order.status === 'delivered' && (
                <a href={order.digital_download_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 flex items-center gap-1">
                  <Download className="w-3 h-3" />Download Digital Item
                </a>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setSelectedOrderId(order.id); fetchMessages(order.id); setActiveView('messages'); }} className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />Message Seller
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Wallet */}
      {activeView === 'wallet' && (
        <div className="space-y-4">
          <div className="glass-card p-6" style={{ background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(45 70% 15% / 0.3) 100%)' }}>
            <h3 className="text-sm text-muted-foreground mb-1">Yes Market Wallet</h3>
            <p className="text-3xl font-bold text-amber-400">${wallet?.balance.toFixed(2) || '0.00'}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>Spent: ${wallet?.total_spent.toFixed(2) || '0.00'}</span>
              <span>Received: ${wallet?.total_received.toFixed(2) || '0.00'}</span>
            </div>
            {cards.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <CreditCard className="w-3 h-3 text-amber-400" />
                <span>Linked Yes Card: •••• {cards[0].card_number?.slice(-4)}</span>
              </div>
            )}
          </div>

          <div className="glass-card p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4 text-amber-400" />Convert CF Credits to Yes Card Balance</h4>
            <p className="text-xs text-muted-foreground">Available credits: {credits} ($1 = 1 credit). No admin approval needed.</p>
            <div className="flex gap-2">
              <Input type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)} placeholder="Amount" className="bg-secondary/50" />
              <Button onClick={handleConvertCredits} className="bg-amber-500 hover:bg-amber-600 text-black whitespace-nowrap">
                <DollarSign className="w-4 h-4 mr-1" />Convert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {activeView === 'messages' && (
        <div className="space-y-4">
          {!selectedOrderId ? (
            <div className="space-y-2">
              <h3 className="font-bold text-lg">Order Messages</h3>
              <p className="text-muted-foreground text-sm">Select an order from your orders or store to message.</p>
              {[...orders, ...sellerOrders].map(order => (
                <div key={order.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/50" onClick={() => { setSelectedOrderId(order.id); fetchMessages(order.id); }}>
                  <div>
                    <span className="font-mono text-xs text-primary">{order.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)}>← Back</Button>
              <div className="glass-card p-4 space-y-3 max-h-[400px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>
                ) : messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.sender_id === userId ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'}`}>
                      <p>{msg.message}</p>
                      <p className="text-[10px] opacity-60 mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="bg-secondary/50" onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                <Button onClick={handleSendMessage} size="sm"><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
