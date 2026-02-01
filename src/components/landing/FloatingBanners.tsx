import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Terminal, 
  Bot, 
  Pickaxe, 
  Gamepad2, 
  TrendingUp,
  X,
  Sparkles,
  Zap
} from 'lucide-react';

interface Banner {
  id: string;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  action: string;
  color: string;
  link?: string;
  isExternal?: boolean;
}

const banners: Banner[] = [
  {
    id: 'vm-terminal',
    icon: Terminal,
    title: 'VM Terminal',
    description: 'Rent your own Ubuntu VM with browser',
    action: 'Explore',
    color: 'from-cyan-500 to-blue-600',
    link: '/dashboard?tab=vm'
  },
  {
    id: 'ai-worker',
    icon: Bot,
    title: 'AI Worker Bot',
    description: 'Earn rewards with AI tasks',
    action: 'Start',
    color: 'from-purple-500 to-pink-600',
    link: 'https://cfaiagentworker.pages.dev/',
    isExternal: true
  },
  {
    id: 'miner',
    icon: Pickaxe,
    title: 'CF Miner',
    description: 'Mine tokens directly in browser',
    action: 'Mine',
    color: 'from-yellow-500 to-orange-600',
    link: '/miner'
  },
  {
    id: 'roleplay',
    icon: Gamepad2,
    title: 'CF Roleplay',
    description: '3D open-world game experience',
    action: 'Play',
    color: 'from-green-500 to-emerald-600',
    link: '/roleplay'
  },
  {
    id: 'exchange',
    icon: TrendingUp,
    title: 'Token Exchange',
    description: 'Trade & create your own tokens',
    action: 'Trade',
    color: 'from-red-500 to-rose-600',
    link: '/exchange'
  }
];

export default function FloatingBanners() {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const handleClick = () => {
    const banner = banners[currentBanner];
    if (banner.isExternal && banner.link) {
      window.open(banner.link, '_blank');
    } else if (banner.link) {
      navigate(banner.link);
    }
  };

  if (!isVisible) return null;

  const banner = banners[currentBanner];
  const IconComponent = banner.icon;

  return (
    <>
      {/* Left floating banner */}
      <div 
        className="fixed left-4 top-1/3 z-40 hidden lg:block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          onClick={handleClick}
          className={`relative cursor-pointer bg-gradient-to-br ${banner.color} p-4 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 animate-pulse-glow`}
          style={{ width: '200px' }}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">{banner.title}</h4>
              <p className="text-white/70 text-xs">{banner.description}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <span className="text-white/80 text-xs">Dashboard Tool</span>
            <span className="text-white font-bold text-sm flex items-center gap-1">
              {banner.action} <Sparkles className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Banner indicators */}
        <div className="flex justify-center gap-1 mt-3">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentBanner(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentBanner ? 'bg-primary w-4' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right floating banner - Tools snapshot */}
      <div className="fixed right-4 top-1/3 z-40 hidden xl:block">
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-2xl" style={{ width: '220px' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h4 className="text-foreground font-bold text-sm">Dashboard Tools</h4>
          </div>
          
          <div className="space-y-2">
            {banners.map((b, i) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    if (b.isExternal && b.link) {
                      window.open(b.link, '_blank');
                    } else if (b.link) {
                      navigate(b.link);
                    }
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${
                    i === currentBanner 
                      ? `bg-gradient-to-r ${b.color} text-white` 
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{b.title}</span>
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-muted-foreground text-xs text-center">
              All tools available in your dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Mobile floating banner - bottom */}
      <div className="fixed bottom-20 left-4 right-4 z-40 lg:hidden">
        <div 
          onClick={handleClick}
          className={`bg-gradient-to-r ${banner.color} p-3 rounded-xl shadow-2xl flex items-center justify-between cursor-pointer`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">{banner.title}</h4>
              <p className="text-white/70 text-xs">{banner.description}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
            className="w-6 h-6 bg-black/30 rounded-full flex items-center justify-center"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}
