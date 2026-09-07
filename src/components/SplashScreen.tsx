import { useCallback, useEffect, useRef, useState } from "react";
// Loaded via import.meta.glob instead of a static import so the build
// never hard-fails when intro.mp4 hasn't been placed in src/assets on a
// given checkout (e.g. a repo export that dropped the large video file).
// If the file is present it plays normally; if it's missing the splash
// screen just skips straight to Home instead of crashing the build.
const introVideoModules = import.meta.glob("../assets/intro.mp4", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const introVideoUrl = Object.values(introVideoModules)[0] as string | undefined;

/**
 * App splash screen — plays once when the app opens:
 *
 *   1. Full black screen (1.5s).
 *   2. src/assets/intro.mp4 fades in, autoplays full-screen with sound
 *      (fade-in), with a light cinematic zoom + vignette over the clip.
 *   3. Audio + video fade out just before the clip ends.
 *   4. Short fade to black, then the Home screen opens (driven by the
 *      video's own `ended` event — never a fixed "guessed" timer).
 *
 * Click or Esc skips straight to Home at any point.
 */

const BLACK_SCREEN_MS = 1500; // full black hold before the video appears
const VIDEO_FADE_IN_MS = 400; // video + audio fade-in duration
const AUDIO_FADE_OUT_MS = 400; // audio (and screen) fade-out just before the clip ends
const EXIT_FADE_MS = 400; // fade to black after the video naturally ends
const SKIP_FADE_MS = 250; // quicker fade when the user skips manually
const MAX_SPLASH_TOTAL_MS = 300000; // only a very long media-failure safety net; never cut a normal intro short

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [showBlack, setShowBlack] = useState(true);
  const [videoVisible, setVideoVisible] = useState(false);
  const [exitFade, setExitFade] = useState<{ active: boolean; ms: number }>({
    active: false,
    ms: EXIT_FADE_MS,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const fadingOut = useRef(false);
  const rafId = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const at = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const finish = useCallback(
    (fadeMs: number) => {
      if (finished.current) return;
      finished.current = true;
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {
          /* noop */
        }
      }
      setExitFade({ active: true, ms: fadeMs });
      at(fadeMs, onFinish);
    },
    [at, onFinish]
  );

  const rampVolume = useCallback(
    (video: HTMLVideoElement, from: number, to: number, durationMs: number) => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        try {
          video.volume = from + (to - from) * t;
        } catch {
          /* noop */
        }
        if (t < 1) {
          rafId.current = requestAnimationFrame(step);
        } else {
          rafId.current = null;
        }
      };
      rafId.current = requestAnimationFrame(step);
    },
    []
  );

  const handleError = useCallback(() => {
    // Missing/unreadable video — never strand the app on a black screen.
    finish(SKIP_FADE_MS);
  }, [finish]);

  // Manual skip is intentionally immediate: the splash must never leave a
  // black frame over the application after ESC/click. Natural playback keeps
  // the cinematic fade, while a user skip removes the splash immediately.
  const skip = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearAllTimers();
    const v = videoRef.current;
    if (v) {
      try { v.pause(); } catch { /* noop */ }
    }
    onFinish();
  }, [clearAllTimers, onFinish]);

  const tryPlay = useCallback(
    (video: HTMLVideoElement) => {
      video.muted = false;
      video.volume = 0;
      const p = video.play();
      if (p && typeof p.then === "function") {
        p.then(() => rampVolume(video, 0, 1, VIDEO_FADE_IN_MS)).catch(() => {
          // Autoplay-with-sound blocked (e.g. outside Electron, no user
          // gesture yet) — fall back to a muted autoplay so the visuals
          // still run instead of stalling.
          video.muted = true;
          video.play().catch(handleError);
        });
      }
    },
    [handleError, rampVolume]
  );

  // Phase 1: black hold, then reveal + play the video.
  useEffect(() => {
    if (!introVideoUrl) {
      // No intro.mp4 in this checkout — skip the splash entirely instead
      // of holding a black screen with nothing to play.
      finish(SKIP_FADE_MS);
      return;
    }
    at(BLACK_SCREEN_MS, () => {
      setShowBlack(false);
      setVideoVisible(true);
      const v = videoRef.current;
      if (v) tryPlay(v);
    });
    // Safety net for Electron/browser media implementations where an MP4
    // may never fire loadedmetadata/ended (or autoplay can remain pending).
    // The splash must never prevent the real application from appearing.
    at(MAX_SPLASH_TOTAL_MS, () => finish(SKIP_FADE_MS));
    return clearAllTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc key skips the intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [skip]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const durationMs = v.duration * 1000;

    // Cinematic zoom spans the whole clip — duration comes from the real
    // video, never a guessed constant.
    v.style.animation = `splashVideoFadeIn ${VIDEO_FADE_IN_MS}ms ease-out both, splashCinematicZoom ${durationMs}ms linear both`;

    // Fade the AUDIO only during the final part of the real clip. The
    // audience screen itself must stay visible until the video's native
    // `ended` event. The old implementation also faded the whole screen
    // before `ended`, which made the intro look like it finished early.
    const fadeOutAt = Math.max(0, durationMs - AUDIO_FADE_OUT_MS);
    at(fadeOutAt, () => {
      if (fadingOut.current || finished.current) return;
      fadingOut.current = true;
      rampVolume(v, v.volume, 0, AUDIO_FADE_OUT_MS);
    });
  };

  // The real transition trigger — driven by the video itself, not a timer.
  const handleEnded = () => {
    // Natural completion is the only automatic exit path. `skip()` remains
    // the explicit user escape hatch.
    finish(EXIT_FADE_MS);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none bg-black"
      role="presentation"
      aria-hidden="true"
      onPointerDownCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        skip();
      }}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        skip();
      }}
    >
      {showBlack && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <span
            className="text-sm font-semibold tracking-[0.35em] text-white/60"
            style={{ animation: `splashLogoFade ${BLACK_SCREEN_MS}ms ease-in-out 1 both` }}
          >
            WAB · TKD
          </span>
          <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-[0.2em] text-white/35">
            PRESS ESC OR CLICK TO SKIP
          </span>
        </div>
      )}

      {videoVisible && (
        <>
          <video
            ref={videoRef}
            src={introVideoUrl}
            preload="auto"
            playsInline
            autoPlay
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              animation: `splashVideoFadeIn ${VIDEO_FADE_IN_MS}ms ease-out both`,
              transformOrigin: "center",
            }}
          />
          {/* Vignette — light shading on the edges for a cinematic look */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
          />
          {/* Faint black overlay for extra cinematic contrast */}
          <div className="absolute inset-0 pointer-events-none bg-black/10" />
        </>
      )}

      {/* Fade to black — either the natural pre-ended fade-out, or the exit fade after `ended` */}
      <div
        className="absolute inset-0 bg-black pointer-events-none"
        style={
          exitFade.active
            ? { animation: `splashFinalFadeOut ${exitFade.ms}ms ease-in both` }
            : { opacity: 0 }
        }
      />
    </div>
  );
}
