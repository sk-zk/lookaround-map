import { CameraType } from "../enums";

export function getUserLocale() {
  return navigator.languages[0] ?? "en-GB";
}

export function getDevicePixelRatio() {
  return window.devicePixelRatio || 1;
}

export function showNotificationTooltip(text, xPos, yPos, duration) {
  const notification = document.createElement("div");
  notification.className = "notification-tooltip";
  notification.innerText = text;
  notification.style.left = `${xPos}px`;
  notification.style.top = `${yPos}px`;
  document.body.appendChild(notification);
  window.setTimeout(() => {
    document.body.removeChild(notification);
  }, duration);
}

export function isAppleDevice() {
  const ua = navigator.userAgent.toLowerCase();
  const appleIndicators = ["mac os", "macintosh", "iphone", "ipad", "darwin"];
  for (const indicator of appleIndicators) {
    if (ua.indexOf(indicator) > -1) {
      return true;
    }
  }
  return false;
}

export function approxEqual(a, b, epsilon=1e-6) {
  return Math.abs(a - b) < epsilon;
}

export function ceilFirstOfMonth(date) {
  let year = date.getFullYear();
  let month = date.getMonth();
  let day = date.getDate();
  if (day === 1) {
    return date;
  }
  if (month === 11) {
    year++;
    month = 0;
  } else {
    month++;
  }
  return new Date(year, month, 1);
}

export function floorFirstOfMonth(date) {
  let year = date.getFullYear();
  let month = date.getMonth();
  let day = date.getDate();
  if (day === 1) {
    return date;
  }
  return new Date(year, month, 1);
}

/**
 * Infers the kind of camera the given panorama was taken with from the projection parameters.
 * @param {object} pano The panorama object.
 * @returns {number} The camera type.
 */
export function inferCameraType(pano) {
    // Backpack cam
    if (pano.coverageType == 3) {
      return CameraType.Backpack;
    }

    // Big cam (2018-)
    if (approxEqual(pano.cameraMetadata[0].cy, 0.27488935)) {
      return CameraType.BigCam;
    // Small cam (2024-)
    } else if (approxEqual(pano.cameraMetadata[0].cy, 0.30543262)) {
      return CameraType.SmallCam;
    // Switzerland low cam (2021-2022)
    } else if (approxEqual(pano.cameraMetadata[0].cy, 0.36215582)) {
      return CameraType.LowCam;
    }

    // Unknown type; fall back to big cam
    return CameraType.BigCam;
  }
  