import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { Coins } from 'lucide-react';

export default function KUBalanceBadge({ className }: { className?: string }) {
  const { balance, isLoading } = useKnowledgeUnits();

  if (isLoading) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium ${className || ''}`}>
      <Coins className="h-3.5 w-3.5" />
      <span>{balance} KU</span>
    </div>
  );
}
