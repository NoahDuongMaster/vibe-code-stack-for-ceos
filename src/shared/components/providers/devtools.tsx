'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then(
      (mod) => mod.ReactQueryDevtools,
    ),
  { ssr: false },
);

function ReactScanInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('react-scan').then((mod) => {
        mod.scan({ enabled: true, log: false, showToolbar: true });
      });
    }
  }, []);

  return null;
}

export function Devtools() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      <ReactScanInit />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </>
  );
}
