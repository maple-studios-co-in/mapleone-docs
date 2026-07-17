# AI catalog parsing (standalone quotations app)

Traced from `maple-quotations/app/catalog-import.tsx`, `app/api/ai/parse-catalog/route.ts`, `src/lib/catalog-parse.ts`, `src/lib/pdf-images.ts`, `src/lib/settings.ts`, and `app/api/products/bulk/route.ts`. (In the standalone repo the route imports these as `@maple/core/lib/*`, but tsconfig paths alias that to `./src/lib/*`.) The user uploads a rates PDF (scanned, handwritten rates) plus an optional clean client PDF used only for photo crops; both are capped at 22MB because base64 inflation must stay under the API's 32MB request limit. The model and key come from `getSetting()` — encrypted `AppSetting` row first, then env var, then default `claude-fable-5` — and Fable 5 requests opt into the server-side fallback beta so a refusal by the primary model is transparently re-served by `claude-opus-4-8`.

```mermaid
sequenceDiagram
    participant B as Browser (catalog-import.tsx)
    participant R as POST /api/ai/parse-catalog (route.ts)
    participant CP as catalog-parse.ts
    participant ST as settings.ts (getSetting)
    participant P as Postgres
    participant AN as Anthropic API
    participant PI as pdf-images.ts (pdf-to-img + sharp)
    participant PB as POST /api/products/bulk

    B->>R: FormData: file (rates PDF) + optional imagesFile (clean PDF)
    alt rates PDF over 22MB
        R-->>B: 413 "PDF is larger than 22MB. Split it and try again."
    else size OK
        R->>CP: parseCatalogPdf(base64 of rates PDF)
        CP->>ST: getSetting("anthropicApiKey") + getSetting("aiParseModel")
        ST->>P: appSetting.findUnique — AES-256-GCM decrypt if secret
        P-->>ST: row (or fall through to env var, then default)
        ST-->>CP: apiKey, model (default claude-fable-5)
        CP->>AN: beta.messages.stream — PDF document block, json_schema output, fallbacks: claude-opus-4-8
        AN-->>CP: streamed finalMessage
        alt stop_reason refusal or max_tokens
            CP-->>R: CatalogParseError 502 (decline / "split the PDF")
            R-->>B: 502 {error}
        else structured JSON returned
            CP-->>R: {catalog rooms/items, model, usage}
            opt clean PDF provided
                R->>CP: locateItemPhotos(clean PDF base64, catalog)
                CP->>AN: second pass — locate each item's photo box
                AN-->>CP: photo bounding boxes (page + percent coords)
            end
            R->>PI: cropItemPhotos(pdfBuffer, boxes)
            PI->>PI: render pages at 2x, sharp extract + resize to 360px JPEG data URLs
            PI-->>R: imageUrl per item (failures degrade to no image, never a failed parse)
            R-->>B: 200 {catalog, model, usage, imagesFrom}
            B->>B: review screen — user fixes rates, low-confidence rows flagged
            B->>B: confirmImport() — onImport(rooms) adds items to the quote
            B--)PB: fire-and-forget POST {items} (never blocks the import)
            PB->>P: dedupe by name+spec, product.create/update (source "ai-import")
            PB-->>B: {created, updated, skipped}
        end
    end
```
