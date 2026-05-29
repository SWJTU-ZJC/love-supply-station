const PS_BASE = 'https://play.pokemonshowdown.com/sprites/gen5';
const LOCAL_BASE = '/assets/pixel-sprites';

export const SPRITES = {
  // Pokemon sprites from CDN (cdn=true)
  pikachu:   { file: 'pikachu.png', cdn: true },
  snorlax:   { file: 'snorlax.png', cdn: true },
  jigglypuff:{ file: 'jigglypuff.png', cdn: true },
  eevee:     { file: 'eevee.png', cdn: true },
  meowth:    { file: 'meowth.png', cdn: true },
  chansey:   { file: 'chansey.png', cdn: true },
  luvdisc:   { file: 'luvdisc.png', cdn: true },
  smeargle:  { file: 'smeargle.png', cdn: true },
  jirachi:   { file: 'jirachi.png', cdn: true },
  togepi:    { file: 'togepi.png', cdn: true },
  farfetchd: { file: 'farfetchd.png', cdn: true },
  diglett:   { file: 'diglett.png', cdn: true },
  milotic:   { file: 'milotic.png', cdn: true },
  psyduck:   { file: 'psyduck.png', cdn: true },
  cubone:    { file: 'cubone.png', cdn: true },
  primeape:  { file: 'primeape.png', cdn: true },
  slowpoke:  { file: 'slowpoke.png', cdn: true },
  vulpix:    { file: 'vulpix.png', cdn: true },
  // Local SVGs
  pokeball:  { file: 'pokeball.svg', cdn: false },
  greatball: { file: 'greatball.svg', cdn: false },
  ultraball: { file: 'ultraball.svg', cdn: false },
  heart:     { file: 'heart.svg', cdn: false },
  map:       { file: 'map.svg', cdn: false },
} as const;

export function getAvatarSprite(emoji: string): keyof typeof SPRITES {
  return emoji === '🐻' ? 'snorlax' : 'jigglypuff';
}

export function spriteUrl(name: keyof typeof SPRITES): string {
  const s = SPRITES[name];
  return s.cdn ? `${PS_BASE}/${s.file}` : `${LOCAL_BASE}/${s.file}`;
}

export default function PixelSprite({ name, size = 28, className }: { name: keyof typeof SPRITES; size?: number; className?: string }) {
  return (
    <img
      src={spriteUrl(name)}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block', objectFit: 'contain' }}
    />
  );
}
