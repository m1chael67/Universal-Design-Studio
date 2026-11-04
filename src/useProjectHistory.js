import {useCallback,useRef,useState} from 'react';

export const HISTORY_LIMIT=45;
export const HISTORY_WINDOW_MS=450;

// Pure helper: different gestures form separate steps; many pointer-move updates
// within a short gesture become one undo step.
export function nextHistory(history,previous,now=Date.now(),group='edit'){
  const join=history.past.length>0&&history.lastGroup===group&&(now-history.lastAt)<HISTORY_WINDOW_MS;
  return {
    past:join?history.past:[...history.past,previous].slice(-HISTORY_LIMIT),
    future:[],lastGroup:group,lastAt:now
  };
}
const fresh=()=>({past:[],future:[],lastGroup:null,lastAt:0});
export function useProjectHistory(initializer){
  const [project,setSnapshot]=useState(initializer);
  const snapshotRef=useRef(project),historyRef=useRef(fresh());
  const [versions,setVersions]=useState({canUndo:false,canRedo:false});
  const announce=useCallback(h=>setVersions({canUndo:h.past.length>0,canRedo:h.future.length>0}),[]);
  const setProject=useCallback((update,options={})=>{
    const previous=snapshotRef.current;
    const next=typeof update==='function'?update(previous):update;
    if(!next||next===previous)return;
    if(options.record!==false){
      const h=nextHistory(historyRef.current,previous,Date.now(),options.group||'edit');
      historyRef.current=h;announce(h);
    }
    snapshotRef.current=next;
    setSnapshot(next);
  },[announce]);
  const loadProject=useCallback(next=>{
    historyRef.current=fresh();announce(historyRef.current);
    snapshotRef.current=next;setSnapshot(next);
  },[announce]);
  const undo=useCallback(()=>{
    const h=historyRef.current;if(!h.past.length)return false;
    const previous=h.past[h.past.length-1];
    const updated={past:h.past.slice(0,-1),future:[snapshotRef.current,...h.future].slice(0,HISTORY_LIMIT),lastAt:0,lastGroup:null};
    historyRef.current=updated;announce(updated);
    snapshotRef.current=previous;setSnapshot(previous);
    return true;
  },[announce]);
  const redo=useCallback(()=>{
    const h=historyRef.current;if(!h.future.length)return false;
    const next=h.future[0];
    const updated={past:[...h.past,snapshotRef.current].slice(-HISTORY_LIMIT),future:h.future.slice(1),lastAt:0,lastGroup:null};
    historyRef.current=updated;announce(updated);
    snapshotRef.current=next;setSnapshot(next);
    return true;
  },[announce]);
  return {project,setProject,loadProject,undo,redo,...versions};
}
