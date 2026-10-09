// Baut Timi als eigenständige App (eine Datei, kein Node.js nötig).
// Aufruf: node build/build.mjs   – baut für das aktuelle Betriebssystem.

import { build } from "esbuild";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const platform = process.platform;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", cwd: root });

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1. Alles in eine Datei bündeln
await build({
  entryPoints: [path.join(root, "server.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(dist, "timi.cjs"),
  logLevel: "warning",
  logOverride: { "empty-import-meta": "silent" },
});

// 2. Oberfläche als eingebettete Dateien
const assets = {};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else assets[path.relative(root, full).split(path.sep).join("/")] = full;
  }
};
walk(path.join(root, "public"));

const seaConfig = path.join(dist, "sea-config.json");
fs.writeFileSync(
  seaConfig,
  JSON.stringify({
    main: path.join(dist, "timi.cjs"),
    output: path.join(dist, "sea-prep.blob"),
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets,
  }),
);
run(process.execPath, ["--experimental-sea-config", seaConfig]);

// 3. Node-Programm kopieren und das Paket einsetzen
const exe = path.join(dist, platform === "win32" ? "Timi.exe" : "Timi");
fs.copyFileSync(process.execPath, exe);
if (platform === "darwin") run("codesign", ["--remove-signature", exe]);

const postject = path.join(root, "node_modules", "postject", "dist", "cli.js");
run(process.execPath, [
  postject, exe, "NODE_SEA_BLOB", path.join(dist, "sea-prep.blob"),
  "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ...(platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : []),
]);

// 4. Plattform-Feinschliff
if (platform === "darwin") {
  run("codesign", ["--sign", "-", exe]);
  // Als Timi.app verpacken, damit es sich wie ein normales Mac-Programm öffnen lässt
  const app = path.join(dist, "Timi.app", "Contents");
  fs.mkdirSync(path.join(app, "MacOS"), { recursive: true });
  fs.mkdirSync(path.join(app, "Resources"), { recursive: true });
  // Läuft ohne sichtbares Fenster im Hintergrund; beenden über Timis Einstellungen.
  fs.copyFileSync(exe, path.join(app, "MacOS", "Timi"));
  fs.chmodSync(path.join(app, "MacOS", "Timi"), 0o755);
  const iconset = path.join(dist, "Timi.iconset");
  fs.mkdirSync(iconset);
  for (const size of [16, 32, 64, 128, 256, 512]) {
    run("sips", ["-z", String(size), String(size), "public/icons/icon-512.png", "--out", path.join(iconset, `icon_${size}x${size}.png`)]);
    if (size <= 256) {
      run("sips", ["-z", String(size * 2), String(size * 2), "public/icons/icon-512.png", "--out", path.join(iconset, `icon_${size}x${size}@2x.png`)]);
    }
  }
  run("iconutil", ["-c", "icns", iconset, "-o", path.join(app, "Resources", "Timi.icns")]);
  fs.writeFileSync(
    path.join(app, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Timi</string>
  <key>CFBundleDisplayName</key><string>Timi</string>
  <key>CFBundleIdentifier</key><string>de.timi.assistent</string>
  <key>CFBundleVersion</key><string>1.0.0</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>Timi</string>
  <key>CFBundleIconFile</key><string>Timi</string>
  <key>LSUIElement</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Timi hört dir zu, wenn du mit ihm sprichst.</string>
</dict></plist>
`,
  );
  run("codesign", ["--force", "--deep", "--sign", "-", path.join(dist, "Timi.app")]);
}

if (platform === "win32") {
  // Programmsymbol setzen
  const { default: pngToIco } = await import("png-to-ico");
  const ico = path.join(dist, "Timi.ico");
  fs.writeFileSync(ico, await pngToIco([path.join(root, "build/icon-256.png")]));
  const { rcedit } = await import("rcedit");
  await rcedit(exe, {
    icon: ico,
    "version-string": { ProductName: "Timi", FileDescription: "Timi – persönlicher Assistent", CompanyName: "Timi" },
    "file-version": "1.0.0",
    "product-version": "1.0.0",
  });
}

console.log("Fertig:", exe);
