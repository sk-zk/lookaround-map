# lookaround-map

**lookaround-map** is a web app for viewing Apple Look Around panoramas on any platform, using reverse-engineered requests to Apple's internal Maps API.

In light of recent events, I'm gonna have to put it in big bold letters again: **Do not make automated requests against the public instance. The server is not equipped to handle the volume of requests you are producing, and you are degrading the service for everybody else.** Check if my Python library [streetlevel](https://github.com/sk-zk/streetlevel) satisfies your usecase, and if not, set up a local instance of the server to make requests against instead.

## Features
* View panoramas in any modern browser, on any device
* Custom blue line layer which displays the full extent of the coverage at all zoom levels
* See the exact positions of panoramas at z >= 16
* Color or filter the coverage layers by type or date
* View metadata Apple Maps doesn't show you: panorama ID, elevation, full capture date and time
* Save a screenshot of the viewport
* Open the current view in Apple Maps or Google Street View

## Embedding
The panorama viewer can be embedded into another web page. Check out the sample code [here](https://gist.github.com/sk-zk/31df8318aead93695472b5952fb2d988).

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
In any browser which doesn't natively support HEIC (which is every browser except Safari 17+), the panorama faces
must be decoded by the app itself. By default, this is done clientside using libheif-js, but a serverside JPEG conversion 
is provided as a fallback. For this to work, one of these three libraries must be installed. Simply install the one
you like and it will be selected automatically.

#1: By default, [pillow-heif](https://github.com/bigcat88/pillow_heif) will be used to decode images. Supports Linux, Mac and Windows.

#2: [pyheif](https://github.com/carsales/pyheif) used to be faster than pillow-heif and is supported for this reason. Supports Linux and Mac.

#3: However, the fastest option (that I'm aware of) is my own [heic2rgb](https://github.com/sk-zk/heic2rgb/), 
which is noticeably faster than the previous two. Supports Linux and Windows.

## TODO
- [ ] Decode the official blue line layer
   - Not hugely important because I've got my own, but it would be nice as fallback and for whenever an update drops
   - Out of all the network requests that happen when you tap the Look Around button, the most likely candidate
     for containing that information is style 53 at z=15 specifically.  
   - Vector tiles are in Apple's custom `VMP4` format. The general structure of the format [has been decoded](https://github.com/19h/vmp4-dump),
     but the actual content of the individual sections has not, and a quick glance at Ghidra's decompiler output for the parsing functions makes me
     put this one in the "let's get back to this in another year or two" category.
- [ ] Decode the mesh, render it, and use it to improve movement etc.
   - There are three types of pano data Apple Maps will request. One is `/t/<face>/<zoom>`, which returns the pano faces as HEIC,
      but there are two others: `/m/<zoom>` and `/mt/7`, in a custom container format starting with the magic string `MCP4`. These files contain the mesh,
      compressed with Edgebreaker. I can decode the CLERS string, but I have not yet been able to make sense of how vertices are encoded in this format.
- [ ] Add PoIs
   - Everyone's least favorite feature, but it makes sense to add it for completion's sake.

## Credits
This app uses icons by [eva-icons](https://github.com/akveo/eva-icons), [boxicons](https://github.com/atisawd/boxicons) and [Liz Bravo](https://openmoji.org/library/emoji-1F34E/).
