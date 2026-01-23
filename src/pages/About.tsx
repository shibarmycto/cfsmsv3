import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  MessageSquare, 
  Mail, 
  Users, 
  Target, 
  Zap,
  ArrowRight,
  Send,
  Building,
  Handshake
} from 'lucide-react';

export default function About() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen hero-gradient">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-2xl font-black text-gradient">CF</span>
            <span className="text-xl font-bold text-muted-foreground">SMS</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              Home
            </Button>
            <a 
              href="https://t.me/cfsmsbulkofficialchat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Send className="w-4 h-4 text-[#0088cc]" />
              <span className="text-[#0088cc] font-medium text-sm hidden sm:inline">Telegram</span>
            </a>
            {user ? (
              <Button variant="hero" onClick={() => navigate('/dashboard')}>
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="hero" onClick={() => navigate('/auth')}>
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About <span className="text-gradient">CFSMS</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Your trusted partner for reliable bulk SMS solutions worldwide.
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
              description: 'To provide businesses with the most reliable and cost-effective bulk SMS platform, enabling seamless communication with their audience worldwide.',
            },
            {
              icon: Zap,
              title: 'What We Do',
              description: 'We offer a powerful CloudFlare-powered SMS platform that handles thousands of messages instantly with high delivery rates and custom sender IDs.',
            },
            {
              icon: Users,
              title: 'Who We Serve',
              description: 'From startups to enterprises, we help businesses of all sizes reach their customers through reliable SMS messaging across the UK and USA.',
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
                    Need custom solutions or high-volume pricing?
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

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="glass-card glow-border p-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of businesses using CFSMS for their messaging needs.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate('/auth')}>
            Start Sending Now
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold">CFSMS</span>
          </div>
          <a 
            href="https://t.me/cfsmsbulkofficialchat" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Send className="w-5 h-5 text-[#0088cc]" />
            <span className="text-[#0088cc] font-medium">@cfsmsbulkofficialchat</span>
          </a>
          <p className="text-muted-foreground text-sm">
            © 2024 CFSMS. CloudFlare-Powered Bulk SMS Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
