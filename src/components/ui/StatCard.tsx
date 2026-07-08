import { ReactNode } from 'react'
export default function StatCard({label,value,icon,iconBg='bg-white/5'}:{label:string;value:string|number;icon?:ReactNode;iconBg?:string}){
  return <div className="card p-4 flex items-center gap-4"><div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div><div><p className="text-xs text-surface-200/50 truncate">{label}</p><p className="text-xl font-bold text-surface-50">{value}</p></div></div>
}
