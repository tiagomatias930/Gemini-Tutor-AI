/**
 * Audio Analysis Utilities for Avatar Synchronization
 * Detects audio energy, frequency, and other metrics to sync avatar with AI speech
 */

export interface AudioMetrics {
  isActive: boolean;
  energy: number;           // 0-1, average energy level
  peakFrequency: number;    // Hz of dominant frequency
  bassEnergy: number;       // 0-1, low frequency energy (vocal fry/chest resonance)
  trebleEnergy: number;     // 0-1, high frequency energy (sibilants/consonants)
  frequencyData: Uint8Array; // Raw frequency data for visualization
}

/**
 * Audio Analyzer - handles real-time analysis of playing audio
 */
export class AudioAnalyzer {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private metrics: AudioMetrics;
  private audioContext: AudioContext;
  private energyThreshold: number = 20; // dB threshold for active speech

  constructor(audioContext: AudioContext, analyser: AnalyserNode) {
    this.audioContext = audioContext;
    this.analyser = analyser;
    this.analyser.fftSize = 2048;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.metrics = {
      isActive: false,
      energy: 0,
      peakFrequency: 0,
      bassEnergy: 0,
      trebleEnergy: 0,
      frequencyData: new Uint8Array(0),
    };
  }

  /**
   * Analyzes current audio data and returns metrics
   */
  public analyze(): AudioMetrics {
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate overall energy (RMS)
    const sum = this.dataArray.reduce((a, b) => a + b, 0);
    const energy = (sum / this.dataArray.length) / 255; // Normalize 0-1

    // Find peak frequency (where loudest component is)
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] > maxValue) {
        maxValue = this.dataArray[i];
        maxIndex = i;
      }
    }

    // Convert bin index to Hz
    const nyquist = this.audioContext.sampleRate / 2;
    const peakFrequency = (maxIndex / this.analyser.frequencyBinCount) * nyquist;

    // Separate bass and treble energy
    const midPoint = Math.floor(this.dataArray.length / 2);
    const bassData = this.dataArray.slice(0, midPoint);
    const trebleData = this.dataArray.slice(midPoint);

    const bassEnergy = bassData.reduce((a, b) => a + b, 0) / (bassData.length * 255);
    const trebleEnergy = trebleData.reduce((a, b) => a + b, 0) / (trebleData.length * 255);

    // Determine if voice is actively speaking (threshold-based)
    const isActive = energy > 0.15; // Threshold for speech detection

    this.metrics = {
      isActive,
      energy: Math.min(1, energy * 1.5), // Amplify for better visibility
      peakFrequency,
      bassEnergy: Math.min(1, bassEnergy * 1.5),
      trebleEnergy: Math.min(1, trebleEnergy * 1.5),
      frequencyData: new Uint8Array(this.dataArray),
    };

    return this.metrics;
  }

  /**
   * Get current metrics without re-analyzing
   */
  public getMetrics(): AudioMetrics {
    return this.metrics;
  }

  /**
   * Detect if speech has consonant sounds (high frequency sibilants)
   * Useful for mouth shape animation
   */
  public hasConsonants(): boolean {
    return this.metrics.trebleEnergy > 0.3;
  }

  /**
   * Detect if speech has vowel sounds (lower frequency)
   * Useful for open mouth animation
   */
  public hasVowels(): boolean {
    return this.metrics.bassEnergy > 0.2 && this.metrics.peakFrequency < 2000;
  }

  /**
   * Detect if speech has strong voice (useful for emphasis detection)
   */
  public isLoudSpeech(): boolean {
    return this.metrics.energy > 0.5;
  }

  /**
   * Calculate a "speech confidence" metric
   * Returns 0-1 value indicating likelihood of active speech
   */
  public getSpeechConfidence(): number {
    // Speech typically has:
    // - Medium to high energy
    // - Mixed frequency components (not all bass or all treble)
    // - Temporal variance
    const balancedFrequencies = 1 - Math.abs(this.metrics.bassEnergy - this.metrics.trebleEnergy);
    const combined = (this.metrics.energy * 0.4) + (balancedFrequencies * 0.3) + 
                    (this.metrics.isActive ? 0.3 : 0);
    return Math.min(1, combined);
  }
}

/**
 * Real-time audio-driven avatar gesture mapper
 * Converts audio metrics to avatar gesture parameters
 */
export class AudioGestureMapper {
  /**
   * Check if speech has consonant sounds (high frequency sibilants)
   */
  private static hasConsonants(metrics: AudioMetrics): boolean {
    return metrics.trebleEnergy > 0.3;
  }

  /**
   * Check if speech has vowel sounds (lower frequency)
   */
  private static hasVowels(metrics: AudioMetrics): boolean {
    return metrics.bassEnergy > 0.2 && metrics.peakFrequency < 2000;
  }

  /**
   * Check if speech has strong voice
   */
  private static isLoudSpeech(metrics: AudioMetrics): boolean {
    return metrics.energy > 0.5;
  }

  /**
   * Map audio metrics to gesture suggestion
   * Returns primary gesture name
   */
  static mapMetricsToGesture(
    metrics: AudioMetrics,
    baseGesture: string
  ): string {
    if (!metrics.isActive) {
      return baseGesture;
    }

    // During active speech, vary gestures based on audio characteristics
    if (this.isLoudSpeech(metrics)) {
      return 'explaining'; // Strong, emphatic speech
    }

    if (this.hasConsonants(metrics)) {
      return 'explaining'; // Consonant-rich = articulate speaking
    }

    if (metrics.peakFrequency < 1000) {
      // Low frequency dominant = likely chest voice or contemplative
      return 'explaining'; // Still explaining, but measured
    }

    return 'explaining';
  }

  /**
   * Calculate animation intensity (0-1) based on audio energy
   * Can be used to amplify avatar movements
   */
  static getAnimationIntensity(metrics: AudioMetrics): number {
    return Math.min(1, metrics.energy * 1.2);
  }

  /**
   * Calculate mouth openness (0-1) based on audio characteristics
   * 0 = closed, 1 = wide open
   */
  static getMouthOpenness(metrics: AudioMetrics): number {
    // Vowels = more open mouth
    // Consonants = more closed mouth
    const vowelInfluence = metrics.bassEnergy;
    const consonantInfluence = metrics.trebleEnergy;
    
    // Blend: vowels increase, consonants decrease
    return Math.min(1, Math.max(0.1, vowelInfluence - consonantInfluence * 0.3));
  }

  /**
   * Calculate head animation speed (0-1) based on speech pace
   * Fast frequency changes = rapid speech = faster head movement
   */
  static getHeadAnimationSpeed(metrics: AudioMetrics): number {
    // Higher treble energy suggests more articulate/faster speech
    return Math.min(1, 0.3 + metrics.trebleEnergy * 0.7);
  }

  /**
   * Calculate if avatar should show "listening" cues during pauses
   */
  static shouldShowListeningCues(metrics: AudioMetrics): boolean {
    return !metrics.isActive && metrics.energy < 0.1;
  }
}

/**
 * Animation frame-based audio analyzer that runs in requestAnimationFrame
 * Provides smooth, frame-synchronized audio analysis
 */
export class FrameSyncAudioAnalyzer {
  private analyser: AudioAnalyzer;
  private metrics: AudioMetrics;
  private animationFrameId: number | null = null;
  private listeners: ((metrics: AudioMetrics) => void)[] = [];
  private enabled: boolean = false;

  constructor(analyser: AudioAnalyzer) {
    this.analyser = analyser;
    this.metrics = analyser.getMetrics();
  }

  /**
   * Start continuous analysis synchronized with animation frames
   */
  public start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.analyzeFrame();
  }

  /**
   * Stop analysis
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.enabled = false;
  }

  /**
   * Subscribe to analysis updates
   */
  public onMetricsUpdated(listener: (metrics: AudioMetrics) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): AudioMetrics {
    return this.metrics;
  }

  /**
   * Animation frame loop
   */
  private analyzeFrame = (): void => {
    if (!this.enabled) return;

    this.metrics = this.analyser.analyze();
    
    // Notify all listeners
    for (const listener of this.listeners) {
      listener(this.metrics);
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.analyzeFrame);
  };
}
