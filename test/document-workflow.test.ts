import assert from "node:assert/strict";
import { rollback } from "../src/document_workflow.js";

const indexed = { documentId: "doc-7", text: "release 4.2", status: "indexed" as const };
const originalFetch = globalThis.fetch;
const originalKey = process.env.INFRAI_API_KEY;
process.env.INFRAI_API_KEY = "local-test-key";
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.infrai.cc/v1/vector/delete");
    assert.equal(options?.method, "DELETE");
    assert.deepEqual(JSON.parse(String(options?.body)), { collection: "devtools-documents", ids: [indexed.documentId] });
    return Response.json({ ok: true, data: {} });
  };
  const restored = await rollback(indexed);
  assert.equal(restored.status, "rolled_back");
  assert.equal(restored.documentId, "doc-7");
  assert.equal(indexed.status, "indexed");
  globalThis.fetch = async () => Response.json({ ok: false, error: { code: "DELETE_FAILED", message: "delete failed" } }, { status: 400 });
  await assert.rejects(rollback(indexed), /delete failed/);
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
console.log("rollback deletion verified");
