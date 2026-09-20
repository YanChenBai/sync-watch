import type { ReactNode } from 'react';

interface SvgProps {
  size?: number;
  children: ReactNode;
}

function Svg({ size = 18, children }: SvgProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ScreenIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect
        x="3"
        y="4"
        width="18"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path fill="currentColor" d="M10 8.4v5.2l4.4-2.6z" />
    </Svg>
  );
}

export function PlayIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path fill="currentColor" d="M8 5.14v13.72L19 12z" />
    </Svg>
  );
}

export function PauseIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />
    </Svg>
  );
}

export function VolumeIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path fill="currentColor" d="M4 9h3l4-3.6v13.2L7 15H4z" />

      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M14.8 9.6a3.8 3.8 0 0 1 0 4.8M17.6 7a7.4 7.4 0 0 1 0 10"
      />
    </Svg>
  );
}

export function VolumeOffIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path fill="currentColor" d="M4 9h3l4-3.6v13.2L7 15H4z" />

      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M15.2 10l4 4M19.2 10l-4 4"
      />
    </Svg>
  );
}

export function ExpandIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"
      />
    </Svg>
  );
}

export function CastIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        fill="currentColor"
        d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"
      />
    </Svg>
  );
}
