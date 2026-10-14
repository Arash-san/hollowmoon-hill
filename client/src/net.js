// WebSocket client with automatic reconnect and a server clock estimate.
export class Net {
  constructor(url) {
    this.url = url;
    this.handlers = new Map();
    this.queue = [];
    this.offset = 0; // serverTime - localTime (seconds)
    this.rtt = 0.1;
    this.connected = false;
    this.closedByServer = false;
  }

  on(type, fn) {
    this.handlers.set(type, fn);
  }

  connect() {
    const ws = (this.ws = new WebSocket(this.url));
    ws.onopen = () => {
      this.connected = true;
      this.handlers.get('open')?.();
      for (const m of this.queue.splice(0)) this.send(m);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    };
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.t === 'pong') {
        const now = performance.now();
        const rtt = (now - m.c) / 1000;
        this.rtt = this.rtt * 0.8 + rtt * 0.2;
        const est = m.time + rtt / 2 - now / 1000;
        this.offset = this.offsetSet ? this.offset * 0.85 + est * 0.15 : est;
        this.offsetSet = true;
        return;
      }
      if (m.time !== undefined && !this.offsetSet && (m.t === 'welcome' || m.t === 'tick')) {
        this.offset = m.time - performance.now() / 1000;
        this.offsetSet = true;
      }
      const h = this.handlers.get(m.t);
      if (h) h(m);
    };
    ws.onclose = (ev) => {
      this.connected = false;
      clearInterval(this.pingTimer);
      this.handlers.get('close')?.(ev);
      if (ev.code === 4000) return; // opened in another tab
      setTimeout(() => this.connect(), 1500);
    };
  }

  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'move' && m.t !== 'ping') this.queue.push(m);
  }

  serverTime() {
    return performance.now() / 1000 + this.offset;
  }
}
