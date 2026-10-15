#!/usr/bin/env python3
"""Expose the vLLM container (address in ./endpoint) on the tailnet at <tailscale ip>:8850. Plain TCP relay."""
import asyncio
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = subprocess.check_output(['ip', '-4', '-o', 'addr', 'show', 'tailscale0'], text=True).split()[3].split('/')[0]


async def pipe(r, w):
    try:
        while data := await r.read(65536):
            w.write(data)
            await w.drain()
    except Exception:
        pass
    finally:
        w.close()


async def handle(cr, cw):
    try:
        target = open(os.path.join(HERE, 'endpoint')).read().strip()
        ur, uw = await asyncio.wait_for(asyncio.open_connection(target, 8850), 3)
    except Exception:
        cw.close()
        return
    await asyncio.gather(pipe(cr, uw), pipe(ur, cw))


async def main():
    server = await asyncio.start_server(handle, HOST, 8850)
    async with server:
        await server.serve_forever()

asyncio.run(main())
