A web viewer for Apple Look Around, usable on any device.

## Progress
### Complete:
- [x] See where coverage exists (at z=16 or higher)
- [x] Select and view panoramas

### TODO:
- [ ] Render top and bottom faces of panoramas
- [x] Load higher resolution faces when zooming in
- [ ] Display a compass
  - Can't for the life of me figure out where north is in an image. `unknown10` and `unknown11` are related to it in some way, but I'm not making much progress here
- [ ] Find a raster blue line layer if it exists, or decode the vector layer
- [ ] Implement movement 
- [ ] Find and decode depth data and use it to improve movement
