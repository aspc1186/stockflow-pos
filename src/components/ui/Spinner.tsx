import { cn } from '@/lib/utils'
interface SpinnerProps { size?: 'sm'|'md'|'lg'; className?: string }
export default function Spinner({ size='md', className }: SpinnerProps) {
  const s = { sm:'w-4 h-4', md:'w-6 h-6', lg:'w-10 h-10' }
  return <div className={cn('border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin', s[size], className)} />
}
export function PageLoader() {
  return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
}
