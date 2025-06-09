import { Api } from "../Api.js";

const countriesWithHouseNrFirst = ["us", "ca", "au", "nz", "ie", "gb", "fr"];
const api = new Api();

/**
 * Reverse geocoder using the official Nominatim API.
 */
export class NominatimReverseGeocoder {
  #rateLimit = 1000;
  #lastCall = 0;
  attributionText = "Address © OpenStreetMap contributors";

  constructor() {}

  async reverseGeocode(lat, lon, language=null) {
    // limit to one call per second as required
    const msSinceLastCall = Date.now() - this.#lastCall;
    if (msSinceLastCall < this.#rateLimit) {
      await new Promise((r) => setTimeout(r, this.#rateLimit - msSinceLastCall));
    }

    let url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    if (language != null) {
      url += `&accept-language=${language}`;
    } // otherwise, the browser's Accept-Language header is used
    const response = await fetch(url);
    const place = await response.json();

    this.#lastCall = Date.now();

    return {
      "formatted": this.#formatAddress(place.address),
      "city": this.#getCity(place.address),
      "country": place.address.country,
      "country_code": place.address.country_code,
      "administrative_area": place.address.state,
    };
  }

  #formatAddress(address) {
    // 2 AM code below
    let output = [];

    if (address.house_number) {
      const road = [];
      if (countriesWithHouseNrFirst.includes(address.country_code)) {
        road.push(address.house_number);
        road.push(address.road);
      } else {
        road.push(address.road);
        road.push(address.house_number);
      }
      output.push(road.join(" "));
    } else if (address.road) {
      output.push(address.road);
    }

    const town = [];
    if (address.hamlet) {
      town.push(address.hamlet);
    }
    if (address.village) {
      town.push(address.village);
    }
    if (address.town) {
      town.push(address.town);
    }
    if (!address.city && address.city_district) {
      town.push(address.city_district);
    }
    if (address.city) {
      town.push(address.city);
    }
    output.push(town.join(", "));

    const admin = [];
    if (address.county) {
      admin.push(address.county);
    }
    if (address.state) {
      admin.push(address.state);
    }
    admin.push(address.country);
    output.push(admin.join(", "));

    return output;
  }

  #getCity(address) {
    if (address.city) {
      return address.city;
    }
    if (!address.town && address.city_district) {
      return address.city_district;
    }
    if (address.town) {
      return address.town;
    }
    if (address.village) {
      return address.village;
    }
    if (address.hamlet) {
      return address.hamlet;
    }
    return "";
  }
}

/**
 * Queries Apple's reverse geocoder through the internal Apple Maps API.
 */
export class AppleReverseGeocoder {
  attributionText = "";

  constructor() {}

  async reverseGeocode(lat, lon, language="en-US") {
    return await api.reverseGeocode(lat, lon, language);
  }
}
