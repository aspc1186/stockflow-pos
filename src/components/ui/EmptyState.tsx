import { ReactNode } from 'react'
export default function EmptyState({icon,title,description,action}:{icon?:ReactNode;title:string;description?:string;action?:ReactNode}){
  return <div className="flex flex-col items-center justify-center py-16 text-center">{icon&&<div className="mb-4 text-surface-200/20">{icon}</div>}<p className="text-surface-200/60 font-medium">{title}</p>{description&&<p className="text-sm text-surface-200/30 mt-1">{description}</p>}{action&&<div className="mt-4">{action}</div>}</div>
}
