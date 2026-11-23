/* Public Firebase Firestore gallery. Uses a single-field query to avoid requiring a composite index. */
(function () {
  "use strict";

  const db = window.firebaseDb;
  const isVideoPage = window.location.pathname.toLowerCase().endsWith("videos.html");
  const gallery = document.getElementById(
    isVideoPage ? "firebaseVideoGallery" : "firebaseGallery"
  );
  const errorBox = document.getElementById(
    isVideoPage ? "firebaseVideoGalleryError" : "firebaseGalleryError"
  );

  if (!gallery) return;

  if (!db) {
    showError(new Error("Firebase Firestore did not initialize."));
    return;
  }

  function showError(error) {
    console.error("Firestore gallery error:", error);
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = "Unable to load media right now. Please refresh the page.";
    }
    gallery.innerHTML = "";
  }

  function createGalleryItem(media) {
    const url = media.mediaUrl || media.publicUrl;
    if (typeof url !== "string" || !/^https:\/\/res\.cloudinary\.com\//i.test(url)) {
      return null;
    }

    const item = document.createElement("div");
    item.className = "gallery-item";

    if (isVideoPage) {
      if (media.resourceType !== "video") return null;
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.autoplay = false;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.display = "block";
      video.style.objectFit = "contain";
      video.setAttribute("aria-label", media.fileName || media.name || "Success story video");
      item.appendChild(video);
    } else {
      if (media.resourceType !== "image") return null;
      const image = document.createElement("img");
      image.src = url;
      image.alt = media.fileName || media.name || "Success Story";
      image.loading = "lazy";
      image.decoding = "async";
      item.appendChild(image);
    }

    return item;
  }

  // Fetch in createdAt order, then filter locally. This avoids a Firestore
  // composite index requirement for resourceType + createdAt.
  db.collection("gallery_media")
    .orderBy("createdAt", "desc")
    .get()
    .then(function (snapshot) {
      const expectedType = isVideoPage ? "video" : "image";
      const items = [];

      snapshot.forEach(function (doc) {
        const media = doc.data() || {};
        if (media.resourceType === expectedType) {
          const element = createGalleryItem(media);
          if (element) items.push(element);
        }
      });

      gallery.innerHTML = "";
      if (errorBox) errorBox.hidden = true;

      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "gallery-loading";
        empty.textContent = isVideoPage
          ? "No videos are available yet."
          : "No images are available yet.";
        gallery.appendChild(empty);
        return;
      }

      items.forEach(function (item) {
        gallery.appendChild(item);
      });
    })
    .catch(showError);
})();
