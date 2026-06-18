import CanvasTileLayerRenderer from "ol/renderer/canvas/TileLayer";

/**
 * Quick and dirty override which makes tiles overlap at the edges. Prevents pano circles
 * in the live coverage layer from getting clipped at tile boundaries.
 */
class OverlappingCanvasTileLayerRenderer extends CanvasTileLayerRenderer {
    #overlap;
    
    constructor(tileLayer, options) {
        super(tileLayer, options);
        this.#overlap = options.overlap ?? 0;
    }

    drawTile(tile, frameState, x, y, w, h, gutter, transition) {
        const realSize = tile.image_.width;
        const sizeWithoutOverlap = realSize - 2 * this.#overlap;
        const relativeOverlapSize = w / sizeWithoutOverlap;
        const realOverlap = this.#overlap * relativeOverlapSize;
        super.drawTile(tile, frameState, 
            x - realOverlap, y - realOverlap, 
            w + realOverlap*2, h + realOverlap*2, 
            gutter, transition);
    }
}

export { OverlappingCanvasTileLayerRenderer };