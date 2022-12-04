**lookaround-map** is an Apple Look Around viewer running in the browser.

Live at [lookmap.eu.pythonanywhere.com](https://lookmap.eu.pythonanywhere.com)!

## Setup
```
git clone https://github.com/sk-zk/lookaround-map.git --recursive
cd lookaround-map
pip install -r requirements.txt
npm i --global rollup
npm i
rollup -c
flask run
```

### Decoding
Since no browser supports the HEIC format (not even Apple's own Safari, funnily enough), images must be converted to JPG before sending them to the client.
To do so, three options are available. Simply install the one you like and it will be selected automatically.

#1: By default, `pillow-heif` will be used to decode images. It's the slowest of the group, but runs on every platform.

#2: [`pyheif`](https://github.com/carsales/pyheif), which is slightly faster. Supports Linux and Mac.

#3: However, **the fastest option** (that I'm aware of) is my own [`heic2rgb`](https://github.com/sk-zk/heic2rgb/), which is noticeably faster than the previous two. Supports Linux and Windows.


## Progress
### Complete:
- [x] See where coverage exists (at z=16 or higher)
- [x] Select and view panoramas
- [x] Compass
- [x] Simple movement
- [x] Reverse geocoding with Nominatim

### TODO:
- [ ] Find pitch and roll values
- [ ] Render top and bottom faces of panoramas
   - Completely lost as to which projection this is
- [ ] Find a raster blue line layer if it exists, or decode the vector layer
   - Out of all the network requests that happen when you tap the Look Around button, the most likely candidate
     for containing that information is style 53 at z=15 specifically.  
   - This tile is in Apple's custom `VMP4` format. The general structure of the format [has been decoded](https://github.com/19h/vmp4-dump),
     but the actual content of the individual sections remains undeciphered.
- [x] Move movement code into custom plugin which displays available locations
   - Well, I've merged it into main, but without the pitch and roll offsets, it's not as accurate as it could be 
- [ ] Find and decode depth data and use it to improve movement
   - There are three types of pano data the app will request. One is `/t/<face>/<zoom>`, which returns the pano faces as HEIC, but there are two others: `/m/<zoom>` and `/mt/7`, in a custom format with the header `MCP4`. One of them probably contains the depth information I'm looking for.
- [ ] Fetch the address from Apple rather than OSM
- [ ] Properly convert and display elevation
