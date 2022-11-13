export class Api {
    constructor(endpoint) {
        this.endpoint = endpoint;
    }

    async getCoverageTile(x, y) {
        const response = await fetch(`/tiles/coverage/${x}/${y}/`);
        const tile = await response.json();
        return tile;
    }

    async getPanoAroundPoint(lat, lon) {
        const response = await fetch(`/closest/${lat}/${lon}/`);
        const pano = await response.json();
        return pano;
    }

    async getPanosAroundPoint(lat, lon) {
        const response = await fetch(`${this.endpoint}/closestTiles/${lat}/${lon}/`);
        const responsePanos = await response.json();
        return responsePanos;
    }
}