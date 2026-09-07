import React from 'react';

/** Clenched fist — used for "punch" (Jireugi / body punch) scores. */
export function PunchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="12" height="9" rx="3.5" fill="currentColor" />
      <rect x="7" y="4.5" width="3" height="6.5" rx="1.4" fill="currentColor" />
      <rect x="10.3" y="3.5" width="3" height="7.5" rx="1.4" fill="currentColor" />
      <rect x="13.6" y="4" width="3" height="7" rx="1.4" fill="currentColor" />
      <rect x="16.6" y="5" width="2.6" height="6" rx="1.3" fill="currentColor" />
      <path d="M4.5 12.5c0-1.6 1.3-2.8 2.8-2.5l1 4.5c-1.9.4-3.8-.6-3.8-2z" fill="currentColor" />
    </svg>
  );
}

/** Side-kick leg aimed at torso height, with a small vest silhouette — "trunk kick" (Momtong Chagi). */
export function TrunkKickIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* target torso, right side */}
      <path d="M16 6h4.5a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20.5 17H16V6z" fill="currentColor" opacity="0.35" />
      {/* kicking leg, bent knee, foot extended into torso height */}
      <path d="M3 19.5c0-2 .6-3.7 2-4.8l3.4-2.7c.6-.5.9-1.2.9-2V7.2c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v3.6c0 1.5-.6 2.9-1.8 3.8l-2.7 2.1c-.5.4-.8 1-.8 1.6v1.2c0 .8-.7 1.5-1.5 1.5H4.4c-.8 0-1.4-.6-1.4-1.5z" fill="currentColor" />
      <circle cx="9.6" cy="4.4" r="2.1" fill="currentColor" />
      <path d="M13 13.5l3.2-.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Kicking leg raised high toward a head silhouette — "head kick" (Eolgul Chagi). */
export function HeadKickIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* target head */}
      <circle cx="19" cy="5.5" r="3.2" fill="currentColor" opacity="0.35" />
      {/* kicking leg, high extension up to head height */}
      <path d="M2.5 20c0-1.8.7-3.4 2-4.5l3-2.5c.9-.8 1.4-1.9 1.4-3.1V6.6a1.9 1.9 0 1 1 3.8 0v3.5c-.1 2-1 3.8-2.5 5.1l-2.6 2.2c-.5.4-.8 1.1-.8 1.7v1.4c0 .8-.7 1.5-1.5 1.5H4c-.8 0-1.5-.7-1.5-1.5z" fill="currentColor" />
      <path d="M11.5 8.3L16.2 6.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.3" cy="4.6" r="2.1" fill="currentColor" />
    </svg>
  );
}

/** Same as head/trunk but with a rotation arrow — "spinning / turning" kick (Dwi/Momdollyeo Chagi). */
export function SpinKickIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="6" r="3" fill="currentColor" opacity="0.35" />
      <path d="M3 19.7c0-1.7.7-3.3 2-4.3l2.9-2.4c.9-.7 1.4-1.8 1.4-3V7c0-1 .8-1.8 1.8-1.8S13 6 13 7v3c0 1.9-.9 3.6-2.4 4.8l-2.5 2c-.5.4-.8 1-.8 1.7v1.2c0 .8-.6 1.5-1.4 1.5H4.4c-.8 0-1.4-.6-1.4-1.5z" fill="currentColor" />
      <circle cx="9" cy="4.3" r="2" fill="currentColor" />
      {/* rotation arrow */}
      <path d="M14.5 4a5 5 0 0 1 4.3 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M19.4 5.3l.8 2.2-2.3-.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
