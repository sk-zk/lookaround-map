const CoverageType = Object.freeze({
  Car: 2,
  Trekker: 3,
});

const LineColorType = Object.freeze({
  CoverageType: 0,
  Age: 1,
  BuildId: 2,
});

const Face = Object.freeze({
  Front: 0,
  Right: 1,
  Back: 2,
  Left: 3,
  Top: 4,
  Bottom: 5,
});

const AddressSource = Object.freeze({
  Nominatim: "nominatim",
  Apple: "apple",
});

const Theme = Object.freeze({
  Automatic: "auto",
  Light: "light",
  Dark: "dark",
});

export { CoverageType, LineColorType, Face, AddressSource, Theme };
