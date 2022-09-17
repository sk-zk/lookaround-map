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
  return place.address;
}
