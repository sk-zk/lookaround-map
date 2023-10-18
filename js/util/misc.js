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
  const appleIndicators = ["mac os", "macintosh", "iphone", "ipad", "darwin", "webkit", "apple"];
  for (const indicator of appleIndicators) {
    if (ua.indexOf(indicator) > -1) {
      return true;
    }
  }
  return false;
}
