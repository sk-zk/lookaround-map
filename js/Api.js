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

  async reverseGeocode(lat, lon, language = "en-US") {
    let url = `${this.endpoint}/address?lat=${lat}&lon=${lon}&lang=${language}`;
    const response = await fetch(url);
    const address = await response.json();
    return address;
  }
}
