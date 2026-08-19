"use client";

import { useCallback, useRef, useState } from "react";
import { decodeWavBase64 } from "@/lib/audio";

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const playingRef = useRef(false);
  const nextTimeRef = useRef(0);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playNext = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || queueRef.current.length === 0) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    playingRef.current = true;
    setIsPlaying(true);

    const buffer = queueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = playNext;

    const startTime = Math.max(ctx.currentTime, nextTimeRef.current);
    source.start(startTime);
    nextTimeRef.current = startTime + buffer.duration;
  }, []);

  const enqueueChunk = useCallback(
    (base64: string) => {
      try {
        const ctx = getContext();
        const { samples, sampleRate } = decodeWavBase64(base64);
        if (samples.length === 0) return;
        const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
        audioBuffer.getChannelData(0).set(samples);
        queueRef.current.push(audioBuffer);
        if (!playingRef.current) playNext();
      } catch (e) {
        console.error("Audio decode error:", e);
      }
    },
    [getContext, playNext],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    nextTimeRef.current = 0;
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  const initAudio = useCallback(() => {
    getContext();
  }, [getContext]);

  return { enqueueChunk, isPlaying, stop, initAudio };
}
