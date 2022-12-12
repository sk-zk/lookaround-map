export class Api {
  constructor(endpoint = "") {
    this.endpoint = endpoint;
  }

  async getCoverageTile(x, y) {
    const response = await fetch(`${this.endpoint}/tiles/coverage/${x}/${y}/`);
    const tile = await response.json();
    return tile;
  }

  async getPanosAroundPoint(lat, lon, radius, limit = null) {
    let url = `${this.endpoint}/closest?lat=${lat}&lon=${lon}&radius=${radius}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    const response = await fetch(url);
    const panos = await response.json();
    return panos;
  }
}
