import React, { useEffect, useRef, useState } from 'react';
const introVideoModules = import.meta.glob('../assets/intro.mp4', { eager: true, import: 'default', query: '?url' });
const introVideoUrl = Object.values(introVideoModules)[0] as string | undefined;
import appIconUrl from '@/assets/app-icon.png';

type Props = {
  active: boolean;
  onFinish: () => void;
};

export default function RoundStartIntroOverlay({ active, onFinish }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const [canSkip, setCanSkip] = useState(false);

  // Keep the latest callback without making the playback effect restart on
  // every parent render. The old implementation depended on `onFinish`,
  // which is usually an inline dispatch callback and can change identity
  // while the overlay is playing; that could restart the video unexpectedly.
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinishRef.current();
  };

  useEffect(() => {
    if (!active) {
      setCanSkip(false);
      return;
    }

    doneRef.current = false;
    setCanSkip(false);

    const v = videoRef.current;
    if (!v || !introVideoUrl) { finish(); return; }

    v.currentTime = 0;
    v.muted = false;

    const handleLoaded = () => setCanSkip(true);
    const handleEnded = () => finish();
    const handleError = () => {
      // If the media itself cannot load/play, do not trap the audience on a
      // black overlay. This is the only non-user path that may finish early.
      finish();
    };

    v.addEventListener('loadeddata', handleLoaded);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('error', handleError);

    const playPromise = v.play();
    playPromise?.catch(() => {
      // Browser autoplay policy may block audio. Retry muted first. Do NOT
      // finish the intro merely because the first play() promise was rejected.
      v.muted = true;
      const retry = v.play();
      retry?.catch(() => finish());
    });

    return () => {
      v.removeEventListener('loadeddata', handleLoaded);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('error', handleError);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter is reserved for the app's opening screen only — it must not
      // skip this per-round intro (Escape and the SKIP button still work).
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  if (!active) return null;

  return (
    <div className="round-start-intro" role="dialog" aria-modal="true" aria-label="Round intro">
      <video
        ref={videoRef}
        src={introVideoUrl || undefined}
        playsInline
        preload="auto"
        aria-label="Round introduction video"
      />
      <div className="round-start-intro-shade" />
      <div className="round-start-intro-brand">
        <img src={appIconUrl} alt="" />
        <span>WAB-TKD <strong>TAEKWONDO</strong></span>
      </div>

      <button
        type="button"
        className="round-start-intro-skip"
        onClick={finish}
        disabled={!canSkip}
        aria-label="Skip round intro"
      >
        SKIP INTRO
      </button>
    </div>
  );
}
