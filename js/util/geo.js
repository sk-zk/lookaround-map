const TILE_SIZE = 256.0;

export function wgs84ToTileCoord(lat, lon, zoom) {
  let scale = 1 << zoom;
  let worldCoord = wgs84ToMercator(lat, lon);
  return {
    x: (worldCoord.x * scale) / TILE_SIZE,
    y: (worldCoord.y * scale) / TILE_SIZE,
  };
}

function wgs84ToMercator(lat, lon) {
  let siny = Math.sin((lat * Math.PI) / 180.0);
  siny = Math.min(Math.max(siny, -0.9999), 0.9999);
  return {
    x: TILE_SIZE * (0.5 + lon / 360.0),
    y: TILE_SIZE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}

export function mercatorToWgs84(x, y) {
  const lat = (2 * Math.atan(Math.exp((y - 128) / -(256 / (2 * Math.PI)))) - Math.PI / 2) / (Math.PI / 180);
  const lon = (x - 128) / (256 / 360);
  return { lat: lat, lon: lon };
}

export function tileCoordToWgs84(x, y, zoom) {
  const scale = 1 << zoom;
  const pixelCoordX = x * TILE_SIZE;
  const pixelCoordY =  y * TILE_SIZE;
  const worldCoordX = pixelCoordX / scale;
  const worldCoordY = pixelCoordY / scale;
  return mercatorToWgs84(worldCoordX, worldCoordY);
}

export function wrapLon(value) {
  const worlds = Math.floor((value + 180) / 360);
  return value - worlds * 360;
}


///////

// Code based on MapillaryJS
// https://github.com/mapillary/mapillary-js/blob/main/src/geo/GeoCoords.ts
// (MIT)
//
// With a few additional lines by Eesger Toering,
// https://www.geoarchief.nl/psv/geoarchive5.html
// the license for which is as follows:
// "Do I claim (c) on this principle? No I won't, In the first place because I can't
// stop you ;) Second because I hope that me giving this openly, you can add to the 
// community also. The only thing I ask, when you make money on this: share some with
// those who made it possible AND that you mention my name and my URL in your code"


const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const WGS84A = 6378137.0;
const WGS84B = 6356752.31424518;
const TAU = 2 * Math.PI;

/**
 * Convert coordinates from geodetic (WGS84) reference to local topocentric
 * (ENU) reference.
 *
 * @param {number} lng Longitude in degrees.
 * @param {number} lat Latitude in degrees.
 * @param {number} alt Altitude in meters.
 * @param {number} refLng Reference longitude in degrees.
 * @param {number} refLat Reference latitude in degrees.
 * @param {number} refAlt Reference altitude in meters.
 * @returns {Array<number>} The x, y, z local topocentric ENU coordinates.
 */
export function geodeticToEnu(lng, lat, alt, refLng, refLat, refAlt) {
  const ecef = geodeticToEcef(lng, lat, alt);
  return ecefToEnu(ecef[0], ecef[1], ecef[2], refLng, refLat, refAlt);
}

/**
 * Convert coordinates from geodetic reference (WGS84) to Earth-Centered,
 * Earth-Fixed (ECEF) reference.
 *
 * @param {number} lng Longitude in degrees.
 * @param {number} lat Latitude in degrees.
 * @param {number} alt Altitude in meters.
 * @returns {Array<number>} The X, Y, Z ECEF coordinates.
 */
export function geodeticToEcef(lng, lat, alt) {
  const a = WGS84A;
  const b = WGS84B;

  lng = lng * DEG2RAD;
  lat = lat * DEG2RAD;

  const cosLng = Math.cos(lng);
  const sinLng = Math.sin(lng);
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);

  const a2 = a * a;
  const b2 = b * b;

  const L = 1.0 / Math.sqrt(a2 * cosLat * cosLat + b2 * sinLat * sinLat);

  const nhcl = (a2 * L + alt) * cosLat;

  const X = nhcl * cosLng;
  const Y = nhcl * sinLng;
  const Z = (b2 * L + alt) * sinLat;

  return [X, Y, Z];
}

/**
 * Convert coordinates from Earth-Centered, Earth-Fixed (ECEF) reference
 * to local topocentric (ENU) reference.
 *
 * @param {number} X ECEF X-value.
 * @param {number} Y ECEF Y-value.
 * @param {number} Z ECEF Z-value.
 * @param {number} refLng Reference longitude in degrees.
 * @param {number} refLat Reference latitude in degrees.
 * @param {number} refAlt Reference altitude in meters.
 * @returns {Array<number>} The x, y, z topocentric ENU coordinates in East, North
 * and Up directions respectively.
 */
export function ecefToEnu(X, Y, Z, refLng, refLat, refAlt) {
  const refEcef = geodeticToEcef(refLng, refLat, refAlt);

  const V = [X - refEcef[0], Y - refEcef[1], Z - refEcef[2]];

  refLng = refLng * DEG2RAD;
  refLat = refLat * DEG2RAD;

  const cosLng = Math.cos(refLng);
  const sinLng = Math.sin(refLng);
  const cosLat = Math.cos(refLat);
  const sinLat = Math.sin(refLat);

  const x = -sinLng * V[0] + cosLng * V[1];
  const y = -sinLat * cosLng * V[0] - sinLat * sinLng * V[1] + cosLat * V[2];
  const z = cosLat * cosLng * V[0] + cosLat * sinLng * V[1] + sinLat * V[2];

  return [x, y, z];
}

/**
 * Converts ENU coordinates to pitch/yaw on the photosphere.
 */
export function enuToPhotoSphere(enu, direction) {
  const distance = Math.sqrt(enu[0] * enu[0] + enu[1] * enu[1]);

  const pitch = Math.atan2(enu[2] * -1, distance) * -1;

  let yaw = Math.atan2(enu[0], enu[1]) - direction;
  yaw = wrap(yaw);

  return { distance: distance, pitch: pitch, yaw: yaw };
}

export function distanceBetween(lat1, lon1, lat2, lon2, R = 6371.0) {
    lon1 = lon1 * DEG2RAD;
    lon2 = lon2 * DEG2RAD;
    lat1 = lat1 * DEG2RAD;
    lat2 = lat2 * DEG2RAD;
  
    let x = (lon1 - lon2) * Math.cos((lat1 + lat2) / 2.0);
    let y = lat1 - lat2;
    return Math.sqrt(x * x + y * y) * R;
}

function wrap(angle) {
    angle %= TAU;
    if (angle < 0) {
      angle += TAU;
    }
    return angle;
  }