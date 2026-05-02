// 仮 SE — Web Audio API のシンセサイザーで生成(ファイル素材不要)
//   後日 kawashima が魔王魂等で本番素材を assets/audio/ に置くまでの繋ぎ
//   localStorage で音量を永続化

const VOLUME_KEY = 'auto-strategos-volume-v1';

interface VolumeSettings {
  se: number;   // 0..1
  bgm: number;  // 0..1
}

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private volume: VolumeSettings;

  constructor() {
    this.volume = this.loadVolume();
  }

  // 初回ユーザーインタラクション後に AudioContext を作成(ブラウザのオートプレイ制約対応)
  private ensureContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private loadVolume(): VolumeSettings {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (!raw) return { se: 0.6, bgm: 0.4 };
      const parsed = JSON.parse(raw) as Partial<VolumeSettings>;
      return {
        se: typeof parsed.se === 'number' ? parsed.se : 0.6,
        bgm: typeof parsed.bgm === 'number' ? parsed.bgm : 0.4,
      };
    } catch {
      return { se: 0.6, bgm: 0.4 };
    }
  }

  private saveVolume(): void {
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify(this.volume));
    } catch {}
  }

  setSeVolume(v: number): void {
    this.volume.se = Math.max(0, Math.min(1, v));
    this.saveVolume();
  }
  setBgmVolume(v: number): void {
    this.volume.bgm = Math.max(0, Math.min(1, v));
    this.saveVolume();
  }
  getSeVolume(): number { return this.volume.se; }
  getBgmVolume(): number { return this.volume.bgm; }

  // === 仮 SE ===
  // 短いトーン: oscillator + envelope
  private playTone(opts: {
    freq: number;
    type?: OscillatorType;
    durMs?: number;
    attack?: number;
    decay?: number;
    freqEnd?: number;  // 終端周波数(ピッチ遷移)
    volume?: number;   // 0..1(SE 音量にさらに掛け算)
  }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.volume.se <= 0) return;

    const now = ctx.currentTime;
    const dur = (opts.durMs ?? 100) / 1000;
    const attack = opts.attack ?? 0.005;
    const decay = opts.decay ?? dur - attack;
    const localVol = (opts.volume ?? 1.0) * this.volume.se * 0.4;

    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(opts.freqEnd, now + dur);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(localVol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // ノイズ系(短い破壊音用)
  private playNoise(opts: { durMs?: number; volume?: number; freqLow?: number; freqHigh?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.volume.se <= 0) return;

    const dur = (opts.durMs ?? 150) / 1000;
    const localVol = (opts.volume ?? 1.0) * this.volume.se * 0.3;

    // ホワイトノイズバッファ
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opts.freqHigh ?? 1200, ctx.currentTime);
    if (opts.freqLow !== undefined) {
      filter.frequency.linearRampToValueAtTime(opts.freqLow, ctx.currentTime + dur);
    }
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(localVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  // === 公開メソッド: 各イベントで呼ばれる ===

  playClick(): void {
    this.playTone({ freq: 1200, type: 'sine', durMs: 60, volume: 0.7 });
  }

  playPlace(): void {
    // 駒配置: 短い低めの音
    this.playTone({ freq: 380, type: 'triangle', durMs: 90, volume: 1.0 });
  }

  playGo(): void {
    // Go ボタン: 下降アルペジオ風
    this.playTone({ freq: 660, type: 'square', durMs: 100, freqEnd: 440, volume: 0.8 });
  }

  playAttack(): void {
    // 攻撃: 短いビープ
    this.playTone({ freq: 280, type: 'sawtooth', durMs: 70, freqEnd: 200, volume: 0.6 });
  }

  playDestroy(): void {
    // 撃破: ノイズ + 周波数低下
    this.playNoise({ durMs: 220, freqHigh: 1500, freqLow: 200, volume: 1.0 });
  }

  playReach(): void {
    // 到達: 上昇音階
    this.playTone({ freq: 523, type: 'triangle', durMs: 120, volume: 0.8 });
    setTimeout(() => this.playTone({ freq: 659, type: 'triangle', durMs: 120, volume: 0.8 }), 100);
    setTimeout(() => this.playTone({ freq: 784, type: 'triangle', durMs: 200, volume: 0.9 }), 200);
  }

  playWin(): void {
    // 勝利: 上昇 4 音
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone({ freq, type: 'triangle', durMs: 200, volume: 0.9 }), i * 130);
    });
  }

  playLose(): void {
    // 敗北: 下降 3 音
    const notes = [523, 392, 261];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone({ freq, type: 'triangle', durMs: 280, volume: 0.7 }), i * 200);
    });
  }
}

export const soundManager = new SoundManager();
