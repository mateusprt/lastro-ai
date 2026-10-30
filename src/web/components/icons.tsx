import type { ComponentType } from '../../shared/simulation.js';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const TYPE_PATHS: Record<ComponentType, React.ReactNode> = {
  load_balancer: (
    <>
      <circle cx="4" cy="10" r="1.8" />
      <path d="M5.8 10h3.2M9 10l6-5M9 10h6M9 10l6 5" />
      <circle cx="16" cy="5" r="0.4" />
      <circle cx="16" cy="10" r="0.4" />
      <circle cx="16" cy="15" r="0.4" />
    </>
  ),
  app: (
    <>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M3 7.5h14M8 11l-2 1.5 2 1.5M12 11l2 1.5-2 1.5" />
    </>
  ),
  cache: <path d="M11 2.5 4.5 11h5L8.5 17.5 15.5 8.5h-5z" />,
  database: (
    <>
      <ellipse cx="10" cy="4.5" rx="6" ry="2" />
      <path d="M4 4.5v11c0 1.1 2.7 2 6 2s6-.9 6-2v-11M4 10c0 1.1 2.7 2 6 2s6-.9 6-2" />
    </>
  ),
  queue: (
    <>
      <rect x="2.5" y="7" width="4" height="6" rx="1" />
      <rect x="8" y="7" width="4" height="6" rx="1" />
      <rect x="13.5" y="7" width="4" height="6" rx="1" />
    </>
  ),
  worker: (
    <>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
    </>
  ),
  external: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 2.8 4.4 2.8 7S12 15 10 17c-2-2-2.8-4.4-2.8-7S8 5 10 3z" />
    </>
  ),
};

export function TypeIcon({ type, ...p }: IconProps & { type: ComponentType }) {
  return <Svg {...p}>{TYPE_PATHS[type]}</Svg>;
}

/** Marca da Lastro: o disco de Plimsoll, a linha de carga pintada no casco dos navios. */
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 5 4 8.5 7.5 12M4 8.5h8a4 4 0 0 1 0 8H9" />
  </Svg>
);
export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.5 5 16 8.5 12.5 12M16 8.5H8a4 4 0 0 0 0 8h3" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10M8.5 9v4.5M11.5 9v4.5" />
  </Svg>
);
export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Svg>
);
export const WarnIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4.5M10 13.5v.2" />
  </Svg>
);
export const CriticalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3 18 16.5H2z" />
    <path d="M10 8v3.5M10 14v.2" />
  </Svg>
);
export const EntryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 10h10M9 6l4 4-4 4M16.5 4v12" />
  </Svg>
);
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 8 4 4 4-4" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Svg>
);
export const ReportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 2.5h7l3 3v12H5z" />
    <path d="M12 2.5v3h3M7.5 10h5M7.5 13h5M7.5 7h2" />
  </Svg>
);
export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M10 13.8v.2" />
  </Svg>
);
export const SpinnerIcon =(p: IconProps) => (
  <Svg {...p} className={`spin ${p.className ?? ''}`}>
    <path d="M10 3a7 7 0 1 1-7 7" />
  </Svg>
);
