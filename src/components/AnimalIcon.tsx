import { type CSSProperties } from 'react';

const icons: Record<string, string> = {
  miles: 'icon-miles',
  camera: 'icon-camera',
  chat: 'icon-chat',
  critterpedia: 'icon-critterpedia',
  design: 'icon-design',
  diy: 'icon-diy',
  helicopter: 'icon-helicopter',
  map: 'icon-map',
  shopping: 'icon-shopping',
  variant: 'icon-variant',
  heart: 'icon-heart',
  gift: 'icon-gift',
  star: 'icon-star',
} as const;

export type AnimalIconName = keyof typeof icons;

interface AnimalIconProps {
  name: AnimalIconName;
  size?: number;
  bounce?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function AnimalIcon({ name, size = 24, bounce, className, style }: AnimalIconProps) {
  const fileName = icons[name];
  if (!fileName) return null;
  return (
    <span
      className={`inline-flex items-center justify-center ${bounce ? 'animal-icon-bounce' : ''} ${className || ''}`}
      style={{ width: size, height: size, ...style }}
    >
      <img
        src={`/assets/icons/${fileName}.svg`}
        alt={name}
        width={size}
        height={size}
        style={{ display: 'block' }}
      />
    </span>
  );
}

export const animalIconNames = Object.keys(icons) as AnimalIconName[];
