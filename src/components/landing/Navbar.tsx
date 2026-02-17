import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Send, Menu, X } from 'lucide-react';
import { useState } from 'react';
import cfLogo from '@/assets/cf-blockchain-logo.png';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'About', path: '/about' },
    { label: 'FAQs', path: '/faqs' },
    { label: 'Forum', path: '/forum' },
    { label: 'Exchange', path: '/exchange' },
    { label: 'Mining', path: '/miner' },
    { label: 'CFGPT', path: 'https://cfgpt.org/', external: true },
  ];

  return (
    <nav className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <img src={cfLogo} alt="CF Blockchain" className="h-8 sm:h-10 w-auto rounded-lg" />
          <div className="flex flex-col leading-none">
            <span className="text-sm sm:text-base font-black text-gradient">CF Blockchain</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground">Powered by CFGPT AI</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            link.external ? (
              <a
                key={link.path}
                href={link.path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </button>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a 
            href="https://t.me/cfsmsbulkofficialchat" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Send className="w-4 h-4 text-[#0088cc]" />
            <span className="text-[#0088cc] font-medium text-sm">Telegram</span>
          </a>
          {user ? (
            <Button variant="hero" onClick={() => navigate('/dashboard')}>
              Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Login
              </Button>
              <Button variant="hero" onClick={() => navigate('/auth')}>
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 py-4 border-t border-border animate-fade-in">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              link.external ? (
                <a
                  key={link.path}
                  href={link.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </button>
              )
            ))}
            <a 
              href="https://t.me/cfsmsbulkofficialchat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2"
            >
              <Send className="w-4 h-4 text-[#0088cc]" />
              <span className="text-[#0088cc] font-medium">Telegram</span>
            </a>
            <div className="flex gap-2 pt-2">
              {user ? (
                <Button variant="hero" className="w-full" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1" onClick={() => navigate('/auth')}>
                    Login
                  </Button>
                  <Button variant="hero" className="flex-1" onClick={() => navigate('/auth')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
