const GOOGLE_DRIVE_VIDEO_API_URL =
    "https://script.google.com/macros/s/AKfycbxIxSaVHU3u8X4nqV-HxLsPVbcz5r0k2bdMPDxdEJpRvZ84oYsfgzOf0YRnfvM7Hdm4QA/exec";

const VIDEO_BATCH_SIZE = 12;

document.addEventListener("DOMContentLoaded", loadGoogleDriveVideos);

async function loadGoogleDriveVideos() {
    const gallery = document.getElementById("googleDriveVideoGallery");
    const errorBox = document.getElementById("googleDriveVideoGalleryError");

    if (!gallery) return;

    try {
        gallery.innerHTML =
            '<div class="drive-gallery-loading">Loading videos...</div>';

        const response = await fetch(
            GOOGLE_DRIVE_VIDEO_API_URL + "?type=videos&t=" + Date.now(),
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Apps Script returned HTTP " + response.status);
        }

        const videos = await response.json();

        if (videos && videos.error) {
            throw new Error(videos.message || "Apps Script error");
        }

        if (!Array.isArray(videos) || videos.length === 0) {
            gallery.innerHTML =
                '<div class="drive-gallery-empty">No videos uploaded yet.</div>';
            return;
        }

        gallery.innerHTML = "";

        let loaded = 0;
        const sentinel = document.createElement("div");
        sentinel.className = "gallery-load-sentinel";
        gallery.after(sentinel);

        function addNextBatch() {
            const end = Math.min(loaded + VIDEO_BATCH_SIZE, videos.length);
            const fragment = document.createDocumentFragment();

            for (let i = loaded; i < end; i++) {
                const video = videos[i];

                const item = document.createElement("div");
                item.className = "gallery-item google-drive-video-item";

                const preview = document.createElement("div");
                preview.className = "google-drive-video-preview";
                preview.style.aspectRatio = "16 / 9";
                preview.style.position = "relative";
                preview.style.overflow = "hidden";

                const placeholder = document.createElement("button");
                placeholder.type = "button";
                placeholder.textContent = "▶ Load video";
                placeholder.setAttribute("aria-label", "Load " + (video.name || "video"));
                placeholder.style.cssText =
                    "position:absolute;inset:0;width:100%;height:100%;border:0;" +
                    "background:transparent;cursor:pointer;font-size:18px;";

                placeholder.addEventListener("click", function () {
                    loadVideoPreview(preview, video);
                }, { once: true });

                preview.appendChild(placeholder);
                item.appendChild(preview);
                fragment.appendChild(item);
            }

            gallery.appendChild(fragment);
            loaded = end;

            if (loaded >= videos.length) {
                observer.disconnect();
                sentinel.remove();
            }
        }

        addNextBatch();

        const observer = new IntersectionObserver(function(entries) {
            if (!entries.some(entry => entry.isIntersecting)) return;
            if (loaded < videos.length) addNextBatch();
        }, { rootMargin: "1000px 0px" });

        observer.observe(sentinel);

        if (errorBox) errorBox.hidden = true;

    } catch (error) {
        console.error("Google Drive Video Gallery Error:", error);
        gallery.innerHTML = "";

        if (errorBox) {
            errorBox.hidden = false;
            errorBox.textContent =
                "Unable to load videos right now. Please refresh the page.";
        }
    }
}

function loadVideoPreview(container, video) {
    const iframe = document.createElement("iframe");

    iframe.src =
        "https://drive.google.com/file/d/" +
        encodeURIComponent(video.id) +
        "/preview";

    iframe.title = video.name || "Video";
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    iframe.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;border:0;";

    container.innerHTML = "";
    container.appendChild(iframe);
}
