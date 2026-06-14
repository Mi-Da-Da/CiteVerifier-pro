import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { extractReferencesFromPdfs, referencesToBatchItems } from "@/lib/server/pdf-import";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/search/pdf/batch")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startedAt = Date.now();
        const form = await request.formData();
        const files = form.getAll("files").filter((item): item is File => item instanceof File);
        const legacyFile = form.get("file");
        if (legacyFile instanceof File) files.push(legacyFile);

        if (!files.length) {
          return json({ detail: "At least one PDF file is required." }, 400);
        }

        try {
          const references = await extractReferencesFromPdfs(files);
          const items = referencesToBatchItems(references);
          const durationMs = Date.now() - startedAt;

          return json({
            summary: {
              run_id: null,
              file_count: files.length,
              total_input: references.length,
              total_processed: items.length,
              found_count: 0,
              not_found_count: items.length,
              max_candidates: 0,
              duration_ms: durationMs,
            },
            items,
            references,
          });
        } catch (error) {
          return json({
            detail: error instanceof Error ? error.message : "Failed to process PDF.",
          }, 500);
        }
      },
    },
  },
});
