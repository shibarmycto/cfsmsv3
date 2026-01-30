import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Heart, Zap, DollarSign, Users, Shield, Menu as MenuIcon, X, MessageSquare,
  Briefcase, Car, Building2, Settings, HelpCircle, BookOpen,
  Star, LogOut, Clock, Mic, MicOff, Radio, ChevronRight, Store,
  Fuel, Map, Phone, User, Crown, Swords, Home, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { GameBuilding } from './UKWorld';

interface EliteHUDProps {
  characterName: string;
  stats: {
    health: number;
    hunger: number;
    energy: number;
    cash: number;
    bank: number;
    wantedLevel: number;
  };
  gameTime: string;
  onlinePlayers: number;
  nearbyBuilding: GameBuilding | null;
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
  chatMessages: { sender: string; message: string; time: string }[];
  onExit: () => void;
  onSendMessage: (message: string) => void;
  isMobile: boolean;
  walkieTalkieActive: boolean;
  setWalkieTalkieActive: (active: boolean) => void;
  cameraMode: 'third' | 'first';
  setCameraMode: (mode: 'third' | 'first') => void;
}

export default function EliteHUD({
  characterName,
  stats,
  gameTime,
  onlinePlayers,
  nearbyBuilding,
  showChat,
  setShowChat,
  showMenu,
  setShowMenu,
  chatMessages,
  onExit,
  onSendMessage,
  isMobile,
  walkieTalkieActive,
  setWalkieTalkieActive,
  cameraMode,
  setCameraMode
}: EliteHUDProps) {
  const [showRules, setShowRules] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'world' | 'private' | 'radio'>('world');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  }, [chatInput, onSendMessage]);

  // Health bar color based on value
  const getHealthColor = (health: number) => {
    if (health > 70) return 'from-green-500 to-green-400';
    if (health > 40) return 'from-yellow-500 to-orange-400';
    return 'from-red-600 to-red-500';
  };

  return (
    <>
      {/* === TOP LEFT - Logo & Player Info === */}
      <div className="fixed top-3 left-3 z-20 flex flex-col gap-2">
        {/* Mini Map Placeholder / Logo */}
        <div className="relative">
          <div className="bg-black/90 backdrop-blur-md rounded-xl border border-cyan-500/30 p-2 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center">
                <span className="text-cyan-400 font-black text-sm md:text-lg">CF</span>
              </div>
              <div>
                <div className="text-white font-bold text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{characterName}</div>
                <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{gameTime}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Online Players */}
        <div className="bg-black/80 backdrop-blur-md rounded-lg border border-white/10 px-3 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-white text-xs font-medium">{onlinePlayers}</span>
        </div>
      </div>

      {/* === TOP RIGHT - Stats HUD === */}
      <div className="fixed top-3 right-3 z-20 flex flex-col gap-2 items-end">
        {/* Wanted Level - GTA Style */}
        <div className="bg-black/80 backdrop-blur-md rounded-lg border border-white/10 px-3 py-2 flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className={`w-4 h-4 md:w-5 md:h-5 transition-all duration-300 ${
                i <= stats.wantedLevel 
                  ? 'text-blue-400 fill-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' 
                  : 'text-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Main Stats Panel */}
        <div className="bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-3 min-w-[180px] md:min-w-[220px]">
          {/* Health Bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <Heart className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
              <span className="text-[10px] md:text-xs text-gray-400">{stats.health}%</span>
            </div>
            <div className="h-2 md:h-2.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full bg-gradient-to-r ${getHealthColor(stats.health)} transition-all duration-500 relative`}
                style={{ width: `${stats.health}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
              </div>
            </div>
          </div>

          {/* Energy Bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-400" />
              <span className="text-[10px] md:text-xs text-gray-400">{stats.energy}%</span>
            </div>
            <div className="h-2 md:h-2.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500 relative"
                style={{ width: `${stats.energy}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
              </div>
            </div>
          </div>

          {/* Hunger Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Fuel className="w-3 h-3 md:w-4 md:h-4 text-orange-400" />
              <span className="text-[10px] md:text-xs text-gray-400">{stats.hunger}%</span>
            </div>
            <div className="h-2 md:h-2.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 relative"
                style={{ width: `${stats.hunger}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
              </div>
            </div>
          </div>

          {/* Money */}
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
              <span className="text-green-400 font-bold text-xs md:text-sm">${stats.cash.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wallet className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
              <span className="text-blue-400 text-[10px] md:text-xs">${stats.bank.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Camera Toggle */}
        <button
          onClick={() => setCameraMode(cameraMode === 'third' ? 'first' : 'third')}
          className="bg-black/80 backdrop-blur-md rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-cyan-500/50 transition-all"
        >
          {cameraMode === 'third' ? '1st Person' : '3rd Person'}
        </button>
      </div>

      {/* === BOTTOM - Quick Actions === */}
      <div className="fixed bottom-3 right-3 z-20 flex flex-col gap-2">
        {/* Walkie Talkie */}
        <button
          onMouseDown={() => setWalkieTalkieActive(true)}
          onMouseUp={() => setWalkieTalkieActive(false)}
          onTouchStart={() => setWalkieTalkieActive(true)}
          onTouchEnd={() => setWalkieTalkieActive(false)}
          className={`p-3 md:p-4 rounded-xl border-2 transition-all duration-200 ${
            walkieTalkieActive 
              ? 'bg-green-500/30 border-green-400 text-green-400 scale-110' 
              : 'bg-black/80 border-white/10 text-gray-400 hover:border-green-500/50'
          }`}
        >
          <Radio className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {/* Chat */}
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
            showChat ? 'bg-cyan-500/30 border-cyan-400 text-cyan-400' : 'bg-black/80 border-white/10 text-gray-400 hover:border-cyan-500/50'
          }`}
        >
          <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {/* Menu */}
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
            showMenu ? 'bg-purple-500/30 border-purple-400 text-purple-400' : 'bg-black/80 border-white/10 text-gray-400 hover:border-purple-500/50'
          }`}
        >
          <MenuIcon className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {/* Exit */}
        <button 
          onClick={onExit}
          className="p-3 md:p-4 rounded-xl bg-black/80 border-2 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all"
        >
          <LogOut className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      </div>

      {/* === Interaction Prompt === */}
      {nearbyBuilding && (
        <div className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-pulse">
          <div className="bg-gradient-to-r from-cyan-500/90 to-blue-600/90 backdrop-blur-md rounded-xl px-6 py-3 border border-white/20 shadow-lg shadow-cyan-500/30">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-white" />
              <div>
                <div className="font-bold text-white">{nearbyBuilding.name}</div>
                <div className="text-xs text-white/80">{isMobile ? 'Tap E' : 'Press [E]'} to enter</div>
              </div>
              <ChevronRight className="w-5 h-5 text-white animate-bounce" />
            </div>
          </div>
        </div>
      )}

      {/* === Walkie Talkie Indicator === */}
      {walkieTalkieActive && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-md rounded-2xl px-8 py-6 border-2 border-green-500 shadow-lg shadow-green-500/50 animate-pulse">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500">
                <Mic className="w-8 h-8 text-green-400" />
              </div>
              <span className="text-green-400 font-bold text-lg">TRANSMITTING</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 bg-green-400 rounded animate-pulse" style={{ height: `${Math.random() * 20 + 10}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Chat Panel === */}
      {showChat && (
        <div className={`fixed z-30 bg-black/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl ${
          isMobile ? 'bottom-28 left-2 right-14' : 'bottom-20 left-4 w-96'
        }`}>
          {/* Chat Tabs */}
          <div className="flex border-b border-white/10">
            {(['world', 'private', 'radio'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            <button onClick={() => setShowChat(false)} className="px-3 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="h-40 md:h-52 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
            {chatMessages.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-8">No messages yet...</div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className="text-sm group">
                  <span className="text-gray-600 text-[10px]">[{msg.time}]</span>
                  <span className="text-cyan-400 ml-1 font-medium">{msg.sender}:</span>
                  <span className="text-gray-200 ml-1">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type message..."
                className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/5 focus:border-cyan-500/50 transition-colors"
              />
              <button
                onClick={handleSendMessage}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CF MENU === */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl p-6 max-w-lg w-full border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-black text-xl">CF</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">CF Menu</h2>
                  <p className="text-xs text-gray-500">Player Management</p>
                </div>
              </div>
              <button onClick={() => setShowMenu(false)} className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <MenuButton icon={User} label="Profile" color="cyan" onClick={() => toast.info('Open Profile from CF Menu!')} />
              <MenuButton icon={Briefcase} label="Jobs" color="green" onClick={() => toast.info('Criminal jobs available! Press J key')} />
              <MenuButton icon={Car} label="Vehicles" color="blue" onClick={() => toast.info('Visit the Dealership!')} />
              <MenuButton icon={Building2} label="Properties" color="purple" onClick={() => toast.info('Properties coming soon!')} />
              <MenuButton icon={Swords} label="Weapons" color="red" onClick={() => toast.info('Buy weapons at Gun Shop!')} />
              <MenuButton icon={Shield} label="Police" color="indigo" onClick={() => toast.info('Apply at Police Station!')} />
              <MenuButton icon={Crown} label="Gangs" color="pink" onClick={() => toast.info('Gang system active! Press G key')} />
              <MenuButton icon={Wallet} label="Exchange" color="yellow" onClick={() => toast.info('CF Credits exchange! Press C key')} />
              <MenuButton icon={Store} label="Shops" color="amber" onClick={() => toast.info('Find shops nearby!')} />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => { setShowMenu(false); setShowRules(true); }}
                className="flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-white/5 rounded-xl py-3 text-gray-300 hover:text-white transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">Rules</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowHelp(true); }}
                className="flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-white/5 rounded-xl py-3 text-gray-300 hover:text-white transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm">How to Play</span>
              </button>
            </div>

            {/* Settings & Exit */}
            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-white/5 rounded-xl py-3 text-gray-400 hover:text-white transition-all">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </button>
              <button
                onClick={onExit}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-xl py-3 text-red-400 hover:text-red-300 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Exit Game</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

function MenuButton({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: string; onClick: () => void }) {
  const colorClasses: Record<string, string> = {
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40',
    green: 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 hover:border-green-500/40',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/40',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40',
    red: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/40'
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 border transition-all ${colorClasses[color]}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full my-8 border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            CF Roleplay Rules
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-3 text-gray-300 text-sm max-h-[60vh] overflow-y-auto pr-2">
          {[
            'No racism, discrimination, or hate speech',
            'No sexual content or harassment',
            'Roleplay realistically - no fail RP',
            'Value your life in dangerous situations',
            'No metagaming (using outside info)',
            'No powergaming (forcing actions)',
            'Respect all players and staff',
            'No exploiting bugs or glitches',
            'Follow traffic laws unless in pursuit',
            'Criminal RP requires proper setup'
          ].map((rule, i) => (
            <div key={i} className="flex gap-3 p-3 bg-gray-800/50 rounded-lg border border-white/5">
              <span className="text-cyan-400 font-bold text-sm">{i + 1}.</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-red-400 text-xs font-medium p-3 bg-red-500/10 rounded-lg border border-red-500/20">
          ⚠️ Breaking rules may result in warnings, kicks, or permanent bans.
        </p>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full my-8 border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            How to Play
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2">
          <HelpSection title="🎮 Movement" items={[
            'WASD / Arrow Keys / Joystick - Move',
            'SHIFT / Hold RUN - Sprint faster',
            'SPACE / Jump button - Jump',
            'V - Toggle camera (1st/3rd person)'
          ]} />
          <HelpSection title="💬 Communication" items={[
            'T - Open text chat',
            'Hold R - Walkie talkie (voice)',
            'Tab - Private messages',
            'ESC - Open CF Menu'
          ]} />
          <HelpSection title="🏢 Interaction" items={[
            'E - Enter buildings/interact',
            'F - Pick up items',
            'Approach buildings to see options'
          ]} />
          <HelpSection title="💰 Economy" items={[
            'Visit Job Centre for employment',
            'Complete tasks to earn money',
            'Use ATMs to deposit/withdraw',
            'Buy vehicles at dealerships'
          ]} />
        </div>
      </div>
    </div>
  );
}

function HelpSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-3 bg-gray-800/50 rounded-lg border border-white/5">
      <h3 className="font-bold text-cyan-400 mb-2">{title}</h3>
      <ul className="space-y-1 text-gray-300">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-cyan-500 mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
