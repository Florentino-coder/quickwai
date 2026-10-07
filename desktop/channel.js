// Lets the app send a command to the extension. The extension can call the app but not the other way,
// so it keeps one request open (a long poll) and a command is the answer to that request.
function createChannel({ holdMs = 20000 } = {}) {
  const waiters = new Set();
  const pending = new Map();
  let queued = [];
  let seq = 0;

  // reply(payload) answers the open request. Returns a function to call when the request closes.
  function wait(reply) {
    const now = Date.now();
    queued = queued.filter((entry) => entry.expires > now);
    if (queued.length) {
      reply(queued.shift().payload);
      return () => {};
    }
    const done = (payload) => {
      clearTimeout(timer);
      if (waiters.delete(done)) reply(payload);
    };
    const timer = setTimeout(() => done({}), holdMs);
    waiters.add(done);
    return () => {
      clearTimeout(timer);
      waiters.delete(done);
    };
  }

  // Resolves true when the extension confirms the command in time, else false.
  function send(command, timeoutMs) {
    const payload = { ...command, n: ++seq };
    return new Promise((resolve) => {
      const finish = (ok) => {
        clearTimeout(timer);
        pending.delete(payload.n);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      pending.set(payload.n, () => finish(true));
      // Between two polls no request is open; the next poll then picks the command up.
      if (waiters.size) for (const done of [...waiters]) done(payload);
      else queued.push({ payload, expires: Date.now() + timeoutMs });
    });
  }

  function ack(n, ok) {
    if (ok) pending.get(n)?.();
  }

  return { wait, send, ack };
}

module.exports = { createChannel };
