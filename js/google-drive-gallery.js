const GOOGLE_DRIVE_API_URL =
    "https://script.google.com/macros/s/AKfycbxIxSaVHU3u8X4nqV-HxLsPVbcz5r0k2bdMPDxdEJpRvZ84oYsfgzOf0YRnfvM7Hdm4QA/exec";

const IMAGE_BATCH_SIZE = 30;

document.addEventListener("DOMContentLoaded", loadGoogleDriveGallery);

async function loadGoogleDriveGallery() {
    const gallery = document.getElementById("googleDriveGallery");
    const errorBox = document.getElementById("googleDriveGalleryError");

    if (!gallery) return;

    try {
        gallery.innerHTML =
            '<div class="drive-gallery-loading">Loading success stories...</div>';

        const response = await fetch(
            GOOGLE_DRIVE_API_URL + "?t=" + Date.now(),
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Apps Script returned HTTP " + response.status);
        }

        const images = await response.json();

        if (images && images.error) {
            throw new Error(images.message || "Apps Script error");
        }

        if (!Array.isArray(images) || images.length === 0) {
            gallery.innerHTML =
                '<div class="drive-gallery-empty">No images uploaded yet.</div>';
            return;
        }

        gallery.innerHTML = "";

        let loaded = 0;
        let sentinel = document.createElement("div");
        sentinel.className = "gallery-load-sentinel";
        gallery.after(sentinel);

        function addNextBatch() {
            const end = Math.min(loaded + IMAGE_BATCH_SIZE, images.length);
            const fragment = document.createDocumentFragment();

            for (let i = loaded; i < end; i++) {
                const image = images[i];
                const item = document.createElement("div");
                item.className = "gallery-item google-drive-item";

                const img = document.createElement("img");
                img.src = image.url;
                img.alt = image.name || "Success Story";
                img.loading = "lazy";
                img.decoding = "async";

                img.onerror = function () {
                    item.remove();
                };

                item.appendChild(img);
                fragment.appendChild(item);
            }

            gallery.appendChild(fragment);
            loaded = end;

            if (loaded >= images.length) {
                observer.disconnect();
                sentinel.remove();
            }
        }

        addNextBatch();

        const observer = new IntersectionObserver(function(entries) {
            if (!entries.some(entry => entry.isIntersecting)) return;
            if (loaded < images.length) addNextBatch();
        }, { rootMargin: "1000px 0px" });

        observer.observe(sentinel);

        if (errorBox) errorBox.hidden = true;

    } catch (error) {
        console.error("Google Drive Gallery Error:", error);
        gallery.innerHTML = "";

        if (errorBox) {
            errorBox.hidden = false;
            errorBox.textContent =
                "Unable to load images right now. Please refresh the page.";
        }
    }
}
