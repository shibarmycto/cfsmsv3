import { useState, useEffect } from 'react';
import splashImage from '@/assets/cf-roleplay-splash.png';

interface SplashScreenProps {
  onComplete: () => void;
  characterName: string;
}

export default function SplashScreen({ onComplete, characterName }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing world...');
  const [fadeOut, setFadeOut] = useState(false);

  const loadingSteps = [
    'Initializing world...',
    'Loading city assets...',
    'Generating buildings...',
    'Setting up roads...',
    'Spawning vehicles...',
    'Connecting to server...',
    'Loading player data...',
    'Preparing your character...',
    'Welcome to CF Roleplay!'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }, 500);
          return 100;
        }
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const stepIndex = Math.min(
      Math.floor((progress / 100) * loadingSteps.length),
      loadingSteps.length - 1
    );
    setLoadingText(loadingSteps[stepIndex]);
  }, [progress]);

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${splashImage})`,
          filter: 'brightness(0.6)'
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-end pb-20 px-8">
        {/* Welcome text */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Welcome, <span className="text-cyan-400">{characterName}</span>
          </h2>
          <p className="text-gray-400 text-sm md:text-base">
            Prepare to enter the world of CF Roleplay
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-full max-w-md">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-cyan-400">{loadingText}</span>
            <span className="text-white font-mono">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 text-center text-gray-500 text-xs max-w-md">
          <p className="animate-pulse">
            TIP: Use WASD or joystick to move, SHIFT/RUN to sprint, E to interact
          </p>
        </div>
      </div>

      {/* Corner branding */}
      <div className="absolute bottom-4 right-4 text-gray-600 text-xs">
        © 2024 CF Roleplay
      </div>
    </div>
  );
}
