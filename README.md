<div align="center">
  <img src="public/pwa-512x512.png" alt="WICK app icon" width="144">
  <h1>WICK</h1>
  <p><strong>A calm desktop writing sanctuary.</strong></p>
  <p>Draft documents and books, organize ideas visually, and preview your work in a focused workspace.</p>
  <p>
    <a href="https://github.com/m-7chicha/wick-writer/releases/latest/download/WICK.Setup.1.0.0.exe"><strong>Download the Windows installer</strong></a>
    ·
    <a href="https://github.com/m-7chicha/wick-writer/releases/latest/download/WICK-1.0.0.AppImage"><strong>Linux AppImage (Fedora and other distros)</strong></a>
    ·
    <a href="https://github.com/m-7chicha/wick-writer/releases/latest/download/wick-writer_1.0.0_amd64.deb"><strong>Linux .deb</strong></a>
    ·
    <a href="https://github.com/m-7chicha/wick-writer/releases/latest">All downloads</a>
  </p>
</div>

## Install WICK

### Windows

1. Download the [WICK Windows installer](https://github.com/m-7chicha/wick-writer/releases/latest/download/WICK.Setup.1.0.0.exe).
2. Open the downloaded `.exe` and follow the setup prompts.
3. Launch WICK from the Start menu or desktop shortcut.

Windows may show a SmartScreen warning because the installer is not code-signed. Only continue if you downloaded it from this repository's release.

### Linux

#### Debian / Ubuntu

Download the [`.deb` package](https://github.com/m-7chicha/wick-writer/releases/latest/download/wick-writer_1.0.0_amd64.deb). From the folder where it was downloaded, install it with:

```sh
sudo apt install ./wick-writer_1.0.0_amd64.deb
```

#### Fedora and other Linux distributions

There is no native RPM package in this release. Use the [x64 AppImage](https://github.com/m-7chicha/wick-writer/releases/latest/download/WICK-1.0.0.AppImage). From the download folder, run:

```sh
chmod +x WICK-1.0.0.AppImage
./WICK-1.0.0.AppImage
```

If Fedora reports missing FUSE 2 support, install it with `sudo dnf install fuse-libs`. Both Linux downloads are x64 builds. See [All downloads](https://github.com/m-7chicha/wick-writer/releases/latest) for release details.

## What WICK does

WICK is a desktop app for writing and developing creative work. It brings together a focused editor for documents and books, visual mindstorming for ideas, and a studio preview for reviewing your work. Your library is stored locally on your computer; no separate server is needed to use the packaged desktop app.

## Build from source

Install Node.js 22 LTS and npm, then install dependencies:

```sh
npm ci
```

Build the desktop app for the operating system you are using:

```sh
# Windows: installer and portable .exe in release/
npm run desktop:pack:win

# Linux: AppImage and Debian .deb in release/
npm run desktop:pack:linux
```

The packaged app includes its own runtime; Node.js is only needed to build from source. Windows and Linux packages should be built on their respective operating systems.

## Publish a release

Pushing a version tag such as `v1.0.0` starts the GitHub Actions workflow. It builds the Windows and Linux packages and attaches them to a GitHub Release:

```sh
git tag v1.0.0
git push origin v1.0.0
```

Update the version in `package.json` before creating a tag for a later release.

## Your writing and settings

WICK keeps its library in your operating system's application data folder, separate from the installed app. Upgrading or uninstalling is not intended to delete that data. Export a backup from the app before moving to another computer.
