export const CoverageType = Object.freeze({
  Car: 2,
  Trekker: 3,
});

export const CameraType = Object.freeze({
  BigCam: 0,
  SmallCam: 1,
  LowCam: 2,
  Backpack: 3,
});

export const LineColorType = Object.freeze({
  CoverageType: 0,
  Age: 1,
  BuildId: 2,
});

export const Face = Object.freeze({
  Back: 0,
  Left: 1,
  Front: 2,
  Right: 3,
  Top: 4,
  Bottom: 5,
});

export const AddressSource = Object.freeze({
  Nominatim: "nominatim",
  Apple: "apple",
});

export const Theme = Object.freeze({
  Automatic: "auto",
  Light: "light",
  Dark: "dark",
});

export const InitialOrientation = Object.freeze({
	North: 0,
	Road: 1,
});

/**
 * The image format which the viewer will request from the backend.
 */
export const ImageFormat = Object.freeze({
  /** The viewer will request JPEG. */ 
	JPEG: 0, 
  /** The viewer will request HEIC. */
	HEIC: 1,
  /** The viewer will request HEVC Main Still Picture in an MP4 container. */
  HEVC: 2,
});

/**
 * Additional metadata which can be requested from the `closest` endpoint.
 */
export const AdditionalMetadata = Object.freeze({
  /** Heading/pitch/roll of panoramas. */
	Orientation: "ori",
  /** Camera metadata of panoramas. */
	CameraMetadata: "cam",
  /** Height above MSL of panoramas. */
  Elevation: "ele",
  /** Time zone of the capture time of panoramas. */
  TimeZone: "tz",
});
