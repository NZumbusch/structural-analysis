# Sync with Google Drive: one-time setup

The app can keep your pieces the same on all your devices (browser and installed app) using a hidden folder of **your
own Google Drive**. Only this app can see the folder (`drive.appdata` scope), nothing goes through a server of ours, and
it costs nothing. Because there is no server, you create a small Google Cloud project once (about 10 minutes). It
only holds an identifier; no billing is needed.

## 1. Create the project and switch on the Drive API

1. Open <https://console.cloud.google.com/> and create a project (any name, e.g. "Tonartenverlauf").
2. *APIs & Services → Library*, search for **Google Drive API** and click **Enable**.

## 2. Consent screen

1. *APIs & Services → OAuth consent screen* (newer consoles: *Google Auth Platform*): user type **External**, app name
   (anything), your e-mail as support and developer contact.
2. *Data access / Scopes:* add `https://www.googleapis.com/auth/drive.appdata`.
3. *Audience / Test users:* add your own Google account(s). Leave the app in **Testing**; you never need to publish it.
   (Google shows an "unverified app" notice at first sign-in; for your own account choose *Continue*.)

## 3. Client ID

1. *Credentials → Create credentials → OAuth client ID → Web application*.
2. **Authorized JavaScript origins:** the address the app runs at, without a path, e.g. `https://nzumbusch.github.io`
   (add `http://localhost:4173` if you run it locally). The installed app uses the same address.
3. Create, then copy the **Client ID** (`…apps.googleusercontent.com`). It is not a secret.

## 4. Use it

- In the app: *Bibliothek → Mit Google Drive synchronisieren*, paste the Client ID, *Mit Google verbinden*.
  Repeat on every device (paste the same ID there).
- To avoid pasting it on each device, set it once for the build: repository *Settings → Secrets and variables →
  Actions → Variables → New repository variable* named `GOOGLE_CLIENT_ID`, then let the site deploy again. The app
  then has the ID built in.

## How it behaves

- **What is synced:** your pieces (one JSON file each). Settings, the default style and backups reminders stay local.
- **When:** right after connecting, about 15 seconds after an edit, when you return to the app, and when you press
  *Jetzt synchronisieren*. Pieces are also stored locally, so the app works offline and catches up later.
- **Sign-in lasts about an hour.** This is a limit of signing in without a server. When it ends, a bar says so and one
  tap on *Erneut anmelden* continues; nothing is lost in between.
- **Conflicts:** if a piece was changed on two devices, the newer version wins and the other one is kept as a copy
  named "… (Konflikt)", so nothing is overwritten silently.
- **Deleting** a piece deletes it on your other devices at their next sync (unless you edited it there since). Use
  *Alle sichern* now and then for file backups; Drive keeps the files, not a history of them.
- **Disconnecting** keeps everything on the device and on Drive. You can also remove the app's data and access at
  <https://myaccount.google.com/connections>.
