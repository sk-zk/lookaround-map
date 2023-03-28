import { AddressSource, Theme } from "../enums.js";

export class SettingsControl {
  constructor() {
    const showFullPano = document.querySelector("#show-full-pano");
    showFullPano.checked = localStorage.getItem("showFullPano") === "true";
    showFullPano.addEventListener("change", (_) => localStorage.setItem("showFullPano", showFullPano.checked));

    const addrNominatim = document.querySelector("#addr-nominatim");
    const addrApple = document.querySelector("#addr-apple");
    switch (localStorage.getItem("addrSource")) {
      case AddressSource.Nominatim:
        addrNominatim.checked = true;
        break;
      case AddressSource.Apple:
      default:
        addrApple.checked = true;
        break;
    }
    addrNominatim.addEventListener("change", (_) => {
      localStorage.setItem("addrSource", AddressSource.Nominatim);
      this.#onAddressSourceChanged();
    });
    addrApple.addEventListener("change", (_) => {
      localStorage.setItem("addrSource", AddressSource.Apple);
      this.#onAddressSourceChanged();
    });

    const themeAuto = document.querySelector("#theme-auto");
    const themeLight = document.querySelector("#theme-light");
    const themeDark = document.querySelector("#theme-dark");
    switch (localStorage.getItem("theme")) {
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
      localStorage.setItem("theme", Theme.Automatic);
      this.#onThemeChanged();
    });
    themeLight.addEventListener("change", (_) => {
      localStorage.setItem("theme", Theme.Light);
      this.#onThemeChanged();
    });
    themeDark.addEventListener("change", (_) => {
      localStorage.setItem("theme", Theme.Dark);
      this.#onThemeChanged();
    });
  }

  #onAddressSourceChanged() {
    document.dispatchEvent(new CustomEvent("addrSourceChanged"));
  }

  #onThemeChanged() {
    document.dispatchEvent(new CustomEvent("themeChanged"));
  }
}
