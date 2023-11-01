# lookaround-map

**lookaround-map** is a web app for viewing Apple Look Around imagery on any platform, using reverse-engineered requests to Apple's internal API.

It also features a more detailed coverage map, showing all covered roads at all zoom levels, and the exact position of panoramas when zooming in. This layer can also be filtered and colored by various criteria.

**Please don't make automated requests against prod.** Check if my Python library [streetlevel](https://github.com/sk-zk/streetlevel) satisfies your usecase, and if not, set up a local instance of the server to make requests against instead.

## Setup
```sh
git clone https://github.com/sk-zk/lookaround-map.git --recursive
cd lookaround-map
pip install -r requirements.txt
npm i --global rollup
npm i
rollup -c
flask run
```

### Decoding
For browsers which don't natively support HEIC - which is every browser except Safari 17 - the panorama faces must be converted to JPEG before sending them to the client.
To do so, three options are implemented. Simply install the one you like and it will be selected automatically.

#1: By default, [pillow-heif](https://github.com/bigcat88/pillow_heif) will be used to decode images. Supports every platform.

#2: [pyheif](https://github.com/carsales/pyheif) used to be faster than pillow-heif and is supported for this reason. Supports Linux and Mac.

#3: However, **the fastest option** (that I'm aware of) is my own [heic2rgb](https://github.com/sk-zk/heic2rgb/), which is noticeably faster than the previous two. Supports Linux and Windows.

## TODO
- [ ] Convert and apply upright adjustment
   - The yaw/pitch/roll values returned by the API continue to make absolutely no sense whatsoever. I've tracked down the function 
     which converts the values returned by the protobuf response into another object, but all that happens there is (n / 16383.0) * 2 * PI, 
     so I'm still missing the actual conversion
- [ ] Render top and bottom faces of panoramas
   - Completely lost as to which projection this is
- [ ] Find a raster blue line layer if it exists, or decode the vector layer
   - No longer all that important because I've got my own now, but it would be nice as fallback and for whenever an update drops
   - Out of all the network requests that happen when you tap the Look Around button, the most likely candidate
     for containing that information is style 53 at z=15 specifically.  
   - This tile is in Apple's custom `VMP4` format. The general structure of the format [has been decoded](https://github.com/19h/vmp4-dump),
     but the actual content of the individual sections remains undeciphered. 
- [ ] Decode the mesh, render it, and use it to improve movement etc.
   - There are three types of pano data Apple Maps will request. One is `/t/<face>/<zoom>`, which returns the pano faces as HEIC, but there are two others: `/m/<zoom>` and `/mt/7`,
     in a custom container format with the header `MCP4`. These files contain the mesh, compressed with Edgebreaker.

## Credits
This app uses icons by [eva-icons](https://github.com/akveo/eva-icons) and [bqlqn](https://www.flaticon.com/authors/bqlqn/fill?author_id=291&type=standard).
