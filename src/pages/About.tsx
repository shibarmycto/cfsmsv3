import { 
  Mail, 
  Target, 
  Zap,
  Send,
  Building,
  Handshake,
  Link2,
  Pickaxe
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function About() {
  return (
    <div className="min-h-screen hero-gradient">
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Link2 className="w-4 h-4" />
            About CFSMS Network
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About <span className="text-gradient">CRYPTO FUND SMS</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Your trusted partner for blockchain innovation, social finance, and AI-powered growth.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Target,
              title: 'Our Mission',
              description: 'To make blockchain technology accessible to everyone, combining mining, social interaction, and real crypto rewards into one seamless platform.',
            },
            {
              icon: Zap,
              title: 'What We Do',
              description: 'We offer a powerful blockchain network with built-in mining (active until 2028), instant transfers, AI automation, and community features.',
            },
            {
              icon: Pickaxe,
              title: 'Who We Serve',
              description: 'From crypto newcomers to experienced traders, we help everyone participate in decentralized finance without technical barriers.',
            },
          ].map((item, index) => (
            <div 
              key={item.title} 
              className="stat-card animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Get in Touch</h2>
          
          <div className="space-y-6">
            {/* General Enquiries */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">General Enquiries</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    Questions about our services or need support?
                  </p>
                  <a 
                    href="mailto:customercare@cfsmsbulk.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    customercare@cfsmsbulk.com
                  </a>
                </div>
              </div>
            </div>

            {/* Partnerships */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Handshake className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Partnerships</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    Interested in partnering with us or reselling our services?
                  </p>
                  <a 
                    href="mailto:customercare@cfsmsbulk.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    customercare@cfsmsbulk.com
                  </a>
                </div>
              </div>
            </div>

            {/* Business */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Enterprise Solutions</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    Need custom solutions or high-volume access?
                  </p>
                  <a 
                    href="mailto:customercare@cfsmsbulk.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    customercare@cfsmsbulk.com
                  </a>
                </div>
              </div>
            </div>

            {/* Telegram */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0088cc]/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-6 h-6 text-[#0088cc]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Telegram Support</h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    Join our Telegram for quick support and updates.
                  </p>
                  <a 
                    href="https://t.me/cfsmsbulkofficialchat" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0088cc] hover:underline font-medium"
                  >
                    @cfsmsbulkofficialchat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
