import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

// Loads a JSON file from /public once; blocks rendering until it is available.
export function useJson<T>(file: string): T | null {
  const [data, setData] = useState<T | null>(() => (cache.get(file) as T) ?? null);
  const [handle] = useState(() => (cache.has(file) ? null : delayRender(`load ${file}`)));
  useEffect(() => {
    if (cache.has(file)) { if (handle !== null) continueRender(handle); return; }
    let p = pending.get(file);
    if (!p) { p = fetch(staticFile(file)).then((r) => r.json()).then((j) => { cache.set(file, j); return j; }); pending.set(file, p); }
    p.then((j) => { setData(j as T); if (handle !== null) continueRender(handle); });
  }, [file, handle]);
  return data;
}
