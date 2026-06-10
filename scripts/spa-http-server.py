#!/usr/bin/env python3
from __future__ import annotations

import argparse
import mimetypes
import os
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


class SpaRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def _resolve_path(self) -> Path:
        parsed = urlparse(self.path)
        request_path = unquote(parsed.path)
        rel = request_path.lstrip("/")
        candidate = Path(self.directory) / rel
        if request_path in {"", "/"}:
            return Path(self.directory) / "index.html"
        if candidate.is_dir():
            index = candidate / "index.html"
            if index.exists():
                return index
        if candidate.exists():
            return candidate
        if Path(rel).suffix == "":
            return Path(self.directory) / "index.html"
        return candidate

    def send_head(self):
        path = self._resolve_path()
        if not path.exists() or path.is_dir():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        try:
            file = path.open("rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        fs = path.stat()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(fs.st_size))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        return file


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve a Vite build with SPA fallback")
    parser.add_argument("directory", nargs="?", default="dist", help="Directory to serve")
    parser.add_argument("--bind", default="127.0.0.1", help="Address to bind")
    parser.add_argument("--port", type=int, default=3000, help="Port to listen on")
    args = parser.parse_args()

    directory = os.fspath(Path(args.directory).resolve())
    handler = partial(SpaRequestHandler, directory=directory)
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    try:
        print(f"Serving {directory} on http://{args.bind}:{args.port}", flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
