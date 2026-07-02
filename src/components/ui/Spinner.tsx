export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
}

export default function Spinner({ size = 'md' }: { size?: 'sm'|'md'|'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return <div className={`${s} border-2 border-brand-500 border-t-transparent rounded-full animate-spin`}/>
}
