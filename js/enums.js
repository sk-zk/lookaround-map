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

const InitialOrientation = Object.freeze({
	North: 0,
	Road: 1,
})

/**
 * The image format which the viewer will request from the backend.
 */
const ImageFormat = Object.freeze({
  /** The viewer will request JPEG. */ 
	JPEG: 0, 
  /** The viewer will request HEIC. */
	HEIC: 1,
  /** The viewer will request HEVC Main Still Picture in an MP4 container. */
  HEVC: 2,
})

/**
 * Additional metadata which can be requested from the `closest` endpoint.
 */
const AdditionalMetadata = Object.freeze({
  /** Heading/pitch/roll of panoramas. */
	Orientation: "ori",
  /** Camera metadata of panoramas. */
	CameraMetadata: "cam",
  /** Height above MSL of panoramas. */
  Elevation: "ele",
  /** Time zone of the capture time of panoramas. */
  TimeZone: "tz",
})

export { CoverageType, LineColorType, Face, AddressSource, Theme, InitialOrientation, ImageFormat, AdditionalMetadata };
