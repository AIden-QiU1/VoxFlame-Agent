# TEN Framework & Tman Integration Analysis

*Date: Jan 2026*
*Context: VoxFlame Agent Development*

## 1. TEN Manager (`tman`) Internals

`tman` acts as both a package manager (downloader) and a workspace initializer.

### Workflow
1.  **Install**: `tman install` reads `manifest.json`.
2.  **Resolution**:
    - Queries remote registry (GitHub Releases / OSS) for packages.
    - Resolves versions.
    - Creates/Updates `manifest-lock.json`.
3.  **Layout**:
    - Creates `ten_packages/` directory.
    - subfolders: `system/`, `extension/`, `protocol/`.
    - **Critical**: It patches/links libraries so that `ten_runtime` (Go/C++) can load them via `dlopen` or similar mechanisms.

### Docker Pattern: "Hybrid Injection"
For a project with mixed dependencies (Remote AI Models + Local Business Logic), the standard `tman` workflow needs adjustment in Docker:

1.  **Base**: Install `tman` binary (via curl).
2.  **Remote Deps**: `COPY manifest.json .` -> `RUN tman install`. This builds the skeleton.
3.  **Local Deps**: `COPY src/my_ext ten_packages/extension/my_ext`. This relies on the Runtime's **Auto-Discovery** feature (scanning `ten_packages/extension` at boot).

**Anti-Pattern**: trying to `tman install` local packages defined with `path: "./..."` in manifest often leads to schema validation errors or relative path hell in Docker layers.

## 2. Runtime Extension Loading

The error `Unable to find 'extension:foo' in registry` is misleading. It often means:
> "I scanned the folders, found the files, started the Python interpreter, tried to `import foo`, BUT the import crashed or the registration decorator never ran."

**Debugging Checklist**:
1.  **PYTHONPATH**: Must include `/app` and `/app/ten_packages`.
2.  **Dependencies**: The extension's `requirements.txt` must be pip installed. `tman` usually does this for remote pkgs, but for **local** extensions, you must ensure `pip install -r ...` happens in Dockerfile.
3.  **Decorator**: The entry `extension.py` MUST have `@register_addon_as_extension("name")`. This is how C++ learns about Python.

## 3. WebSocket Integration

In TEN, `websocket_server` is just another **Extension**.
*   **Input**: It receives audio bytes (PCM) from browser.
*   **Output**: It sends `audio_frame` into the Graph.
*   **Graph Config (`property.json`)**:
    ```json
    {
      "name": "websocket_server",
      "property": { "port": 8766 }
    }
    ```
*   **Connection**:
    *   `websocket_server` -> `stt` (Send PCM)
    *   `tts` -> `websocket_server` (Receive PCM to play)
