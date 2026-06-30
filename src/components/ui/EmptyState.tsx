interface P { icon?:React.ReactNode; title:string; description?:string; action?:React.ReactNode }
export default function EmptyState({ icon,title,description,action }:P) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon&&<div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-surface-200/30">{icon}</div>}
      <h3 className="text-sm font-semibold text-surface-200/70 mb-1">{title}</h3>
      {description&&<p className="text-xs text-surface-200/40 max-w-xs">{description}</p>}
      {action&&<div className="mt-4">{action}</div>}
    </div>
  )
}
