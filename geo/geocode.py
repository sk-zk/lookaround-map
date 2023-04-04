import struct
from typing import List
from requests import Session
import requests
from pathlib import Path
import os

script_path = Path(__file__).parent.resolve()
with open(os.path.join(script_path, "revgeo_request_template.bin"), "rb") as f:
    _revgeo_template = f.read()


# Easily some of the most deranged code I've written lately.
# This function makes an RPC to Apple's dispatcher.arpc endpoint -
# which uses yet another custom binary format I don't know anything
# about, but it turns out I can just plug in the coordinates and the
# language code into a request body I captured with mitmproxy and parse
# a portion of the response to get my address without understanding
# anything about this format. It works ... for now.

def reverse_geocode(lat: float, lon: float, language: str = "en-US", session: Session = None) -> List[str]:
    """
    Gets an address for a location using an internal API call of Apple Maps.
    """
    requester = requests if session is None else session

    # keep string length the same
    if len(language) == 2:
        language = f"{language}-{language.upper()}"
    elif len(language) != 5:
        raise ValueError

    # insert my params into the request body
    request_body = \
        _revgeo_template[0:0x118] + \
        bytes(language, encoding="ascii") + \
        _revgeo_template[0x11D:0x2FE] + \
        struct.pack('d', lat) + \
        _revgeo_template[0x306:0x307] + \
        struct.pack('d', lon) + \
        _revgeo_template[0x30F:]

    response = requester.post("https://gsp-ssl.ls.apple.com/dispatcher.arpc", data=request_body)
    if response.status_code != 200:
        return []
    
    # find a specific string which appears shortly before the address,
    # and start parsing from there
    idx = response.content.index(b"create") + len("create")
    strings = []
    while idx < len(response.content):
        # some sort of field id
        field_id = response.content[idx]
        idx += 1
        # in the segment I'm blindly parsing, these contain strings 
        if field_id in [0x1a, 0x22, 0x0a, 0x5a]:
            field_length = response.content[idx]
            idx += 1
            field_val = response.content[idx:idx+field_length]
            idx += field_length
            strings.append(str(field_val, encoding="utf-8"))
        elif field_id == 0xaa:
            while response.content[idx] != 0x0a:
                idx += 1
        elif field_id == 0x12:
            # variable length field (1 or more), advance until the next 0x5a field
            idx += 1
            while response.content[idx] != 0x5a:
                idx += 1
        else:
            break

    if strings[1] == strings[2]:
        # with this method the first address string we get
        # might be the same as the second
        return strings[2:]
     # the first string from where we start parsing is not yet the address
    return strings[1:]
