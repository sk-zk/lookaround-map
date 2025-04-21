import { getUserLocale } from "../util/misc.js";
import { CameraType } from "../enums.js";
import { approxEqual } from "../util/misc.js";

export class TimeMachineControl {
  panoSelectedCallback = function () {};

  #alternativeDates = [];
  #timeMachineMenu;
  #parent;
  #container;
  #isOpen;
  #date;

  constructor() {
    this.#date = document.querySelector("#pano-date");
    this.#timeMachineMenu = document.querySelector("#time-machine-menu");
    this.#parent = document.querySelector("#pano-date-and-time-machine-menu-container");
    this.#container = document.querySelector("#time-machine");

    document.addEventListener("click", (e) => {
      if (e.target.className === "time-machine-button" && !this.#isOpen) {
        this.open();
      } else {
        this.close();
      }
    });
  }

  setPano(pano) {
    const date = new Date(pano.timestamp);
    const formattedDate = new Intl.DateTimeFormat(getUserLocale(), {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: pano.timezone,
    }).format(date);

    const camType = this.#inferCameraType(pano);
    const camHtml = this.#getCameraTypeHtml(camType);

    this.#date.innerHTML = formattedDate + camHtml;
  }

  setAlternativeDates(dates) {
    this.#alternativeDates = dates;
    if (dates.length > 0) {
      this.#container.className = "time-machine-has-other-dates";
    } else {
      this.#container.className = "";
    }
  }

  open() {
    if (this.#alternativeDates.length === 0) return;

    this.#timeMachineMenu.innerHTML = "";
    for (const pano of this.#alternativeDates) {
      const locale = navigator.languages[0] ?? "en-GB";
      const formattedDate = new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: pano.timezone,
      }).format(new Date(pano.timestamp));

      const camType = this.#inferCameraType(pano);
      const camHtml = this.#getCameraTypeHtml(camType);

      const option = document.createElement("div");
      option.innerHTML = formattedDate + camHtml;
      option.className = "time-machine-option";
      option.addEventListener("click", (_) => {
        this.close();
        this.panoSelectedCallback(pano);
      });
      this.#timeMachineMenu.appendChild(option);
    }

    this.#timeMachineMenu.style.display = "block";
    this.#timeMachineMenu.style.width = this.#parent.clientWidth + "px";
    this.#isOpen = true;
  }

  close() {
    this.#timeMachineMenu.style.display = "none";
    this.#isOpen = false;
  }

  #inferCameraType(pano) {
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
    // Switzerland low cam (2021)
    } else if (approxEqual(pano.cameraMetadata[0].cy, 0.36215582)) {
      return CameraType.LowCam;
    }

    // Unknown type, fall back to big cam
    return CameraType.BigCam;
  }

  #getCameraTypeHtml(type) {
    let icon;
    switch (type) {
      default:
      case CameraType.BigCam:
        icon = "/static/icons/bigcam.png";
        break;
      case CameraType.SmallCam:
        icon = "/static/icons/smallcam.png";
        break;
      case CameraType.LowCam:
        icon = "/static/icons/lowcam.png";
        break;
      case CameraType.Backpack:
        icon = "/static/icons/backpack.png";
        break;
    }
    return `&nbsp;&nbsp;&nbsp;<img src="${icon}" class="pano-info-camera-icon">`;
  }
}
