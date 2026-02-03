import { Crown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PremiumBadgeProps {
  size?: 'sm' | 'md';
}

export default function PremiumBadge({ size = 'sm' }: PremiumBadgeProps) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center">
            <span className={`${sizeClasses} rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center`}>
              <Crown className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} fill="white" stroke="white" />
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Premium Member</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
