// Stage / stair attachment is derived from the geometry, not a stored foreign key.
// This keeps saved plans valid if stages are resized, rotated, moved, or deleted.
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const radians=o=>numeric(o.rot)*Math.PI/180;
const relative=(p,stage)=>{
  const dx=p.x-numeric(stage.x),dy=p.y-numeric(stage.y),a=radians(stage);
  return {x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};
};
function stairsTopInStage(stairs,stage){
  const a=radians(stairs),w=numeric(stairs.w,4),depth=numeric(stairs.h,3);
  const point=x=>({x:numeric(stairs.x)+x*Math.cos(a)+depth*.5*Math.sin(a),
    y:numeric(stairs.y)+x*Math.sin(a)-depth*.5*Math.cos(a)});
  return [relative(point(-w/2),stage),relative(point(w/2),stage)];
}
function overlap(a,b,halfSpan){
  const low=Math.max(-halfSpan,Math.min(a,b)),high=Math.min(halfSpan,Math.max(a,b));
  return Math.max(0,high-low);
}
export function findStageForStairs(stairs,objects,tolerance=.75){
  if(stairs?.type!=='stairs')return null;
  let best=null;
  const centerPoint={x:numeric(stairs.x),y:numeric(stairs.y)};
  for(const stage of objects||[]){
    if(stage?.type!=='stage')continue;
    const width=numeric(stage.w),depth=numeric(stage.h);
    if(width<=0||depth<=0)continue;
    const [a,b]=stairsTopInStage(stairs,stage);
    const center=relative(centerPoint,stage);
    const span=Math.hypot(b.x-a.x,b.y-a.y);
    if(span<.2)continue;
    for(const side of ['top','bottom','left','right']){
      const horizontal=side==='top'||side==='bottom';
      const edge=horizontal?(side==='top'?-depth/2:depth/2):(side==='left'?-width/2:width/2);
      const axisA=horizontal?a.x:a.y,axisB=horizontal?b.x:b.y;
      const crossA=horizontal?a.y:a.x,crossB=horizontal?b.y:b.x;
      const lineAlignment=Math.abs(axisB-axisA)/span;
      if(lineAlignment<.96)continue;
      const crossing=overlap(axisA,axisB,horizontal?width/2:depth/2);
      if(crossing<Math.min(span*.45,1.25))continue;
      const offset=Math.abs((crossA+crossB)/2-edge);
      const centerCross=horizontal?center.y:center.x;
      // The stairs must extend away from the stage, not into/under it.
      if((edge<0&&centerCross>=edge+.1)||(edge>0&&centerCross<=edge-.1))continue;
      if(offset>tolerance)continue;
      const score=offset+(1-lineAlignment)*2;
      if(!best||score<best.score)best={stageId:stage.id??null,side,
        stageHeightInches:numeric(stage.heightInches,16)||16,score};
    }
  }
  return best;
}
export function resolveStairHeights(objects){
  if(!Array.isArray(objects))return [];
  return objects.map(o=>{
    if(o.type!=='stairs')return o;
    const match=findStageForStairs(o,objects);
    return {...o,
      heightInches:match?match.stageHeightInches:(numeric(o.heightInches,16)||16),
      attachedStageId:match?.stageId??null,
      attachedStageSide:match?.side??null};
  });
}
