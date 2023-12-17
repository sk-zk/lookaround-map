import { AddressSource, Theme, InitialOrientation } from "../enums.js";
import { settings } from "../settings.js";
import { isHevcSupported } from "../util/media.js";

export class SettingsControl {
  constructor() {
    const addrNominatim = document.querySelector("#addr-nominatim");
    const addrApple = document.querySelector("#addr-apple");
    switch (settings.get("addressSource")) {
      case AddressSource.Nominatim:
        addrNominatim.checked = true;
        break;
      case AddressSource.Apple:
      default:
        addrApple.checked = true;
        break;
    }
    addrNominatim.addEventListener("change", (_) => {
      settings.set("addressSource", AddressSource.Nominatim);
    });
    addrApple.addEventListener("change", (_) => {
      settings.set("addressSource", AddressSource.Apple);
    });

    const themeAuto = document.querySelector("#theme-auto");
    const themeLight = document.querySelector("#theme-light");
    const themeDark = document.querySelector("#theme-dark");
    switch (settings.get("theme")) {
      case Theme.Automatic:
      default:
        themeAuto.checked = true;
        break;
      case Theme.Light:
        themeLight.checked = true;
        break;
      case Theme.Dark:
        themeDark.checked = true;
        break;
    }
    themeAuto.addEventListener("change", (_) => {
      settings.set("theme", Theme.Automatic);
    });
    themeLight.addEventListener("change", (_) => {
      settings.set("theme", Theme.Light);
    });
    themeDark.addEventListener("change", (_) => {
      settings.set("theme", Theme.Dark);
    });

    const labelsOnTop = document.querySelector("#labels-on-top");
    labelsOnTop.checked = settings.get("labelsOnTop");
    labelsOnTop.addEventListener("change", (_) => {
      settings.set("labelsOnTop", labelsOnTop.checked);
    });

    const initialOrientationNorth =  document.querySelector("#spawn-facing-north");
    const initialOrientationRoad =  document.querySelector("#spawn-facing-road");
    switch (settings.get("initialOrientation")) {
      default:
      case InitialOrientation.North:
        initialOrientationNorth.checked = true;
          break;
        case InitialOrientation.Road:
          initialOrientationRoad.checked = true;
          break;
    }
    initialOrientationNorth.addEventListener("change", (_) => {
      settings.set("initialOrientation", InitialOrientation.North);
    });
    initialOrientationRoad.addEventListener("change", (_) => {
      settings.set("initialOrientation", InitialOrientation.Road);
    });

    const enableHevc = document.querySelector("#enable-hevc");
    enableHevc.checked = settings.get("enableHevc");
    enableHevc.addEventListener("change", (_) => {
      settings.set("enableHevc", enableHevc.checked);
    });
    enableHevc.disabled = !isHevcSupported();
  }
}
