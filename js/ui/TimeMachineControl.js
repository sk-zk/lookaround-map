export class TimeMachineControl {
  panoSelectedCallback = function () {};

  #alternativeDates = [];
  #timeMachineMenu;
  #parent;
  #container;
  #isOpen;

  constructor() {
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
      const option = document.createElement("div");
      option.innerText = formattedDate;
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
}
