import assert from "node:assert/strict";
import test from "node:test";
import { readBearerToken, requireAuth, signSessionToken, verifySessionToken, type SessionPayload } from "./auth";

test("signs and verifies a valid session token", () => {
  withSessionSecret("api-test-secret", () => {
    const payload = makePayload({ role: "ADMIN" });
    const token = signSessionToken(payload);

    assert.deepEqual(verifySessionToken(token), payload);
  });
});

test("rejects a token signed with another secret", () => {
  const payload = makePayload({ role: "GERENTE" });
  let token = "";

  withSessionSecret("first-secret", () => {
    token = signSessionToken(payload);
  });

  withSessionSecret("second-secret", () => {
    assert.equal(verifySessionToken(token), null);
  });
});

test("rejects expired tokens", () => {
  withSessionSecret("api-test-secret", () => {
    const token = signSessionToken(makePayload({ exp: Math.floor(Date.now() / 1000) - 1 }));

    assert.equal(verifySessionToken(token), null);
  });
});

test("rejects malformed tokens", () => {
  withSessionSecret("api-test-secret", () => {
    assert.equal(verifySessionToken("not-a-valid-token"), null);
    assert.equal(verifySessionToken("abc.def.ghi"), null);
  });
});

test("reads bearer token only from valid Authorization header", () => {
  assert.equal(readBearerToken("Bearer abc123"), "abc123");
  assert.equal(readBearerToken("Basic abc123"), null);
  assert.equal(readBearerToken(undefined), null);
});

test("requireAuth returns session for allowed role", async () => {
  await withSessionSecret("api-test-secret", async () => {
    const payload = makePayload({ role: "GERENTE" });
    const token = signSessionToken(payload);
    const reply = makeReply();

    const session = await requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as any,
      reply as any,
      ["ADMIN", "GERENTE"],
    );

    assert.deepEqual(session, payload);
    assert.equal(reply.statusCode, null);
    assert.equal(reply.body, null);
  });
});

test("requireAuth sends 401 without valid token", async () => {
  const reply = makeReply();

  const session = await requireAuth({ headers: {} } as any, reply as any, ["ADMIN"]);

  assert.equal(session, null);
  assert.equal(reply.statusCode, 401);
  assert.equal(reply.body?.error, "UNAUTHENTICATED");
});

test("requireAuth sends 403 for disallowed role", async () => {
  await withSessionSecret("api-test-secret", async () => {
    const token = signSessionToken(makePayload({ role: "BALCONISTA_CAIXA" }));
    const reply = makeReply();

    const session = await requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as any,
      reply as any,
      ["ADMIN"],
    );

    assert.equal(session, null);
    assert.equal(reply.statusCode, 403);
    assert.equal(reply.body?.error, "FORBIDDEN");
  });
});

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    sub: "user-1",
    role: "ADMIN",
    exp: Math.floor(Date.now() / 1000) + 60,
    storeId: null,
    courierId: null,
    ...overrides,
  };
}

async function withSessionSecret(secret: string, run: () => void | Promise<void>) {
  const previous = process.env.API_SESSION_SECRET;
  process.env.API_SESSION_SECRET = secret;
  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.API_SESSION_SECRET;
    } else {
      process.env.API_SESSION_SECRET = previous;
    }
  }
}

function makeReply() {
  return {
    statusCode: null as number | null,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: any) {
      this.body = body;
      return this;
    },
  };
}
