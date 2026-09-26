// 16 kHz mono PCM16, ~128 ms packets; flush the final partial packet on stop.
class CortexPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.port.onmessage = () => { this.flush(); this.port.postMessage({ flushed: true }); };
  }
  flush() {
    if (!this.samples.length) return;
    const bytes = new ArrayBuffer(this.samples.length * 2);
    const view = new DataView(bytes);
    this.samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
    this.samples = [];
    this.port.postMessage({ bytes }, [bytes]);
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const sample of channel) {
      const clamped = Math.max(-1, Math.min(1, sample));
      this.samples.push(Math.round(clamped * (clamped < 0 ? 32768 : 32767)));
      if (this.samples.length >= 2048) this.flush();
    }
    return true;
  }
}
registerProcessor("cortex-pcm", CortexPCM);
