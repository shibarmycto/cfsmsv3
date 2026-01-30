import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WalkieTalkieState {
  isActive: boolean;
  isMuted: boolean;
  volume: number;
  currentChannel: string;
}

export function useWalkieTalkie(characterId: string, characterName: string) {
  const [state, setState] = useState<WalkieTalkieState>({
    isActive: false,
    isMuted: false,
    volume: 0.8,
    currentChannel: 'global'
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initialize audio context and channel
  useEffect(() => {
    const channel = supabase.channel(`walkie-${state.currentChannel}`)
      .on('broadcast', { event: 'voice' }, ({ payload }) => {
        if (payload.senderId !== characterId && !state.isMuted) {
          playVoiceData(payload.audioData, payload.senderName);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [characterId, state.currentChannel, state.isMuted]);

  const playVoiceData = useCallback((audioData: string, senderName: string) => {
    // In a real implementation, this would decode and play the audio
    // For now, we'll show a visual indicator
    console.log(`Receiving voice from ${senderName}`);
  }, []);

  const startTransmitting = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context for processing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      setState(prev => ({ ...prev, isActive: true }));
      toast.success('📻 Transmitting...');

      // In a full implementation, we would:
      // 1. Create an audio worklet to process the stream
      // 2. Encode to a compressed format
      // 3. Broadcast via Supabase Realtime
      
    } catch (error) {
      console.error('Microphone access denied:', error);
      toast.error('Microphone access required for walkie-talkie');
    }
  }, []);

  const stopTransmitting = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    toast.info(state.isMuted ? 'Walkie-talkie unmuted' : 'Walkie-talkie muted');
  }, [state.isMuted]);

  const setVolume = useCallback((volume: number) => {
    setState(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const changeChannel = useCallback((channel: string) => {
    setState(prev => ({ ...prev, currentChannel: channel }));
    toast.info(`Switched to channel: ${channel}`);
  }, []);

  return {
    ...state,
    startTransmitting,
    stopTransmitting,
    toggleMute,
    setVolume,
    changeChannel
  };
}
