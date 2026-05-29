const BASE = '/assets/pixel-sprites';

export interface PixelSprite {
  src: string;   // e.g. 'pikachu-gen5.png'
  alt?: string;
}

export const SPRITES = {
  pikachu: 'pikachu-gen5.png',
  snorlax: 'snorlax-gen5.png',
  clefairy: 'clefairy-gen5.png',
  eevee: 'eevee-gen5.png',
  meowth: 'meowth-gen5.png',
  chansey: 'chansey-gen5.png',
  luvdisc: 'luvdisc-gen5.png',
  smeargle: 'smeargle-gen5.png',
  jirachi: 'jirachi-gen5.png',
  togepi: 'togepi-gen5.png',
  pokeball: 'pokeball.svg',
  greatball: 'greatball.svg',
  ultraball: 'ultraball.svg',
  heart: 'heart.svg',
  map: 'map.svg',
} as const;

export function spriteUrl(name: keyof typeof SPRITES): string {
  return `${BASE}/${SPRITES[name]}`;
}

export default function PixelSprite({ name, size = 28, className }: { name: keyof typeof SPRITES; size?: number; className?: string }) {
  return (
    <img
      src={spriteUrl(name)}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
