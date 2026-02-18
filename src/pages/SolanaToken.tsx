import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Send, Copy, Rocket, Globe, Sparkles, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import cfLogo from '@/assets/cf-blockchain-logo.png';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import TokenLiveStats from '@/components/token/TokenLiveStats';
import TokenCalculator from '@/components/token/TokenCalculator';
import TokenGainsChart from '@/components/token/TokenGainsChart';

const TOKEN_CA = '8hiQpxRxqiW31B6LZsJbdLPhxGT4DA2kX2TMZXLDjoy9';
const PUMP_FUN_URL = `https://pump.fun/coin/${TOKEN_CA}`;
const SOLSCAN_URL = `https://solscan.io/token/${TOKEN_CA}`;
const TELEGRAM_URL = 'https://t.me/cfblockchain';
const WEBSITE_URL = 'https://cfblockchains.com';
const CFGPT_URL = 'https://cfgpt.org';

export default function SolanaToken() {
  const navigate = useNavigate();

  const copyCA = () => {
    navigator.clipboard.writeText(TOKEN_CA);
    toast.success('Contract address copied!');
  };

  return (
    <div className="min-h-screen hero-gradient">
      <Navbar />

      {/* Hero */}
      <section className="container mx-auto px-6 pt-12 pb-20 text-center">
        <div className="animate-fade-in max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <img src={cfLogo} alt="CF Blockchain" className="relative w-24 h-24 rounded-2xl border-2 border-primary/30" />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
            <Rocket className="w-4 h-4" />
            LIVE ON SOLANA
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4">
            <span className="text-gradient">CF Blockchain</span> <span className="text-muted-foreground">($CFB)</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            We are pushing this token to bring <span className="text-foreground font-semibold">all Solana holders</span> to our new AI blockchain. 
            Join the community and explore our AI utility at <a href={CFGPT_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">CFGPT.ORG</a>.
          </p>

          {/* CA Box */}
          <div className="glass-card p-4 max-w-xl mx-auto mb-8">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Contract Address (CA)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs md:text-sm font-mono bg-secondary/50 rounded-lg px-3 py-2.5 text-foreground break-all select-all">
                {TOKEN_CA}
              </code>
              <Button variant="outline" size="sm" onClick={copyCA} className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="hero" size="lg" className="gap-2">
                <Rocket className="w-5 h-5" /> Buy on Pump.fun <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2">
                <Send className="w-5 h-5 text-[#0088cc]" /> Join Telegram
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={SOLSCAN_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View on Solscan <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-muted-foreground">•</span>
            <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              cfblockchains.com <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-muted-foreground">•</span>
            <a href={CFGPT_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              CFGPT.ORG <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="container mx-auto px-6 pb-12">
        <TokenLiveStats />
      </section>

      {/* Calculator & Gains Chart */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
          Calculate Your <span className="text-gradient">Potential</span>
        </h2>
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <TokenCalculator />
          <TokenGainsChart />
        </div>
      </section>

      {/* Why CFB */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Why <span className="text-gradient">$CFB</span>?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Globe,
              title: 'Bridge to AI Blockchain',
              description: 'CFB is the gateway token connecting Solana holders to the CF Blockchain ecosystem — a new AI-powered blockchain built for everyone.',
            },
            {
              icon: Sparkles,
              title: 'CFGPT AI Utility',
              description: 'Our flagship product CFGPT.ORG provides cutting-edge AI tools powered by our own blockchain. $CFB holders get priority access.',
            },
            {
              icon: Users,
              title: 'Community-First',
              description: 'We\'re building a real community, not just a token. Join our Telegram, contribute, mine, trade, and grow together.',
            },
            {
              icon: TrendingUp,
              title: 'Real Ecosystem',
              description: 'CF Blockchain has a miner, exchange, forum, roleplay game, and CRM — all interconnected. This isn\'t vapourware.',
            },
            {
              icon: Rocket,
              title: 'Fair Launch',
              description: 'Launched on Pump.fun with full transparency. No pre-sale, no hidden allocations. Community-driven from day one.',
            },
            {
              icon: Send,
              title: 'Active Development',
              description: 'The CF Blockchain Network is live and actively developed. Visit cfblockchains.com to see the full ecosystem in action.',
            },
          ].map((feature) => (
            <div key={feature.title} className="stat-card hover-scale">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="glass-card p-8 md:p-12 text-center max-w-3xl mx-auto">
          <img src={cfLogo} alt="CF Blockchain" className="w-16 h-16 rounded-xl mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to join the <span className="text-gradient">CF Blockchain</span> revolution?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Buy $CFB on Pump.fun, join our Telegram community, and be part of the future of AI-powered blockchain technology.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="hero" size="lg" className="gap-2">
                Buy $CFB Now <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2">
                <Send className="w-5 h-5 text-[#0088cc]" /> Telegram Community
              </Button>
            </a>
            <Button variant="ghost" size="lg" className="gap-2" onClick={() => navigate('/auth')}>
              Join CF Blockchain <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
