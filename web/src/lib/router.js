import { useEffect, useState } from 'react';

/** Hash routing — no dependency, and it survives a static host with no rewrites. */
export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/today');

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || '/today');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const [, section = 'today', param] = hash.split('/');
  return { path: hash, section, param };
}

export function navigate(to) {
  window.location.hash = to;
}
