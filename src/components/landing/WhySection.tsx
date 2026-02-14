import { Zap, Users, Shield, TrendingUp } from 'lucide-react';

export default function WhySection() {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          💡 Why <span className="text-gradient">CF Blockchain</span> Matters
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Many blockchains are powerful but difficult to use. CF Blockchain focuses on speed, simplicity, 
          and usability — making crypto friendly for beginners while delivering real blockchain value.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {[
          {
            icon: Zap,
            title: 'Speed First',
            description: 'Instant transfers and fast withdrawals with minimal waiting time.',
            stat: '< 1s',
            statLabel: 'Transfer Time',
          },
          {
            icon: Users,
            title: 'Built for Everyone',
            description: 'No technical expertise required. Simple, intuitive interface.',
            stat: '100K+',
            statLabel: 'Users',
          },
          {
            icon: Shield,
            title: 'Secure & Reliable',
            description: 'Enterprise-grade security with decentralized architecture.',
            stat: '99.9%',
            statLabel: 'Uptime',
          },
          {
            icon: TrendingUp,
            title: 'Real Value',
            description: 'Earn real crypto rewards that you can withdraw and convert.',
            stat: 'BTC/USDC',
            statLabel: 'Withdrawals',
          },
        ].map((item, index) => (
          <div 
            key={item.title} 
            className="stat-card text-center animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <item.icon className="w-7 h-7 text-primary" />
            </div>
            <div className="text-2xl font-bold text-gradient mb-1">{item.stat}</div>
            <div className="text-xs text-muted-foreground mb-3">{item.statLabel}</div>
            <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
            <p className="text-muted-foreground text-sm">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
