import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { extractReferencesFromPdfs } from "@/lib/server/pdf-import";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/parse/pdf")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const form = await request.formData();
        const files = form.getAll("files").filter((item): item is File => item instanceof File);
        const legacyFile = form.get("file");
        if (legacyFile instanceof File) files.push(legacyFile);

        if (!files.length) {
          return json({ success: false, error: "At least one PDF file is required." }, 400);
        }

        try {
          const references = await extractReferencesFromPdfs(files);
          const titles = references.map(ref => ref.title).filter(Boolean);
          return json({ success: true, file_count: files.length, references, titles });
        } catch (error) {
          return json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to parse PDF.",
          }, 500);
        }
      },
    },
  },
});
