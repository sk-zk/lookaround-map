import { isAppleMapsUrl, parseAppleMapsUrl } from "../../util/url.js";

import SearchNominatim from "ol-ext/control/SearchNominatim.js";

var _query = "";

class ExtendedSearchControl extends SearchNominatim {
  constructor(options, onAppleMapsLinkPasted) {
    // The base class olcontrolSearch is a big ol' pile of shit
    // where 90% of the logic, and the part I need to modify,
    // is located in a function created in the constructor
    // with no way to override it short of literally hijacking
    // the addEventListener function and grabbing it out of there.
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (...args) {
      if (args[0] === "keyup") {     
        const origCallback = args[1];
        const patchedCallback = function (e) {
          if (e.key === "Enter" && isAppleMapsUrl(e.target.value)) {
            onAppleMapsLinkPasted(parseAppleMapsUrl(e.target.value));
            e.target.value = "";
          } else {
            _query = e.target.value;
            origCallback(e);
          }
        };
        return originalAddEventListener.apply(this, [args[0], patchedCallback])
      }
      return originalAddEventListener.apply(this, args);
    };

    super(options);

    EventTarget.prototype.addEventListener = originalAddEventListener;
  }

  handleResponse(response) {
    const coords = tryParseCoordinate(_query);
    if (coords) {
      const latFirstObj = {
        "lat": coords[0],
        "lon": coords[1],
        "display_name": coords[0] + ", " + coords[1],
        "class": "point",
      }
      response.push(latFirstObj);
      const lonFirstObj = {
        "lat": coords[1],
        "lon": coords[0],
        "display_name": coords[1] + ", " + coords[0],
        "class": "point",
      }
      response.push(lonFirstObj);
    }
    return super.handleResponse(response);
  }
}

function tryParseCoordinate(str) {
  const splitByComma = str.split(",");
  if (splitByComma.length == 2) {
    const lat = parseFloat(splitByComma[0]);
    const lon = parseFloat(splitByComma[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return [lat, lon];
    }
  }

  const splitBySpace = str.split(" ");
  if (splitBySpace.length == 2) {
    const lat = parseFloat(splitBySpace[0]);
    const lon = parseFloat(splitBySpace[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return [lat, lon];
    }
  }

  return null;
}

export { ExtendedSearchControl };