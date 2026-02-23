import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0-5
  maxStars?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StarRating({ rating, maxStars = 5, size = 'sm', className = '' }: StarRatingProps) {
  const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const partial = !filled && i < rating;

        return (
          <Star
            key={i}
            className={`${starSize} ${
              filled
                ? 'fill-amber-400 text-amber-400'
                : partial
                  ? 'fill-amber-400/50 text-amber-400/50'
                  : 'fill-none text-muted-foreground/30'
            }`}
          />
        );
      })}
    </div>
  );
}
