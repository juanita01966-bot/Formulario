import React, { useEffect, useState } from 'react';

export type AmbassadorAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AmbassadorAvatarRing = 'gold' | 'subtle' | 'none';

export interface AmbassadorAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  emoji?: string | null;
  size?: AmbassadorAvatarSize;
  ring?: AmbassadorAvatarRing;
  className?: string;
}

const SIZE_CLASSES: Record<
  AmbassadorAvatarSize,
  { box: string; text: string; emoji: string }
> = {
  xs: { box: 'h-5 w-5', text: 'text-[9px]', emoji: 'text-[11px]' },
  sm: { box: 'h-9 w-9', text: 'text-xs', emoji: 'text-base' },
  md: { box: 'h-11 w-11', text: 'text-sm', emoji: 'text-xl' },
  lg: { box: 'h-14 w-14', text: 'text-base', emoji: 'text-2xl' },
  xl: { box: 'h-20 w-20', text: 'text-xl', emoji: 'text-4xl' },
};

const RING_CLASSES: Record<AmbassadorAvatarRing, string> = {
  gold: 'ring-2 ring-[#C88A2B] ring-offset-1 ring-offset-[#FFFDF9] shadow-sm',
  subtle: 'ring-1 ring-[#DFCBB3] shadow-2xs',
  none: '',
};

function getInitials(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'RP';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'RP';
}

export const AmbassadorAvatar: React.FC<AmbassadorAvatarProps> = ({
  name,
  avatarUrl,
  emoji,
  size = 'sm',
  ring = 'subtle',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const normalizedSrc = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const normalizedEmoji = typeof emoji === 'string' ? emoji.trim() : '';

  useEffect(() => {
    setImgFailed(false);
  }, [normalizedSrc]);

  const showImage = Boolean(normalizedSrc) && !imgFailed;
  const showEmoji = !showImage && Boolean(normalizedEmoji);
  const sizeSpec = SIZE_CLASSES[size];
  const ringSpec = RING_CLASSES[ring];
  const initials = getInitials(name);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#3A2216] via-[#26150D] to-[#7A4610] text-[#F4CA73] font-serif font-bold select-none ${sizeSpec.box} ${ringSpec} ${className}`}
      aria-hidden={!name}
    >
      {showImage ? (
        <img
          src={normalizedSrc}
          alt={name ? `Foto de ${name}` : 'Foto de embajador'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : showEmoji ? (
        <span
          role="img"
          aria-label={name ? `Emblema de ${name}` : 'Emblema de embajador'}
          className={`font-sans leading-none ${sizeSpec.emoji}`}
        >
          {normalizedEmoji}
        </span>
      ) : (
        <span className={`leading-none tracking-tight ${sizeSpec.text}`}>{initials}</span>
      )}
    </span>
  );
};
