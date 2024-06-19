export class Api {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  async getCoverageTile(x, y) {
    const response = await fetch(`${this.baseUrl}/tiles/coverage/${x}/${y}/`);
    const tile = await response.json();
    return tile;
  }

  async getClosestPanos(lat, lon, radius, limit = null, additionalMetadata = null) {
    let url = `${this.baseUrl}/closest?lat=${lat}&lon=${lon}&radius=${radius}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (additionalMetadata) {
      url += `&meta=${additionalMetadata.join(",")}`
    }
    const response = await fetch(url);
    const panos = await response.json();
    return panos;
  }

  async reverseGeocode(lat, lon, language = "en-US") {
    let url = `${this.baseUrl}/address?lat=${lat}&lon=${lon}&lang=${language}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const address = await response.json();
    return address;
  }
}
