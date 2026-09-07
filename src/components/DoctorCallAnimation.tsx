import React, { useMemo } from 'react';
import doctorCallImageUrl from '@/assets/doctor/doctor-call.png';

/**
 * WAB-TKD Doctor Call cinematic.
 *
 * The uploaded DOCTOR artwork is the visual centerpiece. The overlay is
 * intentionally self-contained so it can replace the normal public-screen
 * content whenever MatchContext enters status='doctor'.
 */
export default function DoctorCallAnimation({ isMiniPreview = false }: { isMiniPreview?: boolean }) {
  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: `${4 + ((i * 37) % 92)}%`,
    top: `${6 + ((i * 61) % 86)}%`,
    delay: `${(i % 9) * 0.18}s`,
    duration: `${2.8 + (i % 5) * 0.55}s`,
    size: `${2 + (i % 4)}px`,
  })), []);

  return (
    <div
      className={`doctor-call-overlay ${isMiniPreview ? 'doctor-call-overlay--mini' : ''}`}
      aria-label="DOCTOR CALL"
    >
      <div className="doctor-call-bg" />
      <div className="doctor-call-entry-flash" />
      <div className="doctor-call-grid" />
      <div className="doctor-call-red-aura" />
      <div className="doctor-call-gold-aura" />
      <div className="doctor-call-shockwave doctor-call-shockwave--one" />
      <div className="doctor-call-shockwave doctor-call-shockwave--two" />
      <div className="doctor-call-light-streak doctor-call-light-streak--left" />
      <div className="doctor-call-light-streak doctor-call-light-streak--right" />

      <div className="doctor-call-scan doctor-call-scan--one" />
      <div className="doctor-call-scan doctor-call-scan--two" />

      {particles.map((p) => (
        <span
          key={p.id}
          className="doctor-call-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}

      <div className="doctor-call-corner doctor-call-corner--tl" />
      <div className="doctor-call-corner doctor-call-corner--tr" />
      <div className="doctor-call-corner doctor-call-corner--bl" />
      <div className="doctor-call-corner doctor-call-corner--br" />

      <div className="doctor-call-content">
        <div className="doctor-call-kicker">
          <span className="doctor-call-kicker-line" />
          <span>MEDICAL ATTENTION</span>
          <span className="doctor-call-kicker-line" />
        </div>

        <div className="doctor-call-art-wrap">
          <div className="doctor-call-ring doctor-call-ring--outer" />
          <div className="doctor-call-ring doctor-call-ring--inner" />
          <div className="doctor-call-ring doctor-call-ring--pulse" />
          <div className="doctor-call-beam doctor-call-beam--left" />
          <div className="doctor-call-beam doctor-call-beam--right" />
          <img
            src={doctorCallImageUrl}
            alt="WAB-TKD Doctor"
            className="doctor-call-art"
            draggable={false}
          />
        </div>

        <div className="doctor-call-title-wrap">
          <div className="doctor-call-title">DOCTOR CALL</div>
          <div className="doctor-call-subtitle">PLEASE STAND BY</div>
        </div>
      </div>

      <div className="doctor-call-bottom-line">
        <span>WAB-TKD</span>
        <span className="doctor-call-dot" />
        <span>MEDICAL REVIEW</span>
        <span className="doctor-call-dot" />
        <span>OFFICIAL MATCH HOLD</span>
      </div>
    </div>
  );
}
