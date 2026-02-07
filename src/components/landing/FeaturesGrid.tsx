import { 
  Pickaxe, 
  Bitcoin, 
  Youtube, 
  Zap, 
  Wallet, 
  ArrowLeftRight,
  MessageCircle,
  Bot,
  Users,
  Brain
} from 'lucide-react';

export default function FeaturesGrid() {
  const features = [
    {
      icon: Pickaxe,
      title: 'Built-In Mining',
      description: 'Mine directly inside the CFSMS ecosystem. No expensive hardware, no complex setup. Active until 2028!',
      badge: 'Until 2028',
      highlight: true,
    },
    {
      icon: Bitcoin,
      title: 'Hourly Bitcoin Roll',
      description: 'Roll every hour for a chance to earn Bitcoin rewards. Fun, engaging, and delivers real value.',
      badge: 'New',
    },
    {
      icon: Youtube,
      title: 'Watch-to-Earn',
      description: 'Earn credits by watching YouTube videos. Advertisers pay for promotions — a win-win ecosystem.',
      badge: 'Live',
      highlight: true,
    },
    {
      icon: Zap,
      title: 'Instant Transfers',
      description: 'Send value instantly using simple @username transfers. Fast, social, and frictionless.',
    },
    {
      icon: Wallet,
      title: 'Fast Withdrawals',
      description: 'Quick access to your funds with minimal waiting time. Your money, your control.',
    },
    {
      icon: ArrowLeftRight,
      title: 'Crypto Conversions',
      description: 'Withdraw credits and convert them into USDC or BTC. Real-world crypto utility.',
    },
    {
      icon: MessageCircle,
      title: 'Built-In Chat',
      description: 'Chat, transact, and connect with friends seamlessly inside the network.',
    },
    {
      icon: Bot,
      title: 'AI Smart Agent',
      description: 'AI-powered campaign automation. Optimize engagement, reach the right audience, grow intelligently.',
    },
    {
      icon: Users,
      title: 'Community Forum',
      description: 'Create discussions, share ideas, meet new friends, and build crypto-focused communities.',
    },
    {
      icon: Brain,
      title: 'CFGPT AI',
      description: 'Advanced AI research and development powering the CF blockchain with intelligent automation.',
      badge: 'New',
      link: 'https://cfgpt.org/',
    },
  ];

  return (
    <section id="features" className="container mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          ⚡ Network <span className="text-gradient">Features</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Everything you need to mine, earn, connect, and grow — all in one powerful ecosystem.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {features.map((feature, index) => {
          const CardWrapper = feature.link ? 'a' : 'div';
          const cardProps = feature.link ? { href: feature.link, target: '_blank', rel: 'noopener noreferrer' } : {};
          
          return (
            <CardWrapper 
              key={feature.title} 
              {...cardProps}
              className={`stat-card animate-fade-in relative ${feature.highlight ? 'glow-border' : ''} ${feature.link ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {feature.badge && (
                <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium ${
                  feature.badge === 'Until 2028' 
                    ? 'bg-primary text-primary-foreground' 
                    : feature.badge === 'New'
                    ? 'bg-green-500/20 text-green-400'
                    : feature.badge === 'Beta'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {feature.badge}
                </span>
              )}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1.5">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </CardWrapper>
          );
        })}
      </div>
    </section>
  );
}
