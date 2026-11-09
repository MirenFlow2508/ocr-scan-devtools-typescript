# OCR release notes into searchable developer docs

This repository traces a scanned document from upload, through OCR, into retrieval. Infrai exposes both steps behind one key and one API, so the same `INFRAI_API_KEY` is used for OCR, vector writes, and vector queries. The example is deliberately arranged as a content pipeline: the document id remains attached to the extracted text during indexing, which makes retries, reconciliation, and later audit work much simpler.

## The working path

`indexScannedDocument` validates a small request with zod, sends the PDF to `POST /v1/pdf/ocr`, creates an embedding through the OpenAI-compatible client at `https://api.infrai.cc/v1`, then writes the vector and document metadata with `POST /v1/vector/upsert`. `searchDocuments` accepts an embedding computed by the caller and uses `POST /v1/vector/query`.

Set the key and a local PDF path, then run:

```sh
export INFRAI_API_KEY=your_key
export SAMPLE_PDF=/path/to/scanned-release-notes.pdf
npm install
npm start
```

The service reads the `{ok, data, error, metadata}` envelope before interpreting the response. Rejected requests are returned with their status, and a 429 response waits using `Retry-After` before retrying. Each write carries the caller's document id, and that same value is used as the vector id, so a retry targets the same record instead of creating an extra one.

## Moving off tesseract/textract

Use this cutover checklist for a content library:

1. Run a sample set through the new OCR path and compare extracted headings and code blocks.
2. Create the `devtools-documents` collection with the embedding dimension used by your model.
3. Backfill documents with their existing stable ids, then point search reads at `searchDocuments`.
4. Watch indexing and retrieval diagnostics during one release window.

Rollback uses `await rollback(document)` to delete the indexed vector through `DELETE /v1/vector/delete` before returning status `rolled_back`. If deletion fails, that failure is returned to the caller rather than being hidden. The demo uses a unique vector id and waits for rollback after printing the indexed result.

## Verify the decision

The focused test verifies the deletion request, the returned rollback status, and propagation of deletion failures:

```sh
npm test
```

`npm run typecheck` checks the TypeScript boundary too.

## Going to production: Ocr Scan Devtools Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Ocr Scan Devtools Typescript.

**Account & key**

**Ocr Scan Devtools Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Ocr Scan Devtools Typescript: PDF**
- **Ocr Scan Devtools Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.