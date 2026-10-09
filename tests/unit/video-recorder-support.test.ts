import { describe, it, expect } from 'vitest';
import {
  pickMimeType,
  extensionForMime,
  formatDuration,
  MIME_CANDIDATES,
} from '@/lib/video/recorder-support';

describe('pickMimeType', () => {
  it('préfère MP4 quand il est supporté (Safari, Chrome récent)', () => {
    const recorder = { isTypeSupported: (t: string) => t.startsWith('video/mp4') || t.startsWith('video/webm') };
    expect(pickMimeType(recorder)).toBe(MIME_CANDIDATES[0]);
  });

  it('retombe sur WebM quand MP4 est refusé (Chrome/Firefox anciens)', () => {
    const recorder = { isTypeSupported: (t: string) => t === 'video/webm;codecs=vp8,opus' };
    expect(pickMimeType(recorder)).toBe('video/webm;codecs=vp8,opus');
  });

  it('retourne undefined si aucun type reconnu → format par défaut du navigateur', () => {
    expect(pickMimeType({ isTypeSupported: () => false })).toBeUndefined();
  });

  it("retourne undefined si MediaRecorder n'existe pas ou sans isTypeSupported", () => {
    expect(pickMimeType(undefined)).toBeUndefined();
    expect(pickMimeType({})).toBeUndefined();
  });
});

describe('extensionForMime', () => {
  it.each([
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['VIDEO/WEBM', 'webm'],
    ['video/quicktime', 'mov'],
    ['', 'mp4'],
  ])('%s → %s', (mime, ext) => {
    expect(extensionForMime(mime)).toBe(ext);
  });
});

describe('formatDuration', () => {
  it('formate mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(9.9)).toBe('00:09');
    expect(formatDuration(90)).toBe('01:30');
  });

  it('ne descend jamais sous zéro', () => {
    expect(formatDuration(-5)).toBe('00:00');
  });
});
