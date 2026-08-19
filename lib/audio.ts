/**
 * Decode a base64-encoded WAV chunk into a Float32Array for Web Audio.
 */
export function decodeWavBase64(base64: string): {
  samples: Float32Array;
  sampleRate: number;
} {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataOffset = 44;
  const dataLength = bytes.length - dataOffset;

  if (bitsPerSample !== 16) {
    console.warn(`Unexpected bits per sample: ${bitsPerSample}, assuming 16`);
  }

  const numSamples = dataLength / 2;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768.0;
  }
  return { samples, sampleRate };
}
