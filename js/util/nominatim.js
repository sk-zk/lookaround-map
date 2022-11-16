const rateLimit = 1000;
let lastCall = 0;

export async function reverseGeocode(lat, lon) {
  const msSinceLastCall = Date.now() - lastCall;
  if (msSinceLastCall < rateLimit) {
    await new Promise(r => setTimeout(r, rateLimit - msSinceLastCall));
  }
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const response = await fetch(url);
  const place = await response.json();
  lastCall = Date.now();
  return formatAddress(place.address);
}

function formatAddress(address) {
  // 2 AM code below
  const countriesWithHouseNrFirst = ["us", "ca", "au", "nz", "ie", "gb", "fr"];
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
