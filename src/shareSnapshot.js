// Public links contain whitelisted plan geometry, never private customer or contact details.
import {normalizedInterior} from './tent3DMath.js';

export function makeSharedTent(t){
  const interior=t.interior?normalizedInterior(t):null;
  return {
    id:t.id,name:t.name,width:t.width,length:t.length,rotation:t.rotation,
    lat:t.lat,lng:t.lng,siteFlipLength:t.siteFlipLength,siteFlipWidth:t.siteFlipWidth,
    showInteriorOnMap:true,
    interior:interior?{
      orientation:'landscape-v1',sidewalls:interior.sidewalls,
      objects:interior.objects.map(o=>({
        id:o.id,catalog:o.catalog,type:o.type,label:o.label,
        x:o.x,y:o.y,w:o.w,h:o.h,rot:o.rot,
        heightInches:o.heightInches,tableId:o.tableId
      })),
      doors:interior.doors.map(d=>({wall:d.wall,at:d.at,width:d.width}))
    }:null
  };
}
// Customer share links created after the landscape editor launched omitted
// the orientation marker. Their positions were already landscape coordinates.
export function restoreSharedTent(t){
  if(!t?.interior||t.interior.orientation)return t;
  return {...t,interior:{...t.interior,orientation:'landscape-v1'}};
}
