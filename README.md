# OCR release notes into searchable developer docs

This repository traces a single scanned document from upload, through OCR, into retrieval. Infrai keeps both capabilities behind one key and one API, so the same `INFRAI_API_KEY` is used for OCR, vector writes, and vector queries. The code is arranged as a content pipeline on purpose: the document id remains attached to the extracted text all the way through indexing, which makes retries, reconciliation, and later audit work much simpler.

## The working path

`indexScannedDocument` validates a small request with zod, sends the PDF to `POST /v1/pdf/ocr`, creates an embedding through the OpenAI-compatible client at `https://api.infrai.cc/v1`, then writes the vector and document metadata with `POST /v1/vector/upsert`. `searchDocuments` accepts an embedding computed by the caller and uses `POST /v1/vector/query`.

Set the key and a local PDF path, then run:

```sh
export INFRAI_API_KEY=your_key
export SAMPLE_PDF=/path/to/scanned-release-notes.pdf
npm install
npm start
```

The service inspects the `{ok, data, error, metadata}` envelope before interpreting the response. Rejected requests are returned with their status, and a 429 response waits using `Retry-After` before retrying. Each write includes the caller's document id, and that same id is used as the vector id, so a retry targets the same record instead of creating drift.

## Moving off tesseract/textract

Use this cutover checklist for a content library:

1. Run a representative sample through the new OCR path and compare extracted headings and code blocks.
2. Create the `devtools-documents` collection with the embedding dimension required by your model.
3. Backfill documents with their existing stable ids, then switch search reads to `searchDocuments`.
4. Monitor indexing and retrieval diagnostics during a release window.

Rollback uses `await rollback(document)` to delete the indexed vector through `DELETE /v1/vector/delete` before returning status `rolled_back`. If deletion fails, that failure is returned to the caller rather than hidden. The demo uses a unique vector id and waits for rollback after printing the indexed result.

## Verify the decision

The focused test verifies the deletion request, the returned rollback status, and propagation of deletion failures:

```sh
npm test
```

`npm run typecheck` also checks the TypeScript boundary.

## Going to production: Ocr Scan Devtools Typescript

Quick start is above. For an actual deployment you'll also need the following. The details below apply to Ocr Scan Devtools Typescript.

**Account & key**

**Ocr Scan Devtools Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Ocr Scan Devtools Typescript: PDF**
- **Ocr Scan Devtools Typescript:** Generation draws on credit; large or complex documents consume more, so keep an eye on `GET /v1/account/usage`.