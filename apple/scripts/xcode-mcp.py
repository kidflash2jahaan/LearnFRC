#!/usr/bin/env python3
"""Call Xcode's own MCP tools (build, build log, SwiftUI preview renders, Apple docs search)
from the command line, through `xcrun mcpbridge`.

    python3 apple/scripts/xcode-mcp.py list                  # the tools this Xcode offers, with their arguments
    python3 apple/scripts/xcode-mcp.py call <tool> '<json>'  # call one, print the result

Xcode has to be running with apple/LearnFRC.xcodeproj open, and the first connection may ask
the owner to allow it in Xcode. Image results (preview renders) are saved as PNGs next to
apple/.build/previews/ and their paths printed, so an agent can open them with its Read tool.
"""
import base64, json, os, subprocess, sys, time, threading

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "..", ".build", "previews")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("list", "call"):
        print(__doc__); sys.exit(2)
    p = subprocess.Popen(["xcrun", "mcpbridge"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1)
    lines, ids = [], iter(range(1, 10**6))

    def reader():
        for line in p.stdout:
            lines.append(line)
    threading.Thread(target=reader, daemon=True).start()

    def request(method, params, timeout):
        rid = next(ids)
        p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": rid, "method": method, "params": params}) + "\n")
        p.stdin.flush()
        end = time.time() + timeout
        while time.time() < end:
            for i, line in enumerate(lines):
                try:
                    msg = json.loads(line)
                except ValueError:
                    continue
                if msg.get("id") == rid:
                    lines.pop(i)
                    return msg
            time.sleep(0.05)
        err = p.stderr.read() if p.poll() is not None else ""
        raise SystemExit(f"timed out waiting for {method} after {timeout}s {err[:500]}")

    init = request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                  "clientInfo": {"name": "learnfrc-xcode-mcp", "version": "1.0"}}, 120)
    if "error" in init:
        raise SystemExit(json.dumps(init["error"]))
    p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"); p.stdin.flush()

    if sys.argv[1] == "list":
        res = request("tools/list", {}, 120).get("result", {})
        for t in res.get("tools", []):
            props = (t.get("inputSchema") or {}).get("properties", {})
            req = (t.get("inputSchema") or {}).get("required", [])
            args = ", ".join(f"{k}{'*' if k in req else ''}" for k in props)
            print(f"- {t['name']}({args}): {(t.get('description') or '').strip().splitlines()[0][:160]}")
    else:
        tool = sys.argv[2]
        args = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        res = request("tools/call", {"name": tool, "arguments": args}, 900)
        if "error" in res:
            print(json.dumps(res["error"], indent=1)); sys.exit(1)
        os.makedirs(SHOTS, exist_ok=True)
        for n, c in enumerate(res.get("result", {}).get("content", [])):
            if c.get("type") == "text":
                print(c["text"])
            elif c.get("type") == "image":
                ext = (c.get("mimeType") or "image/png").split("/")[-1]
                path = os.path.abspath(os.path.join(SHOTS, f"{tool}-{int(time.time())}-{n}.{ext}"))
                open(path, "wb").write(base64.b64decode(c["data"]))
                print(f"[image saved] {path}")
            else:
                print(json.dumps(c)[:2000])
        sc = res.get("result", {}).get("structuredContent")
        if sc is not None:
            print(json.dumps(sc, indent=1)[:20000])
    p.terminate()


if __name__ == "__main__":
    main()
