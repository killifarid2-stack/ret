import { useEffect } from 'react';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

/**
 * Central audience-display sizing engine.
 *
 * It measures the REAL browser viewport used by the Public Display window,
 * not the Operator window, and exposes the values as CSS variables. Every
 * broadcast animation can therefore use the same coordinate system and
 * safe-area rules. It also reacts to resize/display moves/fullscreen changes.
 */
export function useBroadcastViewport(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    let raf = 0;
    let resizeObserver: ResizeObserver | null = null;

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const width = Math.max(1, Math.round(window.innerWidth));
        const height = Math.max(1, Math.round(window.innerHeight));
        const ratio = width / height;
        const fitScale = Math.min(width / DESIGN_W, height / DESIGN_H);
        const coverScale = Math.max(width / DESIGN_W, height / DESIGN_H);
        const canvasWidth = DESIGN_W * fitScale;
        const canvasHeight = DESIGN_H * fitScale;
        const safeX = Math.max(8, Math.round((width - canvasWidth) / 2) + Math.round(width * 0.012));
        const safeY = Math.max(8, Math.round((height - canvasHeight) / 2) + Math.round(height * 0.012));

        root.style.setProperty('--wab-display-width', `${width}px`);
        root.style.setProperty('--wab-display-height', `${height}px`);
        root.style.setProperty('--wab-display-ratio', String(ratio));
        root.style.setProperty('--wab-design-width', `${DESIGN_W}px`);
        root.style.setProperty('--wab-design-height', `${DESIGN_H}px`);
        root.style.setProperty('--wab-broadcast-fit-scale', String(fitScale));
        root.style.setProperty('--wab-broadcast-cover-scale', String(coverScale));
        root.style.setProperty('--wab-broadcast-canvas-width', `${canvasWidth}px`);
        root.style.setProperty('--wab-broadcast-canvas-height', `${canvasHeight}px`);
        root.style.setProperty('--wab-broadcast-safe-x', `${safeX}px`);
        root.style.setProperty('--wab-broadcast-safe-y', `${safeY}px`);
        root.dataset.wabBroadcastRatio = ratio.toFixed(4);
        root.dataset.wabBroadcastWidth = String(width);
        root.dataset.wabBroadcastHeight = String(height);
        root.dataset.wabBroadcastFit = fitScale.toFixed(6);
      });
    };

    root.classList.add('wab-public-display');
    body.classList.add('wab-public-display');
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    window.addEventListener('fullscreenchange', update);
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(document.documentElement);

    // Electron can move the same public window between monitors. The CSS
    // viewport changes as soon as the move happens, so the resize observer is
    // enough for layout; this extra event covers compositor/fullscreen timing.
    const timer = window.setInterval(update, 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('fullscreenchange', update);
      resizeObserver?.disconnect();
      root.classList.remove('wab-public-display');
      body.classList.remove('wab-public-display');
      for (const key of [
        '--wab-display-width', '--wab-display-height', '--wab-display-ratio',
        '--wab-design-width', '--wab-design-height', '--wab-broadcast-fit-scale',
        '--wab-broadcast-cover-scale', '--wab-broadcast-canvas-width',
        '--wab-broadcast-canvas-height', '--wab-broadcast-safe-x',
        '--wab-broadcast-safe-y',
      ]) root.style.removeProperty(key);
      delete root.dataset.wabBroadcastRatio;
      delete root.dataset.wabBroadcastWidth;
      delete root.dataset.wabBroadcastHeight;
      delete root.dataset.wabBroadcastFit;
    };
  }, [enabled]);
}

export const BROADCAST_DESIGN_WIDTH = DESIGN_W;
export const BROADCAST_DESIGN_HEIGHT = DESIGN_H;
