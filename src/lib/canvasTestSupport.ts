import { createCanvas, loadImage } from '@napi-rs/canvas';
// The PDF tests exercise the same pixel path as browsers, using a real test canvas.
if (typeof globalThis.document === 'undefined') {
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>{
    const canvas=createCanvas(1,1);
    Object.assign(canvas,{toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob([new Uint8Array(canvas.toBuffer('image/png'))],{type:'image/png'}))});
    return canvas;
  }},configurable:true});
  Object.defineProperty(globalThis,'createImageBitmap',{value:async(blob:Blob)=>{
    const image=await loadImage(Buffer.from(await blob.arrayBuffer()));Object.assign(image,{close:()=>{}});return image;
  },configurable:true});
}