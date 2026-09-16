import { randomUUID } from 'node:crypto';
import type { ActorIdentity, MemoryKind, MemoryRecord, MemoryScope } from '../../core/src/index.js';
import { LocalStateStore } from '../../local-state/src/index.js';
export class MemoryService {
  constructor(private readonly store: LocalStateStore) {}
  add(input:{kind:MemoryKind;scope:MemoryScope;scopeId?:string;subject?:string;value:string;source?:string;actor:ActorIdentity;confidence?:number}):MemoryRecord {
    const now=new Date().toISOString(); const record:MemoryRecord={id:`mem_${randomUUID().slice(0,8)}`,kind:input.kind,scope:input.scope,value:input.value,source:input.source??'senten.cli',actor:input.actor,createdAt:now,updatedAt:now,status:'active',...(input.scopeId?{scopeId:input.scopeId}:{}),...(input.subject?{subject:input.subject}:{}),...(input.confidence!==undefined?{confidence:input.confidence}:{})}; this.store.putMemory(record); return record;
  }
  resolve(scopes:{scope:MemoryScope;scopeId?:string}[]):MemoryRecord[] { const out=new Map<string,MemoryRecord>(); for(const selector of scopes){ for(const item of this.store.listMemory({scope:selector.scope,...(selector.scopeId?{scopeId:selector.scopeId}:{})})){ if(item.status!=='active')continue; const key=`${item.kind}:${item.subject??item.id}`; out.set(key,item); } } return [...out.values()]; }
}
