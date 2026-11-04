// Photo compression: keep project backups and cloud rows practical without needing
// public storage buckets. The photo is embedded in its owner's private project.
export async function prepareSitePhoto(file,{maxDimension=1600,maxBytes=450000}={}){
  if(!file||!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type||'')){
    throw Error('Choose a JPG, PNG, WebP, or supported HEIC photo.');
  }
  if(file.size>20*1024*1024)throw Error('Photo exceeds the 20 MB upload limit.');
  const url=URL.createObjectURL(file);
  let image;
  try{
    image=await new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);
      img.onerror=()=>reject(Error('Cannot read this photo. Convert HEIC images to JPG if needed.'));
      img.src=url;
    });
    const longest=Math.max(image.naturalWidth,image.naturalHeight);
    if(!longest||!Number.isFinite(longest))throw Error('Image has invalid dimensions.');
    let scale=Math.min(1,maxDimension/longest),quality=.82,result=null;
    for(let pass=0;pass<10;pass++){
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const context=canvas.getContext('2d');
      context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const dataUrl=canvas.toDataURL('image/jpeg',quality);
      const bytes=Math.ceil((dataUrl.length-dataUrl.indexOf(',')-1)*.75);
      result={dataUrl,width:canvas.width,height:canvas.height,bytes,
        originalName:String(file.name||'Site photo').slice(0,100)};
      if(bytes<=maxBytes)return result;
      if(quality>.57)quality-=.09;else{quality=.68;scale*=.8;}
    }
    throw Error('This photo could not be compressed for cloud saving. Try a smaller image.');
  }finally{URL.revokeObjectURL(url);}
}
export function normalizedPoint(clientX,clientY,rect){
  return {x:Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)),
    y:Math.max(0,Math.min(1,(clientY-rect.top)/rect.height))};
}
export function photoAnnotationsValid(items){
  if(!Array.isArray(items))return false;
  return items.length<=120&&items.every(a=>
    a&&['pin','text','arrow','box'].includes(a.type)&&
    Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1&&
    (a.type==='pin'||a.type==='text'||(Number.isFinite(a.x2)&&Number.isFinite(a.y2)&&a.x2>=0&&a.x2<=1&&a.y2>=0&&a.y2<=1))
  );
}
