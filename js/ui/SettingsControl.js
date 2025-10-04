import { AddressSource, Theme, InitialOrientation } from "../enums.js";
import { settings } from "../settings.js";

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

    const tileLang = document.querySelector("#data-lang");
    tileLang.value = settings.get("dataLang");
    tileLang.addEventListener("change", (_) => {
      settings.set("dataLang", tileLang.value);
    });

    const labelsOnTop = document.querySelector("#labels-on-top");
    labelsOnTop.checked = settings.get("labelsOnTop");
    labelsOnTop.addEventListener("change", (_) => {
      settings.set("labelsOnTop", labelsOnTop.checked);
    });

    const useMuted = document.querySelector("#use-muted");
    useMuted.checked = settings.get("useMuted");
    useMuted.addEventListener("change", (_) => {
      settings.set("useMuted", useMuted.checked);
    });

    const showTileModifiedDate = document.querySelector("#show-tile-modified-date");
    showTileModifiedDate.checked = settings.get("showTileModifiedDate");
    showTileModifiedDate.addEventListener("change", (_) => {
      settings.set("showTileModifiedDate", showTileModifiedDate.checked);
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

    const decodeClientside = document.querySelector("#decode-clientside");
    decodeClientside.checked = settings.get("decodeClientside");
    decodeClientside.addEventListener("change", (_) => {
      settings.set("decodeClientside", decodeClientside.checked);
    });
  }
}
