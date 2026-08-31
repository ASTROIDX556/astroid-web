import { useDeferredValue, useMemo, useState } from 'react';
export type TransactionStatus = 'Pending' | 'Approved' | 'Rejected';
export function useTransactions(t:any[], o:any={}) {
  const [q,setQ] = useState('');
  const [s,setS] = useState('All');
  const [d,setD] = useState('All');
  const [ps,setPs] = useState(o.pageSize||10);
  const [cp,setCp] = useState(o.page||1);
  const dq = useDeferredValue(q).trim().toLowerCase();
  const f = useMemo(()=>t.filter((x:any)=>{if(dq&&!(x&assetCode+' '+x.destination+' '+x.agent).toLowerCase().includes(dq))return false;if(s!=='All'&&x.status!==s)return false;if(d!=='All'&&x.department!==d)return false;return true;}),[t,dq,s,d]);
  const total = Math.max(1, Math.ceil(f.length/ps));
  const cur = Math.min(cp, total);
  const start = (cur-1)*ps;
  const paged = f.slice(start, start+ps);
  const go = (p:number)=>setCp(Math.min(Math.max(1,p),total));
  return {searchQuery:q,setSearchQuery:setQ,statusFilter:s,setStatusFilter:setS,departmentFilter:d,setDepartmentFilter:setD,currentPage:cur,pageSize:ps,totalPages:total,filteredTransactions:f,pagedTransactions:paged,canPrevious:cur>1,canNext:cur<total,goToPage:go,nextPage:()=>go(cur+1),previousPage:()=>go(cur-1),setPageSize:(n:number)=>{setPs(Math.max(1,n));setCp(1)},departments:[...new Set(t.map((x:any)=>x.department).filter(Boolean))],isLoading:false}; }