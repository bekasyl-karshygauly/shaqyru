/* Give each flap its own pixel backing. Firefox can retain the whole source
   texture behind a cropped ImageBitmap when bitmaprenderer presents it. */
export function cropMaterialTiles(atlas,surfaces,cache){
  return Promise.allSettled(surfaces.map(async surface=>{
    let tile=cache.get(surface.index);
    if(!tile){const canvas=new OffscreenCanvas(surface.width,surface.height);tile={canvas,context:canvas.getContext('2d',{alpha:true})};cache.set(surface.index,tile)}
    if(!tile.context)throw Error('MATERIAL_TILE_UNAVAILABLE');
    if(tile.canvas.width!==surface.width)tile.canvas.width=surface.width;
    if(tile.canvas.height!==surface.height)tile.canvas.height=surface.height;
    tile.context.clearRect(0,0,surface.width,surface.height);
    tile.context.drawImage(atlas,surface.x,surface.y,surface.width,surface.height,0,0,surface.width,surface.height);
    return {index:surface.index,image:await createImageBitmap(tile.canvas)};
  }));
}
