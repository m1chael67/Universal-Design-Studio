import * as THREE from 'three';
// Lightweight optional 3D dimension guides; values are nominal feet, not cut lengths.
function label(root,txt,x,y,z,scale=3.7){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(16,33,42,.92)';
  ctx.fillRect(8,8,496,112);
  ctx.strokeStyle='#90d8d4';ctx.lineWidth=5;ctx.strokeRect(8,8,496,112);
  ctx.fillStyle='#f7fafc';ctx.font='bold 50px Arial,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(txt.slice(0,32),256,65,475);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  sprite.position.set(x,y,z);sprite.scale.set(scale,scale/4,1);sprite.renderOrder=200;
  root.add(sprite);
}
function guide(root,a,b,txt,offset=[0,0,0]){
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]);
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf5d57d,depthTest:false,depthWrite:false}));
  line.renderOrder=180;root.add(line);
  const mid=a.map((v,i)=>(v+b[i])/2+offset[i]);
  label(root,txt,...mid);
}
const asFeet=n=>Number(n).toFixed(Math.abs(Number(n)%1)<.01?0:1);
export function addTentDimensions(root,{length,width,eave,ridge}){
  const a=-length/2,b=length/2,d=width/2;
  guide(root,[a,.22,d+2.1],[b,.22,d+2.1],asFeet(length)+' ft length',[0,.9,0]);
  guide(root,[b+2.1,.22,-d],[b+2.1,.22,d],asFeet(width)+' ft width',[1,.9,0]);
  guide(root,[a-1.8,0,d],[a-1.8,eave,d],asFeet(eave)+' ft legs',[-2,0,0]);
  guide(root,[a-1.8,0,0],[a-1.8,ridge,0],asFeet(ridge)+' ft ridge',[-2,0,0]);
}
export function addStageDimension(stageGroup,deckHeight,width=4,depth=4){
  const inches=Math.round(deckHeight*12);
  const x=width/2+.45,z=depth/2+.45;
  // Outside the deck: labels otherwise disappear behind the solid panels.
  guide(stageGroup,[x,0,z],[x,deckHeight,z],inches+'″ deck height',[1.3,0,.4]);
}
