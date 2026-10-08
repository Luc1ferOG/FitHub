import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { photoMedia } from '../services/photo-dependencies';
import { usePhotoMutations } from './use-photos';
import type { LocalPhoto, PhotoMetadata, PreparedPhoto } from '../types/progress-photo';

export function usePhotoDraft() {
  const { upload } = usePhotoMutations(); const [photo, setPhoto] = useState<LocalPhoto | null>(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null); const [locked, setLocked] = useState(false);
  const alive = useRef(true); const owned = useRef<LocalPhoto[]>([]); const prepared = useRef<PreparedPhoto | null>(null);
  const id = useRef<string | null>(null); const work = useRef<Promise<unknown> | null>(null);
  const working = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; const cleanup = () => Promise.all(owned.current.map((image) => photoMedia.cleanup(image)));
      if (work.current) void work.current.then(cleanup, cleanup); else void cleanup(); };
  }, []);
  function choose(image: LocalPhoto) {
    if (image.owned) owned.current.push(image);
    if (!alive.current) { void photoMedia.cleanup(image); return; }
    setPhoto(image); prepared.current = null; setError(null);
  }
  async function pick() {
    if (working.current || locked) return; working.current = true;
    setBusy(true); setError(null);
    try { const image = await photoMedia.pick(); if (image) choose(image); }
    catch (cause) { if (alive.current) setError(cause); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function save(metadata: PhotoMetadata) {
    if (!photo || working.current) return false; working.current = true;
    setBusy(true); setError(null); setLocked(true);
    const operation = (async () => {
      id.current ??= Crypto.randomUUID();
      prepared.current ??= await photoMedia.prepare(photo);
      await upload.mutateAsync({ id: id.current ?? '', metadata, prepared: prepared.current });
    })(); work.current = operation;
    try { await operation; return alive.current; }
    catch (cause) { if (alive.current) setError(cause); return false; }
    finally { working.current = false; if (alive.current) setBusy(false); work.current = null; }
  }
  return { photo, choose, pick, save, busy, error, locked };
}
