A web viewer for Apple Look Around, usable on any device.

## Progress
### Complete:
- [x] See where coverage exists (at z=16 or higher)
- [x] Select and view panoramas
- [x] Compass
- [x] Simple movement

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
