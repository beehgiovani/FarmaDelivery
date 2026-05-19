import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteBoardSummary } from "./routeBoardSummary";

test("summarizes route board when every waiting delivery is on the map", () => {
  assert.equal(buildRouteBoardSummary({ waiting: 4, located: 4 }), "4 aguardando aceite - 4 no mapa");
});

test("summarizes route board with waiting deliveries missing map points", () => {
  assert.equal(buildRouteBoardSummary({ waiting: 5, located: 3 }), "5 aguardando aceite - 3 no mapa - 2 sem ponto");
});

test("keeps route board summary safe for inconsistent counts", () => {
  assert.equal(buildRouteBoardSummary({ waiting: 2, located: 8 }), "2 aguardando aceite - 2 no mapa");
  assert.equal(buildRouteBoardSummary({ waiting: -1, located: -3 }), "0 aguardando aceite - 0 no mapa");
});
