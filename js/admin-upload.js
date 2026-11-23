(function () {
  "use strict";

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  const ADMIN_UID = window.FEEDBACK_ADMIN_UID;
  const WORKER_URL = window.FEEDBACK_UPLOAD_WORKER_URL;
  const CLOUD_NAME = window.FEEDBACK_CLOUDINARY_CLOUD_NAME;

  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const loginForm = $("loginForm");
  const uploadArea = $("uploadArea");
  const setupWarning = $("setupWarning");
  const mediaList = $("mediaList");
  const mediaControls = $("mediaControls");
  const selectAll = $("selectAllMedia");
  const deleteSelectedBtn = $("deleteSelectedBtn");
  const uploadButton = document.querySelector('#uploadForm button[type="submit"]');
  const progressWrap = $("uploadProgressWrap");
  const progressBar = $("uploadProgressBar");

  function say(message, isError) {
    status.textContent = message;
    status.classList.toggle("text-danger", !!isError);
    status.classList.toggle("text-success", !isError);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c];
    });
  }

  function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
  }

  function showProgress(value) {
    const percent = Math.max(0, Math.min(100, Math.round(value)));
    progressWrap.classList.remove("hidden");
    progressBar.style.width = percent + "%";
    progressBar.textContent = percent + "%";
    progressBar.setAttribute("aria-valuenow", String(percent));
  }

  function hideProgress() {
    progressWrap.classList.add("hidden");
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
  }

  function showSetupError(message) {
    setupWarning.classList.remove("hidden");
    setupWarning.textContent = message;
    loginForm.querySelector('button[type="submit"]').disabled = true;
  }

  async function workerRequest(payload) {
    if (!isAdmin(auth && auth.currentUser)) {
      throw new Error("Only the authorized administrator can perform this action.");
    }

    const token = await auth.currentUser.getIdToken(true);
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.error || "Secure media service error (" + response.status + ").");
    }
    return data;
  }

  function syncSelection() {
    const checks = Array.from(mediaList.querySelectorAll(".media-select"));
    const selected = checks.filter(function (checkbox) { return checkbox.checked; }).length;
    deleteSelectedBtn.disabled = selected === 0;
    deleteSelectedBtn.textContent = selected
      ? "Delete selected (" + selected + ")"
      : "Delete selected";
    selectAll.checked = checks.length > 0 && selected === checks.length;
    selectAll.indeterminate = selected > 0 && selected < checks.length;
  }

  async function loadMedia() {
    mediaList.innerHTML = '<p class="text-muted">Loading media…</p>';

    try {
      const snapshot = await db.collection("gallery_media")
        .orderBy("createdAt", "desc")
        .get();
      const items = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      if (!items.length) {
        mediaControls.classList.add("hidden");
        mediaList.innerHTML = '<p class="text-muted">No uploaded photos or videos yet.</p>';
        return;
      }

      mediaControls.classList.remove("hidden");
      selectAll.checked = false;
      selectAll.indeterminate = false;

      mediaList.innerHTML = items.map(function (item) {
        const kind = item.resourceType === "video" ? "Video" : "Photo";
        return '<div class="media-item">' +
          '<div class="media-name"><label><input type="checkbox" class="form-check-input media-select" data-id="' +
          escapeHtml(item.id) + '"> <span class="badge text-bg-light me-1">' + kind + '</span>' +
          escapeHtml(item.fileName || item.name || item.publicId || "Media") +
          '</label></div><button type="button" class="btn btn-outline-danger btn-sm delete-btn" data-id="' +
          escapeHtml(item.id) + '">Delete</button></div>';
      }).join("");

      mediaList.querySelectorAll(".media-select").forEach(function (checkbox) {
        checkbox.addEventListener("change", syncSelection);
      });
      mediaList.querySelectorAll(".delete-btn").forEach(function (button) {
        button.addEventListener("click", async function () {
          const item = items.find(function (entry) { return entry.id === button.dataset.id; });
          if (item) await deleteItems([item]);
        });
      });
      syncSelection();
    } catch (error) {
      mediaControls.classList.add("hidden");
      mediaList.innerHTML =
        '<p class="text-danger">Could not load media: ' + escapeHtml(error.message) + '</p>';
    }
  }

  async function deleteItems(items) {
    if (!items.length) return;

    const label = items.length === 1 ? "this item" : items.length + " selected items";
    if (!window.confirm(
      "Permanently delete " + label + " from Cloudinary and the live gallery? This cannot be undone."
    )) return;

    deleteSelectedBtn.disabled = true;
    let deleted = 0;

    say("Deleting " + items.length + " item(s)…");
    for (const item of items) {
      try {
        if (!item.publicId || !["image", "video"].includes(item.resourceType)) {
          throw new Error("This gallery record is missing its Cloudinary deletion details.");
        }

        await workerRequest({
          action: "delete",
          resourceType: item.resourceType,
          publicId: item.publicId
        });

        await db.collection("gallery_media").doc(item.id).delete();
        deleted++;
      } catch (error) {
        say(
          "Deleted " + deleted + " of " + items.length +
          ". Could not delete the remaining item(s): " + error.message,
          true
        );
        await loadMedia();
        return;
      }
    }

    say("Deleted " + deleted + " item(s) successfully.");
    await loadMedia();
  }

  selectAll.addEventListener("change", function () {
    mediaList.querySelectorAll(".media-select").forEach(function (checkbox) {
      checkbox.checked = selectAll.checked;
    });
    syncSelection();
  });

  deleteSelectedBtn.addEventListener("click", async function () {
    const ids = Array.from(mediaList.querySelectorAll(".media-select:checked"))
      .map(function (checkbox) { return checkbox.dataset.id; });

    try {
      const items = [];
      for (const id of ids) {
        const doc = await db.collection("gallery_media").doc(id).get();
        if (doc.exists) items.push(Object.assign({ id: doc.id }, doc.data()));
      }
      await deleteItems(items);
    } catch (error) {
      say("Could not identify selected media: " + error.message, true);
    }
  });

  async function refresh(user) {
    if (user && !isAdmin(user)) {
      await auth.signOut();
      loginForm.classList.remove("hidden");
      uploadArea.classList.add("hidden");
      say("This account is not authorized to access the admin dashboard.", true);
      return;
    }

    loginForm.classList.toggle("hidden", !!user);
    uploadArea.classList.toggle("hidden", !user);

    if (user) {
      await loadMedia();
    } else {
      mediaControls.classList.add("hidden");
      mediaList.innerHTML = '<p class="text-muted">Log in to view uploaded media.</p>';
    }
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    say("Signing in…");

    try {
      const result = await auth.signInWithEmailAndPassword(
        $("email").value.trim(),
        $("password").value
      );

      if (!isAdmin(result.user)) {
        await auth.signOut();
        throw new Error("This account is not the authorized administrator.");
      }

      say("Signed in successfully.");
      await refresh(result.user);
    } catch (error) {
      say("Login failed: " + error.message, true);
    }
  });

  $("logoutBtn").addEventListener("click", async function () {
    await auth.signOut();
    hideProgress();
    say("Logged out.");
    await refresh(null);
  });

  function uploadToCloudinary(file, signed, onProgress) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      const form = new FormData();

      form.append("file", file);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("folder", signed.folder);
      form.append("signature", signed.signature);

      xhr.open(
        "POST",
        "https://api.cloudinary.com/v1_1/" +
          encodeURIComponent(CLOUD_NAME) + "/" + signed.resourceType + "/upload"
      );

      xhr.upload.onprogress = function (event) {
        if (event.lengthComputable) onProgress(event.loaded / event.total * 100);
      };

      xhr.onload = function () {
        let data = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch (_) {}

        if (xhr.status >= 200 && xhr.status < 300) {
          if (!data.secure_url || !data.public_id) {
            reject(new Error("Cloudinary response is missing the uploaded file details."));
          } else {
            resolve(data);
          }
        } else {
          reject(new Error(
            data.error && data.error.message
              ? data.error.message
              : "Cloudinary upload failed (" + xhr.status + ")."
          ));
        }
      };

      xhr.onerror = function () {
        reject(new Error("Network error while uploading to Cloudinary."));
      };

      xhr.send(form);
    });
  }

  $("uploadForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const files = Array.from($("mediaFiles").files || []);
    if (!files.length) return;

    if (!isAdmin(auth.currentUser)) {
      say("Please sign in with the authorized admin account again.", true);
      return;
    }

    uploadButton.disabled = true;
    let completed = 0;

    try {
      for (const file of files) {
        const resourceType = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/") ? "image" : "";

        if (!resourceType) {
          throw new Error(file.name + ": only image/video files are supported.");
        }

        say("Preparing secure upload for " + file.name + "…");
        showProgress(0);

        const signed = await workerRequest({
          action: "sign-upload",
          resourceType: resourceType
        });

        if (
          !signed.signature || !signed.apiKey || !signed.timestamp ||
          !signed.folder || signed.resourceType !== resourceType
        ) {
          throw new Error("Secure upload service returned incomplete signing details.");
        }

        const uploaded = await uploadToCloudinary(file, signed, showProgress);

        const metadata = {
          name: file.name,
          fileName: file.name,
          mediaUrl: uploaded.secure_url,
          publicUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
          resourceType: uploaded.resource_type || resourceType,
          fileType: file.type || "",
          format: uploaded.format || "",
          bytes: uploaded.bytes || file.size,
          folder: signed.folder,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (uploaded.width) metadata.width = uploaded.width;
        if (uploaded.height) metadata.height = uploaded.height;
        if (uploaded.duration) metadata.duration = uploaded.duration;

        try {
          await db.collection("gallery_media").add(metadata);
        } catch (databaseError) {
          // Remove the Cloudinary asset if metadata could not be published.
          let cleanupMessage = "";
          try {
            await workerRequest({
              action: "delete",
              resourceType: resourceType,
              publicId: uploaded.public_id
            });
          } catch (cleanupError) {
            cleanupMessage = " Cleanup also failed; keep this Cloudinary asset for manual review.";
          }

          throw new Error(
            "Cloudinary upload completed, but Firestore could not save its metadata: " +
            databaseError.message + cleanupMessage
          );
        }

        completed++;
        say("Uploaded " + completed + " of " + files.length + " file(s)…");
      }

      $("uploadForm").reset();
      hideProgress();
      say("Success! " + completed + " file(s) uploaded and published.");
      await loadMedia();
    } catch (error) {
      say("Upload stopped after " + completed + " successful file(s): " + error.message, true);
      hideProgress();
      await loadMedia();
    } finally {
      uploadButton.disabled = false;
    }
  });

  if (!auth || !db || !ADMIN_UID || !WORKER_URL || !CLOUD_NAME) {
    showSetupError(
      "Firebase or secure upload configuration is missing. Check Firebase SDKs and js/firebase-config.js."
    );
    return;
  }

  auth.onAuthStateChanged(function (user) {
    refresh(user).catch(function (error) {
      say("Dashboard error: " + error.message, true);
    });
  });
})();
