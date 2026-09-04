// Ícones de linha simples, no estilo do app (monocromático, currentColor) —
// substituem os emojis (⚙ ★ ☆ ←), que renderizam de forma inconsistente
// entre plataformas e destoam do resto da interface.

type IconProps = { size?: number };

export function ChevronLeftIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function GearIcon({ size = 20 }: IconProps) {
  const dentes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7.5" />
      {dentes.map((deg) => (
        <line key={deg} x1="12" y1="2.2" x2="12" y2="4.4" transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  );
}

const ESTRELA_PATH = 'M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.77l-6.18 3.24L7 14.15l-5-4.87 6.91-1z';

export function StarIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={ESTRELA_PATH} />
    </svg>
  );
}

export function StarOutlineIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ESTRELA_PATH} />
    </svg>
  );
}

export function LockGlyph({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.75a4.75 4.75 0 0 0-4.75 4.75V10H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5h-.75V7.5A4.75 4.75 0 0 0 12 2.75zM9.25 10V7.5a2.75 2.75 0 0 1 5.5 0V10h-5.5zM12 14.25a1.5 1.5 0 0 1 .78 2.78l.32 2.22h-2.2l.32-2.22A1.5 1.5 0 0 1 12 14.25z"
      />
    </svg>
  );
}
