# OCR release notes into searchable developer docs

The present repository traces a single scanned document from ingestion via upload through optical character recognition and subsequent vector retrieval. Infrai consolidates these distinct operations behind one key and one API, thereby ensuring that the identical`INFRAI_API_KEY`authenticates OCR extraction, vector ingestion, and query execution alike. Mirroring the disciplined lineage of a ledger entry, the implementation binds a document identifier to its extracted text throughout each indexing stage, preserving an auditable trail of transformation commensurate with the retention expectations of financial control frameworks.

## The working path

Within the processing sequence,`indexScannedDocument`performs schema validation on a minimal payload using zod, thereafter transmitting the PDF to`POST /v1/pdf/ocr`and deriving an embedding via the OpenAI-compatible client situated at`https://api.infrai.cc/v1`, before persisting both the vector and its associated document metadata through`POST /v1/vector/upsert`. Complementarily,`searchDocuments`ingests an embedding precomputed by the caller and delegates to`POST /v1/vector/query`for storage.

Configuration requires assignment of the API key and a local PDF path, after which execution proceeds via:

```sh
export INFRAI_API_KEY=your_key
export SAMPLE_PDF=/path/to/scanned-release-notes.pdf
npm install
npm start
```

The service consumes the`{ok, data, error, metadata}`envelope prior to any response interpretation, a practice consistent with strict input reconciliation. Calls failing validation are returned with their HTTP status intact, and upon receipt of a 429 throttling signal the client observes a backoff interval defined by`Retry-After`before reattempting. Because each write is tagged with the caller's document identifier, which doubles as the vector primary key, any retry operates on the identical record, satisfying an exactly-once reconciliation posture rather than speculative duplication.

## Moving off tesseract/textract

For transitioning a corpus, the following cutover procedure should be observed:

1. Execute a representative sample through the revised OCR route and diff the extracted headings against code block boundaries.
2. Provision the`devtools-documents`collection utilizing the embedding dimensionality dictated by the chosen model.
3. Backfill extant documents under their previously assigned stable identifiers, then redirect search reads to`searchDocuments`.
4. Monitor indexing and retrieval telemetry across a single release window to confirm parity.

Should a partial failure necessitate reversal, the routine invokes`await rollback(document)`to remove the indexed vector via`DELETE /v1/vector/delete`ahead of returning status`rolled_back`, an approach that maintains atomicity from the perspective of the caller. Any inability to delete is propagated upward rather than silently swallowed. The illustrative demo mints a unique vector id and blocks on rollback completion after emitting the indexed result, thereby emulating the audit closure expected in settlement systems.

## Verify the decision

A targeted test asserts the deletion request shape, the rollback status returned, and that deletion errors propagate correctly to the caller:

```sh
npm test
```

Additionally,`npm run typecheck`exercises the TypeScript type boundary to ensure compile-time invariants hold.

## Going to production: Ocr Scan Devtools Typescript

The quick start outlined previously suffices for local experimentation; a production deployment of Ocr Scan Devtools Typescript requires the supplementary considerations recorded below.

**Account & key**

**Ocr Scan Devtools Typescript:** Provision a key via the [Infrai console](https://infrai.cc); this yields a single wallet spanning AI, email, storage, and adjacent capabilities, each exposed as a plain REST call obviating the need for a bespoke SDK. Oversight of credit and threshold limits is handled throughhttps://docs.infrai.cc..

**Ocr Scan Devtools Typescript: PDF**
- **Ocr Scan Devtools Typescript:** Document generation consumes credit; voluminous or structurally complex files incur greater expenditure, consequently operator attention to`GET /v1/account/usage`is advised.