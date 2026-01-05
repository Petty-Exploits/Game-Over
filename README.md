# Game Over

An ever-evolving Chrome extension designed to prevent students from bypassing school content filters by blocking games, proxies, ROM emulators, and other exploits.

**Name:** Game Over  
**Version:** 3.5.6  
**Author:** Petty  
**Description:** An ever evolving anti school gaming extension, proxy, game, and rom, fingerprint detection

## Features

- **Advanced Fingerprinting Detection**: Scans the DOM for patterns like Eaglercraft, proxies, game canvases, and ROM loaders (e.g., `EJS_`, `.nes`/`.gba` files).
- **ROM Emulator Blocking**: Detects and blocks JavaScript-based ROM emulators and loaders.
- **WebSocket (WSS) Blocking**: Blocks known Eaglercraft relay servers.
- **Embed & Suspicious SRC Blocking**: Flags iframes/embeds from common bypass hosting domains (glitch.me, replit.dev, etc.).
- **Copy-Paste Protection**: Prevents copying/pasting exploit code on suspicious sites. (Replaces copy/pasta code with the schools internet fair use policy). 
- **Declarative Net Request Rules**: Blocks specific domains, file types, and patterns (e.g., github.io games, fake educational sites).
- **Google-Specific Fixes**: Hides AI Overviews and blocks interactive Doodle games.
- **Admin Panel**: Password-protected (SHA-256 hashed) popup with:
  - Toggle switches for all major features
  - URL whitelisting
  - Block event logging (viewable/clearable)
  - Dark mode toggle
- **Custom Block Page**: Full-page block with policy message and fancy animations.

## Installation

Load as an unpacked extension in Chrome/Edge (developer mode) or deploy via group policy for managed devices.
- Force install with ID: cljiolbjehnoaeohbnefccjecpikfbai

## Permissions

- Access to all URLs (for content scripts and blocking)
- Storage (settings, logs, whitelist)
- declarativeNetRequest (rule-based blocking)
- clipboardWrite (copy-paste blocking)

## Privacy

All data (logs, settings, whitelist) is stored locally — no telemetry or external communication.

## Contributing

Feel free to fork, or steal any of my code to bully students.

Made with frustration and coffee by Petty.
