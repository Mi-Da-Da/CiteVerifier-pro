import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, FileType, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";
import { apiClient, type PdfBatchSearchResult } from "@/lib/api-client";

export const Route = createFileRoute("/advanced-search")({
  component: BatchSearchPage,
  head: () => ({
    meta: [
      { title: "Batch Search — GhostCite" },
      { name: "description", content: "Verify many citations at once." },
    ],
  }),
});

function BatchSearchPage() {
  const t = useT();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [batchItems, setBatchItems] = useState<PdfBatchSearchResult["items"]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const placeholder = t({
    zh: "粘贴 DOI、专利号、SRID 或论文标题，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。",
    en: "Paste DOIs, patent numbers, SRIDs or titles. Separate with newline, comma, semicolon. Up to 1000 per batch.",
  });

  const submit = () => {
    const first = value
      .split(/[\n,，;；、]/)
      .map(s => s.trim())
      .find(Boolean);
    if (first) navigate({ to: "/detect", search: { title: first } });
  };

  const importPdf = async (files: FileList | File[] | undefined) => {
    setMessage("");
    setError("");
    setBatchItems([]);

    const pdfFiles = Array.from(files || []);
    if (!pdfFiles.length) {
      setError(t({ zh: "请选择 PDF 文件。", en: "Please choose a PDF file." }));
      return;
    }
    const invalid = pdfFiles.find(file => !file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf");
    if (invalid) {
      setError(t({ zh: "只支持 PDF 文件。", en: "Only PDF files are supported." }));
      return;
    }

    setIsImportingPdf(true);
    setMessage(t({
      zh: "正在解析 {count} 个 PDF…",
      en: "Parsing {count} PDF files…",
    }, { count: pdfFiles.length }));

    try {
      const data = await apiClient.searchPdfBatch(pdfFiles);
      setBatchItems(data.items || []);
      const titles = (data.references || [])
        .map(ref => ref.title)
        .filter((title): title is string => Boolean(title && title.trim()));

      if (!titles.length) {
        setMessage("");
        setError(t({ zh: "没有从 PDF 中提取到可检索标题。", en: "No searchable titles were extracted from the PDF." }));
        return;
      }

      setValue(prev => {
        const existing = prev.trim();
        const existingKeys = new Set(
          existing
            .split(/[\n,，;；、]/)
            .map(item => item.trim().toLowerCase())
            .filter(Boolean)
        );
        const imported = titles
          .filter(title => {
            const key = title.trim().toLowerCase();
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          })
          .join("\n");
        if (!imported) return existing;
        return existing ? `${existing}\n${imported}` : imported;
      });
      setMessage(t({
        zh: "PDF 批量导入完成：{files} 个文件共提取到 {count} 条标题。",
        en: "PDF batch import complete: extracted {count} titles from {files} files.",
      }, { files: pdfFiles.length, count: titles.length }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessage("");
      setError(t({
        zh: "PDF 导入失败：{message}",
        en: "PDF import failed: {message}",
      }, { message: detail }));
    } finally {
      setIsImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      <SiteBackdrop />
      <SiteNav />

      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-16 pb-24">
        <div className="max-w-5xl mx-auto">
          <h1
            className="animate-blur-fade-up text-4xl md:text-5xl font-normal mb-3 text-center"
            style={{ letterSpacing: "-0.04em" }}
          >
            {t({ zh: "批量检索", en: "Batch search" })}
          </h1>
          <p
            className="animate-blur-fade-up text-sm md:text-base text-gray-400 mb-10 text-center"
            style={{ animationDelay: "100ms" }}
          >
            {t({ zh: "一次粘贴。批量核验。", en: "Paste once. Verify in bulk." })}
          </p>

          <div
            className="animate-blur-fade-up liquid-glass rounded-3xl p-5 md:p-8"
            style={{ animationDelay: "200ms" }}
          >
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full min-h-[260px] md:min-h-[320px] bg-transparent outline-none resize-y text-sm leading-relaxed placeholder:text-gray-500 p-3"
            />

            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={event => void importPdf(event.target.files || undefined)}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-200 liquid-glass rounded-full px-4 py-2 hover:bg-white/10 transition-colors"
                >
                  <FileSpreadsheet size={14} /> {t({ zh: "导入Excel", en: "Import Excel" })}
                </button>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isImportingPdf}
                  className="flex items-center gap-2 text-sm text-gray-200 liquid-glass rounded-full px-4 py-2 hover:bg-white/10 transition-colors"
                >
                  {isImportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  {t({ zh: "导入PDF", en: "Import PDF" })}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-200 liquid-glass rounded-full px-4 py-2 hover:bg-white/10 transition-colors"
                >
                  <FileType size={14} /> {t({ zh: "导入CSV", en: "Import CSV" })}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  className="bg-white text-black rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t({ zh: "直接检索", en: "Search" })}
                </button>
              </div>
            </div>

            {(message || error) && (
              <p className={`mt-4 text-sm ${error ? "text-red-400" : "text-gray-300"}`}>
                {error || message}
              </p>
            )}
          </div>

          {batchItems.length > 0 && (
            <div className="mt-6 liquid-glass rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">
                  {t({ zh: "批量导入结果", en: "Batch import results" })}
                </h2>
                <span className="text-xs text-gray-400">
                  {t({ zh: "共 {count} 条", en: "{count} items" }, { count: batchItems.length })}
                </span>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-xs text-gray-400">
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-4">{t({ zh: "序号", en: "#" })}</th>
                      <th className="py-2 pr-4">{t({ zh: "来源 PDF", en: "Source PDF" })}</th>
                      <th className="py-2 pr-4">{t({ zh: "提取标题", en: "Extracted title" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map(item => (
                      <tr key={`${item.index}-${item.source_file}-${item.query_title}`} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-4 text-gray-400 tabular-nums">{item.index}</td>
                        <td className="py-3 pr-4 text-gray-300">{item.source_file || "-"}</td>
                        <td className="py-3 pr-4">{item.query_title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
