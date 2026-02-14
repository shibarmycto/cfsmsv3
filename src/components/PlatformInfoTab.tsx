import { Rocket, Shield, TrendingUp, Award, Coins, Zap, Users, Globe } from 'lucide-react';

export default function PlatformInfoTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Announcement */}
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold">CF Blockchain Network</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          After the Trump coin devastated Solana markets, we're taking control of our destiny. 
          We're launching our OWN blockchain where the community comes FIRST!
        </p>
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <p className="text-sm font-semibold text-primary mb-1">📅 Migration Complete: February 14, 2026</p>
          <p className="text-xs text-muted-foreground">🎉 One Year Anniversary of MRSSHIBAI (230K ATH!)</p>
        </div>
      </div>

      {/* Credits Pricing */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-primary" />
          Credit Pricing
        </h3>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center mb-4">
          <p className="text-3xl font-bold text-primary">$1 = 1 Credit</p>
          <p className="text-sm text-muted-foreground mt-1">Pay with USDT (TRC-20) for lowest fees</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">USDT Payment Wallet (TRC-20):</p>
          <p className="font-mono text-xs break-all text-primary bg-secondary/50 rounded p-2">
            TPY9rNr3Eb1PV86e3dkkFGgRQTH4oQYmJq
          </p>
        </div>
      </div>

      {/* Why CF Blockchain */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          Why CF Blockchain Is Different
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Shield, title: 'Anti-Rug Pull Protection', desc: 'Early exits lose 50% of tokens. Penalties redistributed to HODLers.' },
            { icon: Coins, title: 'Real USDC Earnings', desc: 'Platform profits shared with holders. The longer you HODL, the more you earn.' },
            { icon: Award, title: 'Milestone Rewards', desc: 'Bronze → Silver → Gold → Platinum. Blue Badge for top earners.' },
            { icon: Zap, title: 'AI-Powered Tools', desc: 'Economic news calendar, market analysis & alerts, trading assistants.' },
          ].map((item) => (
            <div key={item.title} className="bg-secondary/30 rounded-lg p-4 border border-border">
              <item.icon className="w-5 h-5 text-primary mb-2" />
              <p className="font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Graduation Stages */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          Token Graduation Stages
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Every token on the CF Exchange must graduate through these stages. Selling before graduation incurs a 50% penalty fee that gets redistributed to holders.
        </p>
        <div className="space-y-3">
          {[
            { stage: '1. Launch', mcap: '$0 - $5K', color: 'text-gray-400', desc: 'Token created. Early buyers can enter. 50% sell penalty active.' },
            { stage: '2. Bronze', mcap: '$5K - $25K', color: 'text-orange-400', desc: 'Community forming. Trading volume growing. Holders earn from sell penalties.' },
            { stage: '3. Silver', mcap: '$25K - $100K', color: 'text-gray-300', desc: 'Token gaining traction. Creator verified. More visibility on exchange.' },
            { stage: '4. Gold', mcap: '$100K - $500K', color: 'text-yellow-400', desc: 'Strong community. USDC rewards begin distributing to holders.' },
            { stage: '5. Platinum', mcap: '$500K - $1M', color: 'text-cyan-400', desc: 'Top-tier token. Blue badge eligible. Maximum USDC reward share.' },
            { stage: '6. Graduated 🎓', mcap: '$1M+', color: 'text-green-400', desc: 'Fully graduated! No more sell penalties. Token is rug-proof. Listed for open trading.' },
          ].map((item) => (
            <div key={item.stage} className="flex items-start gap-3 bg-secondary/20 rounded-lg p-3 border border-border">
              <div className="min-w-[120px]">
                <p className={`font-bold text-sm ${item.color}`}>{item.stage}</p>
                <p className="text-xs text-muted-foreground">{item.mcap}</p>
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Sharing */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-primary" />
          Revenue Sharing Model
        </h3>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center mb-4">
          <p className="text-2xl font-bold text-green-400">70% of Profits</p>
          <p className="text-sm text-muted-foreground">Go to token holders in USDC</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['Token creation fees', 'In-app purchases & roleplay', 'AI capabilities', 'Exchange trading fees', 'Mining operations', 'Premium features'].map((source) => (
            <div key={source} className="bg-secondary/30 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">{source}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Timeline */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          Migration Timeline
        </h3>
        <div className="space-y-3">
          {[
            { date: 'Jan 28', event: 'Official Announcement', icon: '✨' },
            { date: 'Feb 1-7', event: 'Token Snapshot & Registration', icon: '📸' },
            { date: 'Feb 8-13', event: 'Testnet Launch', icon: '🧪' },
            { date: 'Feb 14', event: 'MAINNET LAUNCH! 🚀', icon: '🚀' },
            { date: 'Feb 15-28', event: 'First USDC Distribution', icon: '💵' },
          ].map((item) => (
            <div key={item.date} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-sm">{item.date}</p>
                <p className="text-xs text-muted-foreground">{item.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Bonuses */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-primary" />
          Migration Bonuses
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            '10% bonus tokens for early adopters',
            'Priority Blue Badge access for OG holders',
            'Special anniversary NFTs',
            'Enhanced mining rewards',
          ].map((bonus) => (
            <div key={bonus} className="flex items-center gap-2 bg-secondary/20 rounded-lg p-3">
              <span className="text-green-400">🎁</span>
              <p className="text-sm text-muted-foreground">{bonus}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Community Links */}
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          Join the Revolution
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <a href="https://t.me/cfblockchain" target="_blank" rel="noopener noreferrer" 
             className="flex items-center gap-3 bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/50 transition-colors">
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-semibold text-sm">Telegram</p>
              <p className="text-xs text-muted-foreground">t.me/cfblockchain</p>
            </div>
          </a>
          <div className="flex items-center gap-3 bg-secondary/30 rounded-lg p-4 border border-border">
            <span className="text-2xl">🌐</span>
            <div>
              <p className="font-semibold text-sm">Website</p>
              <a href="https://cfblockchains.com" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">cfblockchains.com — Live Now 🟢</a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-6 text-center">
        <p className="text-lg font-bold mb-2">💎 HODL GANG ASSEMBLE! 💎</p>
        <p className="text-sm text-muted-foreground">
          This is YOUR blockchain. Built for YOU. Rewarding YOU. Let's make history together! 🚀🌙
        </p>
      </div>
    </div>
  );
}
