import { useState } from 'react';
import { 
  Heart, Zap, DollarSign, Users, Shield, Menu, X, MessageSquare,
  Briefcase, Car, Building2, Settings, HelpCircle, BookOpen,
  Star, LogOut, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { GameBuilding } from './UKWorld';

interface GameHUDProps {
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
  isMobile: boolean;
}

export default function GameHUD({
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
  isMobile
}: GameHUDProps) {
  const [showRules, setShowRules] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [chatInput, setChatInput] = useState('');

  return (
    <>
      {/* Top HUD */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex justify-between items-start p-2 md:p-4">
          {/* Logo & Time */}
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-2 md:p-3 pointer-events-auto">
            <div className={`font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent ${isMobile ? 'text-sm' : 'text-xl'}`}>
              CF ROLEPLAY
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-white text-xs md:text-sm mt-1">
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              <span>{gameTime}</span>
            </div>
          </div>

          {/* Wanted Level */}
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-2 md:p-3">
            <div className="flex gap-0.5 md:gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={`w-3 h-3 md:w-5 md:h-5 ${
                    i <= stats.wantedLevel 
                      ? 'text-yellow-400 fill-yellow-400' 
                      : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-2 md:p-3 min-w-[120px] md:min-w-[200px]">
            <div className="text-white text-xs md:text-sm font-bold mb-1 md:mb-2 truncate">{characterName}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 md:gap-2">
                <Heart className="w-3 h-3 md:w-4 md:h-4 text-red-500 flex-shrink-0" />
                <div className="flex-1 h-1.5 md:h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${stats.health}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 flex-shrink-0" />
                <div className="flex-1 h-1.5 md:h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 transition-all" style={{ width: `${stats.energy}%` }} />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-1 md:mt-2 text-[10px] md:text-xs text-white">
              <span className="text-green-400">${stats.cash.toLocaleString()}</span>
              <span className="text-blue-400">Bank: ${stats.bank.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom HUD - Action buttons (non-mobile) */}
      {!isMobile && (
        <div className="fixed bottom-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
          <button 
            onClick={() => setShowChat(!showChat)}
            className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </button>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
          <button 
            onClick={onExit}
            className="bg-red-600 hover:bg-red-700 p-3 rounded-lg transition-colors"
          >
            <LogOut className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Players online */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2 text-white text-xs md:text-sm">
          <Users className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
          <span>{onlinePlayers} Online</span>
        </div>
      </div>

      {/* Interaction prompt */}
      {nearbyBuilding && (
        <div className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-yellow-600/90 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-center">
            <div className="font-bold text-sm md:text-base">{nearbyBuilding.name}</div>
            <div className="text-xs md:text-sm">{isMobile ? 'Tap E to interact' : 'Press [E] to interact'}</div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <div className={`fixed z-30 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-700 ${
          isMobile ? 'bottom-32 left-2 right-2' : 'bottom-20 left-4 w-80'
        }`}>
          <div className="p-2 border-b border-gray-700 flex justify-between items-center">
            <span className="text-white font-bold text-sm">World Chat</span>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-32 md:h-48 overflow-y-auto p-2 space-y-1">
            {chatMessages.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">No messages yet</div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className="text-xs md:text-sm">
                  <span className="text-gray-500">[{msg.time}]</span>
                  <span className="text-cyan-400 ml-1">{msg.sender}:</span>
                  <span className="text-white ml-1">{msg.message}</span>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-gray-700">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Game Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-4 md:p-6 max-w-md w-full border border-gray-700">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white">Game Menu</h2>
              <button onClick={() => setShowMenu(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <MenuButton icon={BookOpen} label="Rules" onClick={() => { setShowMenu(false); setShowRules(true); }} />
              <MenuButton icon={HelpCircle} label="How to Play" onClick={() => { setShowMenu(false); setShowHelp(true); }} />
              <MenuButton icon={Briefcase} label="Jobs" onClick={() => toast.info('Jobs coming soon!')} />
              <MenuButton icon={Car} label="Vehicles" onClick={() => toast.info('Vehicles coming soon!')} />
              <MenuButton icon={Building2} label="Properties" onClick={() => toast.info('Properties coming soon!')} />
              <MenuButton icon={Shield} label="Police" onClick={() => toast.info('Police system coming soon!')} />
              <MenuButton icon={Users} label="Organizations" onClick={() => toast.info('Orgs coming soon!')} />
              <MenuButton icon={Settings} label="Settings" onClick={() => toast.info('Settings coming soon!')} />
            </div>
            <button
              onClick={onExit}
              className="w-full mt-4 md:mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Exit Game
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <Modal title="CF Roleplay Rules" onClose={() => setShowRules(false)}>
          <div className="space-y-2 md:space-y-3 text-gray-300 text-xs md:text-sm">
            <Rule num={1} text="No racism, discrimination, or hate speech of any kind." />
            <Rule num={2} text="No sexual content or harassment." />
            <Rule num={3} text="Roleplay realistically - no 'fail RP'." />
            <Rule num={4} text="Value your life - act as you would in real danger." />
            <Rule num={5} text="No metagaming - don't use out-of-game information." />
            <Rule num={6} text="No powergaming - give others a chance to respond." />
            <Rule num={7} text="Respect all players and staff." />
            <Rule num={8} text="No exploiting bugs or glitches." />
            <Rule num={9} text="Follow traffic laws unless in a chase." />
            <Rule num={10} text="Criminal activities require proper RP setup." />
          </div>
          <p className="mt-4 text-red-400 text-xs md:text-sm font-bold">
            Breaking rules may result in warnings, kicks, or permanent bans.
          </p>
        </Modal>
      )}

      {/* Help Modal */}
      {showHelp && (
        <Modal title="How to Play" onClose={() => setShowHelp(false)}>
          <div className="space-y-3 md:space-y-4 text-gray-300 text-xs md:text-sm">
            <HelpSection title="Movement">
              <li>WASD / Joystick - Move around</li>
              <li>SHIFT / RUN button - Sprint faster</li>
              <li>SPACE / JUMP button - Jump</li>
            </HelpSection>
            <HelpSection title="Interaction">
              <li>E / Interact button - Enter buildings</li>
              <li>T - Open chat</li>
              <li>ESC - Open menu</li>
            </HelpSection>
            <HelpSection title="Economy">
              <li>Get a job at the Job Centre</li>
              <li>Complete tasks to earn money</li>
              <li>Deposit cash at banks</li>
            </HelpSection>
            <HelpSection title="Crime">
              <li>Criminal activities increase wanted level</li>
              <li>Police will chase at high wanted levels</li>
              <li>Rob other players (with proper RP)</li>
            </HelpSection>
          </div>
        </Modal>
      )}
    </>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg p-3 md:p-4 flex flex-col items-center gap-1 md:gap-2 transition-colors"
    >
      <Icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
      <span className="text-white text-xs md:text-sm">{label}</span>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center overflow-y-auto p-4">
      <div className="bg-gray-900 rounded-xl p-4 md:p-6 max-w-lg w-full my-8 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Rule({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex gap-2 md:gap-3">
      <span className="text-cyan-400 font-bold">{num}.</span>
      <span>{text}</span>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-cyan-400 mb-1">{title}</h3>
      <ul className="list-disc list-inside space-y-1">{children}</ul>
    </div>
  );
}
