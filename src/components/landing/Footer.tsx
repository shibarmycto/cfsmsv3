import { MessageSquare, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="container mx-auto px-6 py-12 border-t border-border">
      <div className="grid md:grid-cols-4 gap-8 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl font-black text-gradient">CF</span>
            <span className="text-xl font-bold text-muted-foreground">Blockchain</span>
          </div>
          <p className="text-sm text-muted-foreground">
            CF Blockchain Network — Powered by CFGPT AI. 
            Mine. Trade. Earn. Grow.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Platform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><button onClick={() => navigate('/dashboard')} className="hover:text-primary transition-colors">Dashboard</button></li>
            <li><button onClick={() => navigate('/miner')} className="hover:text-primary transition-colors">Mining</button></li>
            <li><button onClick={() => navigate('/bank')} className="hover:text-primary transition-colors">CF Bank</button></li>
            <li><button onClick={() => navigate('/forum')} className="hover:text-primary transition-colors">Community</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Features</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><button onClick={() => navigate('/ai-twin')} className="hover:text-primary transition-colors">AI Virtual Twin</button></li>
            <li><button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-primary transition-colors">Smart Agent</button></li>
            <li><button onClick={() => navigate('/buy-crypto')} className="hover:text-primary transition-colors">Buy Crypto</button></li>
            <li><button onClick={() => navigate('/faqs')} className="hover:text-primary transition-colors">FAQs</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Connect</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><button onClick={() => navigate('/about')} className="hover:text-primary transition-colors">About Us</button></li>
            <li>
              <a 
                href="https://t.me/cfsmsbulkofficialchat" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-2"
              >
                <Send className="w-3 h-3" />
                Telegram
              </a>
            </li>
            <li>
              <a 
                href="mailto:customercare@cfsmsbulk.com" 
                className="hover:text-primary transition-colors"
              >
                Support
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold">CF Blockchain</span>
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
          © 2026 CF Blockchain. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
