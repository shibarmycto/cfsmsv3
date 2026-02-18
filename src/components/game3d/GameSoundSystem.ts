// Lightweight sound effect system using Web Audio API with synthetic sounds
// No external files needed - generates all sounds procedurally

class GameSoundSystem {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.7;
  private lastPlayTime: Record<string, number> = {};

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new AudioContext();
      } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on: boolean) { this.enabled = on; }
  isEnabled() { return this.enabled; }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }

  // Throttle: don't replay same sound within ms
  private throttle(id: string, ms: number): boolean {
    const now = Date.now();
    if (this.lastPlayTime[id] && now - this.lastPlayTime[id] < ms) return false;
    this.lastPlayTime[id] = now;
    return true;
  }

  playGunshot() {
    if (!this.throttle('gunshot', 120)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    // White noise burst for gunshot crack
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for boom
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    noise.start();

    // Thump sub-bass
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    oscGain.gain.setValueAtTime(this.volume * 0.6, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  playCarStart() {
    if (!this.throttle('carstart', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.4, ctx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(this.volume * 0.6, ctx.currentTime + 0.8);
    gain.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    // Engine rumble via detuned oscillators
    [55, 110, 82].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq * 0.6, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 0.5);
      osc.frequency.linearRampToValueAtTime(freq * 1.3, ctx.currentTime + 1.2);
      osc.frequency.linearRampToValueAtTime(freq * 0.9, ctx.currentTime + 2);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.15;
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 2.5);
    });
  }

  playCarDrive() {
    if (!this.throttle('cardrive', 300)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 30, ctx.currentTime);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  playFootstep() {
    if (!this.throttle('footstep', 250)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + Math.random() * 400;
    filter.Q.value = 2;

    noise.connect(filter);
    filter.connect(gain);
    noise.start();
  }

  playHit() {
    if (!this.throttle('hit', 200)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playPickup() {
    if (!this.throttle('pickup', 200)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  playDeath() {
    if (!this.throttle('death', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  }

  playAirdropCollect() {
    if (!this.throttle('airdrop', 500)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    // Rising arpeggio
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g);
      g.connect(gain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  dispose() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.ctx = null;
  }
}

// Singleton
export const gameSounds = new GameSoundSystem();
