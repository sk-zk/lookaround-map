
export async function getFirstFrameOfVideo(videoUrl, mimeType) {
    return new Promise(function(resolve, reject) {
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
