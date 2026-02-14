import { Send, TrendingUp, Newspaper, Calendar, BarChart3, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import cfLogo from '@/assets/cf-blockchain-logo.png';

export default function TelegramBotSection() {
  const commands = [
    { cmd: '/start', desc: 'Register your group for real-time alerts' },
    { cmd: '/stats', desc: 'Full market report — volume, trades, top tokens' },
    { cmd: '/top', desc: 'Top 5 tokens by 24h trading volume' },
    { cmd: '/price SYMBOL', desc: 'Look up any token price & market cap' },
    { cmd: '/new', desc: 'Recently launched tokens on CF Exchange' },
    { cmd: '/help', desc: 'List all available commands' },
  ];

  const features = [
    { icon: TrendingUp, label: 'Real-Time BUYs & SELLs', color: 'text-green-400' },
    { icon: Newspaper, label: 'Crypto News & Alerts', color: 'text-red-400' },
    { icon: Calendar, label: 'Economic Calendar Events', color: 'text-yellow-400' },
    { icon: BarChart3, label: 'Full Market Reports', color: 'text-cyan-400' },
  ];

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          📡 <span className="text-gradient">CF Blockchain Bot</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Your real-time crypto trading assistant on Telegram. Get instant alerts for every trade, 
          new token launch, and economic event on the CF Blockchain.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Left - Features & CTA */}
        <div className="glass-card glow-border p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-6 h-6 text-[#0088cc]" />
              </div>
              <div>
                <h3 className="text-xl font-bold">CF Blockchain Bot</h3>
                <p className="text-sm text-muted-foreground">Your Crypto Trading Assistant</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-sm">
                  <f.icon className={`w-4 h-4 ${f.color} flex-shrink-0`} />
                  <span className="text-muted-foreground">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Why Join?</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Stay ahead of the market</li>
                <li>• Instant buy/sell notifications</li>
                <li>• Ecosystem updates & news</li>
                <li>• Free & easy to use</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="https://t.me/CFBLOCKCHAINBOT"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="hero" size="xl" className="w-full">
                <Send className="w-5 h-5" />
                Launch Bot on Telegram
                <ArrowRight className="w-5 h-5" />
              </Button>
            </a>
            <p className="text-center text-xs text-muted-foreground">t.me/CFBLOCKCHAINBOT</p>
          </div>
        </div>

        {/* Right - Commands & Logo */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={cfLogo} alt="CF Blockchain" className="w-10 h-10 rounded-lg" />
              <h3 className="font-bold">How to Use</h3>
            </div>
            
            <ol className="space-y-3 text-sm text-muted-foreground mb-4">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                Open <a href="https://t.me/CFBLOCKCHAINBOT" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] underline">t.me/CFBLOCKCHAINBOT</a> on Telegram
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                Add the bot to any Telegram group
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                Send /start — the bot will register your group for live alerts
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                Sit back and receive automatic market alerts 24/7
              </li>
            </ol>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-primary font-mono">/</span> Bot Commands
            </h3>
            <div className="space-y-2">
              {commands.map((c) => (
                <div key={c.cmd} className="flex items-start gap-3 text-sm">
                  <code className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded text-xs whitespace-nowrap">{c.cmd}</code>
                  <span className="text-muted-foreground">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
