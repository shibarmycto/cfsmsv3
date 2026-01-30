import { useState } from 'react';
import { 
  X, Settings, Volume2, VolumeX, Monitor, Smartphone, 
  Eye, Crosshair, Gamepad2, Music, Bell, Sun, Moon
} from 'lucide-react';

interface GameSettingsProps {
  onClose: () => void;
  cameraMode: 'third' | 'first';
  setCameraMode: (mode: 'third' | 'first') => void;
  isMobile: boolean;
}

export default function GameSettingsMenu({
  onClose,
  cameraMode,
  setCameraMode,
  isMobile
}: GameSettingsProps) {
  const [volume, setVolume] = useState(70);
  const [musicVolume, setMusicVolume] = useState(50);
  const [notifications, setNotifications] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [controlScheme, setControlScheme] = useState<'default' | 'alternative'>('default');
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('medium');

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Settings className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <p className="text-xs text-gray-500">Game preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Settings sections */}
        <div className="space-y-6">
          {/* Camera */}
          <SettingsSection title="Camera" icon={<Eye className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCameraMode('third')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  cameraMode === 'third'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    : 'bg-gray-800/50 border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                <Monitor className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">3rd Person</span>
              </button>
              <button
                onClick={() => setCameraMode('first')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  cameraMode === 'first'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    : 'bg-gray-800/50 border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                <Crosshair className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">1st Person</span>
              </button>
            </div>
          </SettingsSection>

          {/* Controls */}
          <SettingsSection title="Controls" icon={<Gamepad2 className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Control Scheme</span>
                <select
                  value={controlScheme}
                  onChange={e => setControlScheme(e.target.value as 'default' | 'alternative')}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-white/10 outline-none"
                >
                  <option value="default">Default</option>
                  <option value="alternative">Alternative</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Show Crosshair</span>
                <ToggleSwitch checked={showCrosshair} onChange={setShowCrosshair} />
              </div>
            </div>
            
            {/* Control hints */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-white/5">
              <p className="text-xs text-gray-400 mb-2">
                {isMobile ? 'Mobile Controls:' : 'Keyboard Controls:'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {isMobile ? (
                  <>
                    <div className="text-gray-500">Left Joystick: <span className="text-white">Move</span></div>
                    <div className="text-gray-500">RUN Button: <span className="text-white">Sprint</span></div>
                    <div className="text-gray-500">JUMP Button: <span className="text-white">Jump</span></div>
                    <div className="text-gray-500">E Button: <span className="text-white">Interact</span></div>
                    <div className="text-gray-500">Sword Button: <span className="text-white">Attack</span></div>
                  </>
                ) : (
                  <>
                    <div className="text-gray-500">WASD: <span className="text-white">Move</span></div>
                    <div className="text-gray-500">SHIFT: <span className="text-white">Sprint</span></div>
                    <div className="text-gray-500">SPACE: <span className="text-white">Jump</span></div>
                    <div className="text-gray-500">E: <span className="text-white">Interact</span></div>
                    <div className="text-gray-500">V: <span className="text-white">Camera Toggle</span></div>
                    <div className="text-gray-500">R: <span className="text-white">Walkie-Talkie</span></div>
                    <div className="text-gray-500">T: <span className="text-white">Chat</span></div>
                    <div className="text-gray-500">ESC: <span className="text-white">Menu</span></div>
                  </>
                )}
              </div>
            </div>
          </SettingsSection>

          {/* Audio */}
          <SettingsSection title="Audio" icon={<Volume2 className="w-4 h-4" />}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Sound Effects</span>
                  <span className="text-gray-500 text-sm">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">Music</span>
                  <span className="text-gray-500 text-sm">{musicVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={musicVolume}
                  onChange={e => setMusicVolume(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>
          </SettingsSection>

          {/* Graphics */}
          <SettingsSection title="Graphics" icon={<Monitor className="w-4 h-4" />}>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Quality</span>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(quality => (
                  <button
                    key={quality}
                    onClick={() => setGraphicsQuality(quality)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      graphicsQuality === quality
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : 'bg-gray-800/50 text-gray-400 hover:text-white'
                    }`}
                  >
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection title="Notifications" icon={<Bell className="w-4 h-4" />}>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Enable Notifications</span>
              <ToggleSwitch checked={notifications} onChange={setNotifications} />
            </div>
          </SettingsSection>
        </div>

        {/* Save button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold hover:from-cyan-500 hover:to-blue-500 transition-all"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
      <div className="flex items-center gap-2 mb-4 text-white font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-all ${
        checked ? 'bg-cyan-500' : 'bg-gray-700'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );
}
