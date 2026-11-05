// Planning dimensions in feet. Adjacent pipe & drape bays share uprights.
export function pipeDrapeBays(length=10,heightFeet=8){
  const run=Math.min(200,Math.max(1,Number(length)||10));
  const requestedHeight=Number(heightFeet);
  const height=Math.min(8,Math.max(1,requestedHeight>0?requestedHeight:8));
  const count=Math.ceil(run/10);
  const bays=Array.from({length:count},(_,i)=>{
    const a=i*10-run/2,b=Math.min(run,(i+1)*10)-run/2;
    return {start:a,end:b,center:(a+b)/2,span:b-a};
  });
  const uprights=[-run/2,...bays.map(b=>b.end)];
  return {run,height,count,bays,uprights};
}
export const trash32Dimensions={diameterFeet:1.9,heightFeet:2.75,capacityGallons:32};
