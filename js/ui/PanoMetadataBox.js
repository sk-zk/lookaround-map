import { getUserLocale } from "../util/misc.js";

export class PanoMetadataBox {
  #pano;
  #panoId;
  #buildId;
  #position;
  #elevation;
  #date;
  #addressFirstLine;
  #addressRest;

  constructor() {
    this.#panoId = document.querySelector("#pano-id");
    this.#buildId = document.querySelector("#pano-build-id");
    this.#position = document.querySelector("#pano-pos");
    this.#elevation = document.querySelector("#pano-ele");
    this.#date = document.querySelector("#pano-date");
    this.#addressFirstLine = document.querySelector("#pano-address-first-line");
    this.#addressRest = document.querySelector("#pano-address-rest");
  }

  setPano(pano) {
    this.#pano = pano;
    this.#panoId.innerHTML = `${pano.panoid}`;
    this.#buildId.innerHTML = `${pano.buildId}`;
    this.#position.innerHTML = `${pano.lat.toFixed(6)}, ${pano.lon.toFixed(6)}`;
    this.#elevation.innerHTML = `${pano.elevation.toFixed(2)} m`;
    /*document.querySelector("#dbg").innerHTML = 
        `<br>Y:${pano.heading * RAD2DEG}° P:${pano.pitch * RAD2DEG}° R:${pano.roll * RAD2DEG}°`;*/
    const date = new Date(pano.timestamp);
    const formattedDate = new Intl.DateTimeFormat(getUserLocale(), {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: pano.timezone,
    }).format(date);
    this.#date.innerHTML = formattedDate;
  }

  setAddress(address, attribution) {
    if (!address || address.length === 0) {
      this.#addressFirstLine.innerText = `${this.#pano.lat.toFixed(6)}, ${this.#pano.lon.toFixed(6)}`;
      this.#addressRest.innerHTML = "";
    } else {
      this.#addressFirstLine.innerText = address[0];
    }

    let html = address
      .slice(1)
      .filter((x) => x !== "")
      .join("<br>");
    if (attribution) {
      html += `<div id="nominatim-attribution">${attribution}</div>`;
    }
    html += "<hr>";
    this.#addressRest.innerHTML = html;
  }

  updateVisibility() {
    if (
      window.matchMedia("only screen and (max-width: 1000px)").matches ||
      window.matchMedia("only screen and (max-height: 650px)").matches
    ) {
      document.querySelector("#pano-info-details").removeAttribute("open");
    } else {
      document.querySelector("#pano-info-details").open = true;
    }
  }
}
