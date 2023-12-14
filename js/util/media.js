export async function getFirstFrameOfVideo(videoUrl, mimeType) {
  return new Promise(function (resolve, reject) {
    const video = document.createElement("video");

    video.addEventListener("loadedmetadata", (_) => {
      video.currentTime = 0;
    });
    
    video.addEventListener("seeked", (_) => {
      const canvas = document.createElement("canvas");
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    });

    const source = document.createElement("source");
    video.appendChild(source);
    source.src = videoUrl;
    source.type = mimeType;
    video.remove();
  });
}

export function isHevcSupported() {
  // check if HEVC Main Still Picture profile is supported,
  // which is what the HEVC frame in a HEIC image uses
  return MediaSource.isTypeSupported('video/mp4;codecs="hev1.3.E.L120.90"');
}

export async function isHeicSupported() {
  const testImage =
    "data:image/heic;base64,AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAYFtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAANGlsb2MAAAAAREAAAgABAAAAAAGlAAEAAAAAAAAAHwACAAAAAAHEAAEAAAAAAAAA3AAAADhpaW5mAAAAAAACAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAAFWluZmUCAAABAAIAAEV4aWYAAAAAwGlwcnAAAACiaXBjbwAAAHZodmNDAQQIAAAAAAAAAAAAHvAA/P74+AAADwMgAAEAF0ABDAH//wQIAAADAJ04AAADAAAeugJAIQABACpCAQEECAAAAwCdOAAAAwAAHrAggQWW6kkka5uAhoCCAAADAAIAAAMAAhAiAAEAB0QBwXKwIkAAAAAUaXNwZQAAAAAAAABAAAAAQAAAABBwaXhpAAAAAAMICAgAAAAWaXBtYQAAAAAAAAABAAEDgQKDAAAAGmlyZWYAAAAAAAAADmNkc2MAAgABAAEAAAEDbWRhdAAAABsoAa8GOFtzv/Lf4AJ/r/Gz///upykP+ITjlfgAAAAASUkqAAgAAAAGABIBAwABAAAAAQAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAwAAADEBAgARAAAAZgAAAGmHBAABAAAAeAAAAAAAAACjkwAA6AMAAKOTAADoAwAAcGFpbnQubmV0IDUuMC4xMQAABQAAkAcABAAAADAyMzABoAMAAQAAAAEAAAACoAQAAQAAAEAAAAADoAQAAQAAAEAAAAAFoAQAAQAAALoAAAAAAAAAAgABAAIABAAAAFI5OAACAAcABAAAADAxMDAAAAAA";
  var image = new Image();
  image.src = testImage;
  try {
    await image.decode();
    return true;
  } catch {
    return false;
  }
}
