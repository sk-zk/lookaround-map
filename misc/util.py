
from enum import Enum
from typing import List
from timezonefinder import TimezoneFinder

from lookaround.panorama import LookaroundPanorama
from config import config

# Must be initialized outside the class because the encoder class doesn't
# get reused, apparently.
# further, `in_memory` must be set to True because the library would otherwise
# trip over its own feet trying to open the same file in different threads.
tf = TimezoneFinder(in_memory=True) 


class AdditionalMetadata(Enum):
    ORIENTATION = "ori"
    CAMERA_METADATA = "cam"
    ELEVATION = "ele"
    TIMEZONE = "tz"


def panos_to_dicts(panos: List[LookaroundPanorama], 
                   additional_metadata: List[AdditionalMetadata]) -> List[dict]:
    return [pano_to_dict(pano, additional_metadata) for pano in panos]


def pano_to_dict(pano: LookaroundPanorama, 
                 additional_metadata: List[AdditionalMetadata]) -> dict:
    pano_dict = {
        "panoid": str(pano.panoid),
        "buildId": str(pano.build_id),
        "lat": pano.lat,
        "lon": pano.lon,
        "timestamp": pano.timestamp,
        "coverageType": pano.coverage_type,
        }
    
    for meta in additional_metadata:
        if meta == AdditionalMetadata.ORIENTATION:
            pano_dict["heading"] = pano.heading
            pano_dict["pitch"] = pano.pitch
            pano_dict["roll"] = pano.roll
        if meta == AdditionalMetadata.ELEVATION:
            pano_dict["elevation"] = pano.elevation
        if meta == AdditionalMetadata.CAMERA_METADATA:
            pano_dict["cameraMetadata"] = [{ 
                "fovH": c.lens_projection.fov_h,
                "fovS": c.lens_projection.fov_s,
                "cy": c.lens_projection.cy,
                "yaw": c.position.yaw,
                "pitch": c.position.pitch,
                "roll": c.position.roll,
                } for c in pano.camera_metadata]
        if meta == AdditionalMetadata.TIMEZONE:
            pano_dict["timezone"] = tf.timezone_at(lat=pano.lat, lng=pano.lon)
    
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
    return s == "1" or s == "true"
