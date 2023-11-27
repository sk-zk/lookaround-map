
from typing import List
from timezonefinder import TimezoneFinder

from lookaround.panorama import LookaroundPanorama
from config import config

# Must be initialized outside the class because the encoder class doesn't
# get reused, apparently.
# further, `in_memory` must be set to True because the library would otherwise
# trip over its own feet trying to open the same file in different threads.
tf = TimezoneFinder(in_memory=True) 


def panos_to_dicts(panos: List[LookaroundPanorama], include_heading=True, include_elevation=True) -> List[dict]:
    return [pano_to_dict(pano,include_heading=include_heading, include_elevation=include_elevation) for pano in panos]


def pano_to_dict(pano: LookaroundPanorama, include_heading=True, include_elevation=True) -> dict:
    pano_dict = {
        "panoid": str(pano.panoid),
        "buildId": str(pano.build_id),
        "lat": pano.lat,
        "lon": pano.lon,
        "timestamp": pano.timestamp,
        "timezone": tf.timezone_at(lat=pano.lat, lng=pano.lon),
        "coverageType": pano.coverage_type,
        "lensProjection": { 
            "fovH": pano.camera_metadata[0].lens_projection.fov_h,
            "cy": pano.camera_metadata[0].lens_projection.cy
            },
        }
    if include_heading:
        pano_dict["heading"] = pano.heading
    if include_elevation:
        pano_dict["elevation"] = pano.elevation
    return pano_dict


def load_ip_blacklist() -> set:
    ip_blacklist = set()
    with open(config.IP_BLACKLIST_PATH, "r") as f:
        for line in f.readlines():
            line = line.strip()
            if not line.startswith("#") and line != "":
                ip_blacklist.add(line)
    return ip_blacklist


def to_bool(s: str) -> bool:
    s = s.lower()
    return s == "1" or s == "true" or s == "True"
