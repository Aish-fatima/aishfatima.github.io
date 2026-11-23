# Feedback Fatima — Firebase + Cloudinary integration build

This ZIP contains an integration build based on the website ZIP you uploaded.

## Included
- Firebase Authentication (Email/Password) for admin login.
- Admin UID check in the browser, plus Firestore rules and Worker-side token verification.
- Firestore `gallery_media` metadata.
- Signed Cloudinary image/video uploads through the Cloudflare Worker.
- Authenticated Cloudinary deletion through the Worker, then Firestore document deletion.
- Public Firestore image/video galleries. The gallery reads records ordered by `createdAt` and filters media type in the browser, so a composite Firestore index is not required.
- Videos have controls and autoplay disabled.
- Existing CSS and visual layout are retained.

## Configured project values
- Firebase project: `feedback-fatima`
- Authorized admin UID: `LOnmkvnLwjYdDtATbJ8sDbieHZQ2`
- Cloudinary cloud: `doz60trsm`
- Worker URL: `https://feedback-fatima-upload.aishfatimasiddiqui.workers.dev`
- CORS website origin: `https://aishfatimafeedback.in`

## Important review notes

- This is a corrected integration package, not a production-tested deployment. Firebase login, Cloudinary upload/deletion, and live gallery behavior still need to be tested against your accounts.
- The existing CSS file is preserved byte-for-byte. The public gallery script reuses the existing gallery container IDs and `.gallery-item` styling.
- If Firestore metadata saving fails after a Cloudinary upload, the admin script attempts to remove the just-uploaded Cloudinary asset through the Worker.
- The Worker replacement retains the GET health check as well as authenticated POST operations.

## Cloudflare Worker note

The handover says `feedback-fatima-upload` is already deployed and its browser health check succeeds. Do not redeploy or change the Worker merely because this ZIP contains a replacement source file.

The included `CLOUDFLARE_WORKER_REPLACEMENT.js` is supplied as a reviewed reference. It includes the GET health check, Firebase ID-token verification, signed uploads, and deletion support for both `delete` and `delete-media` action names.

During testing, first verify the currently deployed Worker with the admin page. Only if the authenticated upload/deletion test proves the deployed Worker is missing a required operation should you consider replacing its code. Before any replacement, save a backup of the live source and keep all five existing Runtime Variables/Secrets unchanged. Never paste the Cloudinary API Secret into a website file or GitHub.
