import { 
  Coins, 
  Pickaxe, 
  ArrowLeftRight, 
  MessageSquare,
  Wallet,
  Globe
} from 'lucide-react';

export default function BlockchainSection() {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          🔗 The <span className="text-gradient">CFSMS Blockchain</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          A decentralized digital network that combines blockchain technology with social-style interaction. 
          Unlike traditional blockchains that demand expensive hardware and technical expertise, CFSMS is built for everyone.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            icon: Coins,
            title: 'Send & Receive Value',
            description: 'Transfer value instantly across the network with minimal fees and maximum speed.',
          },
          {
            icon: Pickaxe,
            title: 'Mine Directly',
            description: 'Mine inside the ecosystem without expensive hardware or complex setup — active until 2028.',
          },
          {
            icon: Wallet,
            title: 'Withdraw & Convert',
            description: 'Convert your credits into USDC or BTC with real-world crypto utility.',
          },
          {
            icon: MessageSquare,
            title: 'Communicate Socially',
            description: 'Chat, transact, and connect with friends seamlessly inside the network.',
          },
          {
            icon: ArrowLeftRight,
            title: 'Instant Transfers',
            description: 'Use simple @username transfers — fast, social, and completely frictionless.',
          },
          {
            icon: Globe,
            title: 'Global Access',
            description: 'Access the network from anywhere in the world with no barriers to entry.',
          },
        ].map((feature, index) => (
          <div 
            key={feature.title} 
            className="stat-card animate-fade-in hover-scale"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <feature.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground text-sm">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
