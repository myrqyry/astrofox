# GPU / Graphics Compatibility (Astrofox)

This document describes runtime flags, environment variables, and troubleshooting steps to handle GPU, Mesa, and WebGL issues on Linux (and other platforms) when running Astrofox.

Important files that were updated to improve GPU compatibility:
- [`src/main/index.js`](src/main/index.js:1) — added environment-controlled GPU startup flags, GPU crash and renderer-gone handlers, and logging guidance.
- [`src/main/window.js`](src/main/window.js:1) — made renderer WebGL enabling configurable via environment variables and added GPU feature status logging.
- [`src/graphics/common.js`](src/graphics/common.js:1) — wrapped WebGL renderer creation in try/catch, added a software-fallback renderer and fallback render-target implementations so the app can continue to run when WebGL is unavailable.

Environment variables (runtime configuration)
- ASTROFOX_DISABLE_GPU
  - Type: boolean
  - Usage: Set to `true` to disable hardware GPU acceleration entirely for the application.
  - Example: `ASTROFOX_DISABLE_GPU=true ./astrofox`
  - Behavior: Calls Electron's `app.disableHardwareAcceleration()` before startup. Also disables WebGL in renderer processes.

- ASTROFOX_DISABLE_WEBGL
  - Type: boolean
  - Usage: Alias for disabling WebGL in the renderer.
  - Example: `ASTROFOX_DISABLE_WEBGL=true ./astrofox`
  - Behavior: When set, BrowserWindows are created with `webgl: false`.

- ASTROFOX_SOFTWARE_GL
  - Type: boolean
  - Usage: Set to `true` to force Mesa into software rendering mode on Linux.
  - Example: `ASTROFOX_SOFTWARE_GL=true ./astrofox`
  - Behavior: Sets `LIBGL_ALWAYS_SOFTWARE=1` for the process so Mesa uses software rasterizer.

- LIBGL_ALWAYS_SOFTWARE
  - Type: boolean (string `1` supported)
  - Usage: Standard Mesa environment variable. Setting to `1` forces software GL.
  - Example: `LIBGL_ALWAYS_SOFTWARE=1 ./astrofox`

- ASTROFOX_USE_SWIFT_SHADER
  - Type: boolean
  - Usage: Request Chromium's SwiftShader software GL backend.
  - Example: `ASTROFOX_USE_SWIFT_SHADER=true ./astrofox`
  - Behavior: Appends `--use-gl=swiftshader` and tries to enable SwiftShader features. Note: SwiftShader libraries must be available in the Electron/Chromium build or distributed with the app.

- ASTROFOX_IGNORE_GPU_BLACKLIST
  - Type: boolean (default: true unless explicitly set to `false`)
  - Usage: Controls whether to append Chromium's `--ignore-gpu-blacklist`. Passing `false` disables adding that switch.
  - Example: `ASTROFOX_IGNORE_GPU_BLACKLIST=false ./astrofox`
  - Behavior: Appends `--ignore-gpu-blacklist` by default (preserves previous behavior). Set to `false` to keep Chromium's blacklist enforcement.

Logging and diagnostics
- The application uses the `debug` package for internal logs. Enable debug logging to see GPU-related logs:
  - Example: `DEBUG=main,window,graphics,init npm start`
  - The main areas of logs to check:
    - `main` — startup flags, gpu crash handlers, logs added in [`src/main/index.js`](src/main/index.js:1).
    - `window` — BrowserWindow creation, GPU feature status (see [`src/main/window.js`](src/main/window.js:1)).
    - `graphics` — WebGLRenderer creation errors may be forwarded to the preload API and appear in main logs.

- GPU process crashes and renderer failures are explicitly logged and provide actionable guidance in the console:
  - When the GPU process crashes, a message suggests relaunching with `ASTROFOX_DISABLE_GPU=true` or `ASTROFOX_SOFTWARE_GL=true`.

Software fallback & graceful degradation
- If WebGL context creation fails or native GL libraries are unavailable, the app now:
  - Attempts to create a real `three.js` `WebGLRenderer`.
  - If creation fails, falls back to a minimal software-fallback renderer (2D/No-op) so the rest of the application continues to function.
  - Uses a `FakeRenderTarget` when `WebGLRenderTarget` creation fails, providing the small subset of the API expected by the codebase so operations like read-back, composer, and render pipelines do not throw.
  - The visual output will be degraded (some visual effects may no-op), but the application UI and audio functionality remain available for troubleshooting.

What to try when you see MESA-LOADER / WebGL errors
1. Quick test: disable GPU acceleration
   - Run: `ASTROFOX_DISABLE_GPU=true ./astrofox`
   - This disables Chromium GPU acceleration and WebGL. It is the most reliable way to avoid driver-related GPU crashes.

2. Force Mesa software rendering
   - Run: `ASTROFOX_SOFTWARE_GL=true ./astrofox`
   - Equivalent: `LIBGL_ALWAYS_SOFTWARE=1 ./astrofox`
   - This forces Mesa to use the CPU-based renderer (slower but avoids buggy GPU drivers).

3. Attempt SwiftShader (if bundled)
   - Run: `ASTROFOX_USE_SWIFT_SHADER=true ./astrofox`
   - Note: SwiftShader may need to be bundled with the application for this to succeed.

4. Keep Chromium blacklist enforcement
   - If `ignore-gpu-blacklist` causes crashes on your hardware, set:
     - `ASTROFOX_IGNORE_GPU_BLACKLIST=false ./astrofox`

5. Combine steps for advanced troubleshooting
   - Example: `ASTROFOX_DISABLE_GPU=true LIBGL_ALWAYS_SOFTWARE=1 DEBUG=main,window,graphics ./astrofox`

Developer tips
- To collect GPU feature status from Electron at runtime, the app logs `app.getGPUFeatureStatus()` during window creation (if available). Check the console output for the returned object to get detailed feature states.
- Look for messages printed to the console that mention "GPU process crashed" or "WebGLRenderer creation failed" — they contain recommended next steps.
- If you wish to enable persistent logging or write GPU logs to a file, use standard shell redirection:
  - Example: `DEBUG=main,window,graphics ./astrofox 2>&1 | tee astrofox-gpu.log`

Code pointers (where the changes were made)
- Append / disable Chromium flags and handle software GL:
  - [`src/main/index.js`](src/main/index.js:1)
- Respect WebGL disabling per-window and log GPU feature status:
  - [`src/main/window.js`](src/main/window.js:1)
- Safe WebGL creation and software fallback for renderer and render targets:
  - [`src/graphics/common.js`](src/graphics/common.js:1)

Notes & assumptions
- Electron's `app.disableHardwareAcceleration()` must be called before the `ready` event. The current implementation calls it at import/startup when `ASTROFOX_DISABLE_GPU=true`.
- Some runtime switches (like SwiftShader) depend on Chromium/Electron build details and may not work unless the corresponding libraries are available in the runtime environment.
- Software rendering is slower and may reduce frame rates, but is a robust fallback for broken or missing GPU drivers.

If you still see issues
- Copy the console output including MESA-LOADER errors and GPU-process crash messages and attach it when reporting issues. The logs created by the `debug` channels (`main`, `window`, `graphics`) are particularly helpful.
- Provide `app.getGPUFeatureStatus()` output (if available) and the values of relevant environment variables when asking for help.