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

export async function isHeicSupported() {
  const testImage = "data:image/heic;base64,AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAYFtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAANGlsb2MAAAAAREAAAgABAAAAAAGlAAEAAAAAAAAAHwACAAAAAAHEAAEAAAAAAAAA3AAAADhpaW5mAAAAAAACAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAAFWluZmUCAAABAAIAAEV4aWYAAAAAwGlwcnAAAACiaXBjbwAAAHZodmNDAQQIAAAAAAAAAAAAHvAA/P74+AAADwMgAAEAF0ABDAH//wQIAAADAJ04AAADAAAeugJAIQABACpCAQEECAAAAwCdOAAAAwAAHrAggQWW6kkka5uAhoCCAAADAAIAAAMAAhAiAAEAB0QBwXKwIkAAAAAUaXNwZQAAAAAAAABAAAAAQAAAABBwaXhpAAAAAAMICAgAAAAWaXBtYQAAAAAAAAABAAEDgQKDAAAAGmlyZWYAAAAAAAAADmNkc2MAAgABAAEAAAEDbWRhdAAAABsoAa8GOFtzv/Lf4AJ/r/Gz///upykP+ITjlfgAAAAASUkqAAgAAAAGABIBAwABAAAAAQAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAwAAADEBAgARAAAAZgAAAGmHBAABAAAAeAAAAAAAAACjkwAA6AMAAKOTAADoAwAAcGFpbnQubmV0IDUuMC4xMQAABQAAkAcABAAAADAyMzABoAMAAQAAAAEAAAACoAQAAQAAAEAAAAADoAQAAQAAAEAAAAAFoAQAAQAAALoAAAAAAAAAAgABAAIABAAAAFI5OAACAAcABAAAADAxMDAAAAAA";
  var image = new Image();
  image.src = testImage;
  try {
    await image.decode();
    return true;
  } catch {
    return false;
  }
}

export function approxEqual(a, b, epsilon=1e-6) {
  return Math.abs(a - b) < epsilon;
}
