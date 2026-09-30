import type { FlightModel } from "../physics/FlightModel";

export class EngineAudio {
  enabled = false;
  private context?: AudioContext;
  private gain?: GainNode;
  private oscillator?: OscillatorNode;
  private filter?: BiquadFilterNode;
  playCombat(kind: "bomb" | "missile" | "explosion" | "lock") {
    if (!this.enabled || !this.context) return;
    const context = this.context,
      now = context.currentTime;
    const gain = context.createGain();
    const duration =
      kind === "explosion" ? 0.7 : kind === "missile" ? 0.35 : 0.15;
    gain.gain.setValueAtTime(kind === "explosion" ? 0.12 : 0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    gain.connect(context.destination);
    if (kind === "explosion" || kind === "missile") {
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = kind === "explosion" ? 300 : 1800;
      source.connect(filter);
      filter.connect(gain);
      source.start();
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } else {
      const source = context.createOscillator();
      source.type = "sine";
      source.frequency.setValueAtTime(kind === "lock" ? 880 : 180, now);
      source.frequency.exponentialRampToValueAtTime(
        kind === "lock" ? 1320 : 70,
        now + duration,
      );
      source.connect(gain);
      source.start();
      source.stop(now + duration);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    }
  }
  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      this.oscillator = this.context.createOscillator();
      this.oscillator.type = "sawtooth";
      this.oscillator.frequency.value = 43;
      this.filter = this.context.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 150;
      this.oscillator.connect(this.filter);
      this.filter.connect(this.gain);
      this.oscillator.start();
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 2,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.03) / 1.03;
        data[i] = last * 3;
      }
      const noise = this.context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      noise.connect(this.filter);
      noise.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    return this.enabled;
  }
  update(flight: FlightModel, paused: boolean) {
    if (!this.context || !this.gain || !this.oscillator || !this.filter) return;
    const t = this.context.currentTime;
    this.gain.gain.setTargetAtTime(
      this.enabled && !paused ? 0.028 + flight.throttle * 0.035 : 0,
      t,
      0.2,
    );
    this.oscillator.frequency.setTargetAtTime(
      32 + flight.throttle * 28,
      t,
      0.5,
    );
    this.filter.frequency.setTargetAtTime(130 + flight.speed * 1.3, t, 0.4);
  }
}
