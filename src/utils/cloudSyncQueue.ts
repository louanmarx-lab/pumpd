import { callSecureBackend } from '../services/secureBackend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface CloudOperation { owner: string; path: string[]; data?: any; merge?: boolean; deleted?: boolean; revision: number; failedCode?:string }
const queues = new Map<string, Map<string, CloudOperation>>();
const loads = new Map<string, Promise<void>>();
const writes = new Map<string, Promise<void>>();
const workers = new Map<string, Promise<void>>();
const listeners = new Set<(owner: string, status: 'syncing'|'synced'|'error'|'offline') => void>();
const failed = new Set<string>();
const blockedOwners = new Set<string>();
const key = (owner: string) => `@ripped_cloud_outbox_${owner}`;
const resource = (op: CloudOperation) => JSON.stringify(op.path);
function mergeData(older:any,newer:any):any{
  if(!older||!newer||typeof older!=='object'||typeof newer!=='object'||Array.isArray(older)||Array.isArray(newer))return newer;
  const result={...older};for(const key of Object.keys(newer))result[key]=key in result?mergeData(result[key],newer[key]):newer[key];return result;
}
function coalesce(older:CloudOperation|undefined,newer:CloudOperation):CloudOperation{
  if(!older||!newer.merge||newer.deleted)return newer;
  return {...newer,merge:older.merge&&!older.deleted,data:mergeData(older.deleted?{}:older.data,newer.data)};
}
async function load(owner: string) {
  if (!loads.has(owner)) loads.set(owner, (async () => {
    const saved = await AsyncStorage.getItem(key(owner));
    const pending = queues.get(owner) || new Map();
    for (const op of saved ? JSON.parse(saved) as CloudOperation[] : []) {
      if(op.owner!==owner)continue;
      const newer=pending.get(resource(op));
      if(!newer)pending.set(resource(op),op);
      else pending.set(resource(op),coalesce(op,newer));
    }
    queues.set(owner, pending);
  })().catch(error => { loads.delete(owner); throw error; }));
  await loads.get(owner);
}
function announce(owner: string, status: 'syncing'|'synced'|'error'|'offline') { listeners.forEach(fn=>fn(owner,status)); }
function persist(owner: string) {
  if(blockedOwners.has(owner))return Promise.resolve();
  const next = (writes.get(owner) || Promise.resolve()).catch(()=>{}).then(()=>AsyncStorage.setItem(key(owner), JSON.stringify([...queues.get(owner)!.values()])));
  writes.set(owner,next); return next;
}
export function subscribeCloudQueue(listener: (owner: string,status:'syncing'|'synced'|'error'|'offline')=>void) { listeners.add(listener); return ()=>{listeners.delete(listener);}; }
export async function pendingCloudOperations(owner: string) { await load(owner); return [...queues.get(owner)!.values()]; }
export function queueCloudWrite(path: string[], data?: any, merge = false, deleted = false): Promise<void> {
  const owner = auth.currentUser?.uid;
  if (owner && blockedOwners.has(owner)) return Promise.reject(new Error('Account deletion is in progress.'));
  if (!owner || auth.currentUser?.isAnonymous) return Promise.resolve();
  if (path[0] !== 'users' || path.length < 2) return Promise.reject(new Error('Invalid cloud resource.'));
  const op: CloudOperation = {owner,path,data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)),merge,deleted,revision:Date.now()+Math.random()};
  // Register synchronously so a concurrent snapshot cannot overwrite an edit before its durable write.
  if (!queues.has(owner)) queues.set(owner,new Map());
  queues.get(owner)!.set(resource(op),coalesce(queues.get(owner)!.get(resource(op)),op));
  return (async()=>{try{await load(owner);await persist(owner);await flushCloudQueue(owner);}catch(error){failed.add(owner);announce(owner,'error');throw error;}})();
}
export async function flushCloudQueue(owner: string, retryRejected = false): Promise<void> {
  if (workers.has(owner)) { await workers.get(owner); if(queues.get(owner)?.size)await flushCloudQueue(owner); return; }
  const work=(async()=>{
    await load(owner);
    if (auth.currentUser?.uid !== owner) { announce(owner,'offline'); return; }
    const queue=queues.get(owner)!;
    if(retryRejected)for(const op of queue.values())delete op.failedCode;
    if (!queue.size) { announce(owner,failed.has(owner)?'error':'synced');return; }
    announce(owner,'syncing');
    try {
      while ([...queue.values()].some(op=>!op.failedCode)) {
        if(blockedOwners.has(owner)||auth.currentUser?.uid!==owner) {announce(owner,'offline');return;}
        const op=[...queue.values()].find(op=>!op.failedCode)!;
        const ref=doc(db,op.path[0],...op.path.slice(1));
        try{
          if(op.deleted) await deleteDoc(ref);
          else {
            const payload={...op.data};
            if(op.path.length===2&&op.path[1]===owner&&'clients' in payload){
              const result=await callSecureBackend<{clients:unknown[]}>('saveCoachRoster',{clients:payload.clients});
              if(Array.isArray(result.clients))op.data.clients=result.clients;
              delete payload.clients;
            }
            if(Object.keys(payload).length){if(op.merge||(op.path.length===2&&'clients' in op.data))await setDoc(ref,payload,{merge:true});else await setDoc(ref,payload);}
          }
        }catch(error){
          const code=(error as {code?:string}).code||'';
          if(code.endsWith('permission-denied')||code.endsWith('invalid-argument')){
            if(queue.get(resource(op))?.revision===op.revision)op.failedCode=code;
            await persist(owner);continue;
          }
          throw error;
        }
        if(queue.get(resource(op))?.revision===op.revision)queue.delete(resource(op));
        try{await persist(owner);}catch(error){if(!queue.has(resource(op)))queue.set(resource(op),op);throw error;}
      }
      if(queue.size)throw new Error('Some changes were rejected by the cloud service. Other changes were synced. Retry account sync after checking access.');
      failed.delete(owner);announce(owner,'synced');
    } catch(error) {failed.add(owner);announce(owner,'error');throw error;}
  })();
  workers.set(owner,work);
  try {await work;} finally {if(workers.get(owner)===work)workers.delete(owner);}
}
export async function clearCloudQueue(owner:string) { blockedOwners.add(owner); queues.set(owner,new Map());failed.delete(owner);await writes.get(owner)?.catch(()=>{});await AsyncStorage.removeItem(key(owner)); }

// A server snapshot replaces only its owner's collection. Pending local operations overlay it.
export function reconcileCloudRecords<T extends {userId:string;id:string}>(local:T[],remote:T[],uid:string,kind:string,ops:CloudOperation[]):T[] {
  const idOf=(item:any)=>kind==='nutrition'?item.date:item.id;
  const records=new Map(remote.map(item=>[idOf(item),{...item,userId:uid}]));
  for(const op of ops.filter(op=>op.path[1]===uid&&op.path[2]===kind)){
    if(op.deleted)records.delete(op.path[3]);else if(op.data)records.set(op.path[3],{...op.data,userId:uid});
  }
  return [...local.filter(item=>item.userId!==uid),...records.values()] as T[];
}
