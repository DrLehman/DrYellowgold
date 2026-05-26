# Build Assets

Place your app icons in this directory:

## Required Files for macOS

- `icon.icns` - macOS app icon (required for DMG)

## Creating icon.icns

### Option 1: Using iconutil (macOS)

1. Create a folder named `icon.iconset`
2. Add PNG files at these sizes:
   - icon_16x16.png
   - icon_16x16@2x.png (32x32)
   - icon_32x32.png
   - icon_32x32@2x.png (64x64)
   - icon_128x128.png
   - icon_128x128@2x.png (256x256)
   - icon_256x256.png
   - icon_256x256@2x.png (512x512)
   - icon_512x512.png
   - icon_512x512@2x.png (1024x1024)

3. Run: `iconutil -c icns icon.iconset`

### Option 2: Using electron-icon-builder

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./source-icon.png --output=./build
```

### Option 3: Online converters

Use sites like cloudconvert.com to convert a 1024x1024 PNG to .icns format.

## Note

If no icon is provided, electron-builder will use a default Electron icon.
