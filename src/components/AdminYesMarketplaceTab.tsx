import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Store, Package, Check, X, Search, Eye, ShoppingCart, Users,
} from 'lucide-react';

interface Seller {
  id: string; user_id: string; store_name: string; store_slug: string;
  store_description: string | null; is_approved: boolean; is_active: boolean;
  total_sales: number; total_revenue: number; created_at: string; contact_email: string | null;
}

interface Listing {
  id: string; seller_id: string; title: string; description: string;
  price: number; category: string; item_type: string; condition: string;
  quantity: number; is_approved: boolean; is_active: boolean; total_sold: number; created_at: string;
}

export default function AdminYesMarketplaceTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'sellers' | 'listings' | 'orders'>('sellers');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [{ data: s }, { data: l }, { data: o }, { data: p }] = await Promise.all([
      supabase.from('yes_marketplace_sellers').select('*').order('created_at', { ascending: false }),
      supabase.from('yes_marketplace_listings').select('*').order('created_at', { ascending: false }),
      supabase.from('yes_marketplace_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('user_id, email, full_name'),
    ]);
    if (s) setSellers(s as any[]);
    if (l) setListings(l as any[]);
    if (o) setOrders(o as any[]);
    if (p) {
      const map: Record<string, string> = {};
      p.forEach((pr: any) => { map[pr.user_id] = pr.email || pr.full_name || pr.user_id; });
      setProfiles(map);
    }
  };

  const handleApproveSeller = async (id: string, approve: boolean) => {
    const { error } = await supabase.from('yes_marketplace_sellers').update({
      is_approved: approve, approved_at: approve ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: approve ? 'Seller Approved' : 'Seller Rejected' });
    fetchAll();
  };

  const handleApproveListing = async (id: string, approve: boolean) => {
    const { error } = await supabase.from('yes_marketplace_listings').update({ is_approved: approve }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: approve ? 'Listing Approved' : 'Listing Rejected' });
    fetchAll();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed': return 'bg-blue-500/20 text-blue-400';
      case 'accepted': return 'bg-amber-500/20 text-amber-400';
      case 'dispatched': return 'bg-purple-500/20 text-purple-400';
      case 'delivered': return 'bg-green-500/20 text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const pendingSellers = sellers.filter(s => !s.is_approved);
  const pendingListings = listings.filter(l => !l.is_approved);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[
          { id: 'sellers' as const, icon: Users, label: `Sellers (${pendingSellers.length} pending)` },
          { id: 'listings' as const, icon: Package, label: `Listings (${pendingListings.length} pending)` },
          { id: 'orders' as const, icon: ShoppingCart, label: `Orders (${orders.length})` },
        ].map(tab => (
          <Button key={tab.id} variant={activeTab === tab.id ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(tab.id)} className="gap-1">
            <tab.icon className="w-4 h-4" />{tab.label}
          </Button>
        ))}
      </div>

      {/* Sellers */}
      {activeTab === 'sellers' && (
        <div className="space-y-3">
          {sellers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No seller applications</p>
          ) : sellers.map(s => (
            <div key={s.id} className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{s.store_name}</h4>
                  <p className="text-xs text-muted-foreground">{profiles[s.user_id] || s.user_id} • /{s.store_slug} • {s.contact_email || 'No email'}</p>
                  {s.store_description && <p className="text-xs text-muted-foreground mt-1">{s.store_description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {s.is_approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Sales: {s.total_sales}</span>
                <span>Revenue: ${s.total_revenue.toFixed(2)}</span>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              {!s.is_approved && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApproveSeller(s.id, true)} className="bg-green-600 hover:bg-green-700 text-xs"><Check className="w-3 h-3 mr-1" />Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleApproveSeller(s.id, false)} className="text-xs"><X className="w-3 h-3 mr-1" />Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      {activeTab === 'listings' && (
        <div className="space-y-3">
          {listings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No listings</p>
          ) : listings.map(l => (
            <div key={l.id} className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">{l.title}</h4>
                  <p className="text-xs text-muted-foreground">${l.price.toFixed(2)} • {l.item_type} • {l.category} • {l.condition} • Qty: {l.quantity}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {l.is_approved ? 'Approved' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{l.description}</p>
              {!l.is_approved && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApproveListing(l.id, true)} className="bg-green-600 hover:bg-green-700 text-xs"><Check className="w-3 h-3 mr-1" />Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleApproveListing(l.id, false)} className="text-xs"><X className="w-3 h-3 mr-1" />Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders</p>
          ) : orders.map((o: any) => (
            <div key={o.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-primary">{o.order_number}</span>
                <p className="text-xs text-muted-foreground">Buyer: {profiles[o.buyer_id] || o.buyer_id} • ${o.total_price?.toFixed(2)} • Qty: {o.quantity}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(o.status)}`}>{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
