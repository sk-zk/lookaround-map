import { CoverageType } from "../enums.js";

const addAdminAreaFor = new Set(["us", "ca", "au", "gb", "br", "mx", "in"]);

export function generateReportString(pano, address, shareLink) {
  const place = getLocationName(address);

  const emoji = getFlagEmoji(address);

  const date = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: pano.timezone,
  }).format(new Date(pano.timestamp));

  const trekkerStr = pano.coverageType === CoverageType.Trekker ? "trekkers " : "";

  const report = `${emoji} ${date} ${trekkerStr}in [${place}](${shareLink})`;
  return report;
}

function getFlagEmoji(address) {
  if (!address.country && address.city.toLowerCase() === "gibraltar") {
    return ":flag_gi:";
  } else if (address.country_code) {
    return `:flag_${address.country_code.toLowerCase()}:`;
  } else {
    return "";
  }
}

function getLocationName(address) {
  const placeComponents = [];

  if (address.city) {
    placeComponents.push(address.city);
  }

  if (address.administrative_area &&
    addAdminAreaFor.has(address.country_code.toLowerCase())) {
    placeComponents.push(address.administrative_area);
  }

  if (address.country) {
    const addrLower = address.country.toLowerCase();
    if (addrLower === "united states" || addrLower === "united states of america") {
      placeComponents.push("USA");
    } else {
      placeComponents.push(address.country);
    }
  }

  const place = placeComponents.join(", ");
  return place;
}
