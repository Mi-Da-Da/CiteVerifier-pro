import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { FileText, Upload, X, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/advanced-search")({
  component: BatchSearchPage,
  head: () => ({
    meta: [
      { title: "Batch Search — GhostCite" },
      { name: "description", content: "Verify many citations at once." },
    ],
  }),
});

type TabKey = "titles" | "pdf" | "csv";

type BatchResultItem = {
  index: number;
  found: boolean;
  query_title: string;
  dblp_title?: string;
  dblp_title_similarity?: number;
  year?: string | number;
  venue?: string;
  source_file?: string;
  error_message?: string;
};

type BatchSummary = {
  run_id?: string | null;
  total_input: number;
  total_processed: number;
  found_count: number;
  not_found_count: number;
  duration_ms: number;
};

type ProgressState = {
  status: "idle" | "parsing" | "searching" | "done" | "error";
  stage: string;
  total: number;
  processed: number;
  found: number;
};

function BatchSearchPage() {
  const t = useT();
  const [tab, setTab] = useState<TabKey>("titles");
  const [lang, setLang] = useState<"zh" | "en">("zh");

  // 批量标题
  const [titlesValue, setTitlesValue] = useState("");

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // 结果
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [items, setItems] = useState<BatchResultItem[]>([]);

  // 进度
  const [progress, setProgress] = useState<ProgressState>({
    status: "idle", stage: "", total: 0, processed: 0, found: 0,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [errMsg, setErrMsg] = useState("");

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/progress");
        const data: ProgressState = await res.json();
        setProgress(data);
        if (data.status === "done" || data.status === "error") stopPolling();
      } catch {}
    }, 300);
  };

  // 进度条
  const progressPct = () => {
    if (progress.status === "parsing") return 20;
    if (progress.status === "searching" && progress.total > 0)
      return 20 + Math.round((progress.processed / progress.total) * 80);
    if (progress.status === "done" || progress.status === "error") return 100;
    return 0;
  };

  const barColor =
    progress.status === "done" ? "bg-emerald-400"
    : progress.status === "error" ? "bg-rose-400"
    : progress.status === "parsing" ? "bg-amber-400 animate-pulse"
    : "bg-white";

  const progressLabel = () => {
    if (progress.status === "parsing")
      return t({ zh: "第 1 步：LLM 解析 PDF 参考文献…", en: "Step 1: Parsing PDF references with LLM…" });
    if (progress.status === "searching")
      return t({ zh: `第 2 步：搜索 DBLP：${progress.processed} / ${progress.total}（已匹配 ${progress.found}）`, en: `Step 2: Searching DBLP: ${progress.processed} / ${progress.total} (found ${progress.found})` });
    if (progress.status === "done")
      return t({ zh: `完成 — 共处理 ${progress.processed} 条，匹配 ${progress.found} 条`, en: `Done — ${progress.processed} processed, ${progress.found} matched` });
    if (progress.status === "error")
      return t({ zh: `出错：${progress.stage}`, en: `Error: ${progress.stage}` });
    return "";
  };

  // ── 批量标题搜索 ──────────────────────────────────────────────
  const runTitleBatch = async () => {
    const lines = titlesValue
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setErrMsg(t({ zh: "请输入至少一个标题。", en: "Enter at least one title." }));
      return;
    }
    setErrMsg("");
    setSummary(null);
    setItems([]);
    setProgress({ status: "searching", stage: "Searching DBLP", total: lines.length, processed: 0, found: 0 });
    startPolling();
    try {
      const res = await fetch("/api/search/title/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: lines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.detail || t({ zh: "请求失败。", en: "Request failed." }));
        setProgress(p => ({ ...p, status: "error" }));
        return;
      }
      setSummary(data.summary);
      setItems(data.items);
      setProgress(p => ({ ...p, status: "done", processed: data.summary.total_processed, found: data.summary.found_count }));
    } catch {
      setErrMsg(t({ zh: "网络错误，请稍后重试。", en: "Network error. Please try again." }));
      setProgress(p => ({ ...p, status: "error" }));
    } finally {
      stopPolling();
    }
  };

  // ── PDF 批量搜索 ──────────────────────────────────────────────
  const runPdfBatch = async () => {
    if (!pdfFile) {
      setErrMsg(t({ zh: "请先选择 PDF 文件。", en: "Please select a PDF file first." }));
      return;
    }
    setErrMsg("");
    setSummary(null);
    setItems([]);
    setProgress({ status: "parsing", stage: "Parsing PDF", total: 0, processed: 0, found: 0 });
    startPolling();

    const formData = new FormData();
    // 后端接收字段名为 files（复数）
    formData.append("files", pdfFile);

    try {
      const res = await fetch("/api/search/pdf/batch", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.detail || t({ zh: "请求失败。", en: "Request failed." }));
        setProgress(p => ({ ...p, status: "error" }));
        return;
      }
      setSummary(data.summary);
      setItems(data.items);
      setProgress(p => ({ ...p, status: "done", processed: data.summary.total_processed, found: data.summary.found_count }));
    } catch {
      setErrMsg(t({ zh: "网络错误，请稍后重试。", en: "Network error. Please try again." }));
      setProgress(p => ({ ...p, status: "error" }));
    } finally {
      stopPolling();
    }
  };

  // ── CSV 批量搜索 ──────────────────────────────────────────────
  const runCsvBatch = async () => {
    if (!csvFile) {
      setErrMsg(t({ zh: "请先选择 CSV 文件。", en: "Please select a CSV file first." }));
      return;
    }

    setErrMsg("");
    setSummary(null);
    setItems([]);
    setProgress({ status: "searching", stage: "Uploading CSV", total: 0, processed: 0, found: 0 });
    startPolling();

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await fetch("/api/search/csv/batch", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.detail || t({ zh: "请求失败。", en: "Request failed." }));
        setProgress(p => ({ ...p, status: "error" }));
        return;
      }
      setSummary(data.summary);
      setItems(data.items);
      setProgress(p => ({ ...p, status: "done", processed: data.summary.total_processed, found: data.summary.found_count }));
    } catch {
      setErrMsg(t({ zh: "CSV 上传或网络错误。", en: "CSV upload or network error." }));
      setProgress(p => ({ ...p, status: "error" }));
    } finally {
      stopPolling();
    }
  };

  const isRunning = progress.status === "parsing" || progress.status === "searching";

  // ── CSV 导出 ──────────────────────────────────────────────────
  const downloadCsv = () => {
    if (!items.length) return;
    if (summary?.run_id) {
      window.open(`/api/history/batch/${summary.run_id}/csv`, "_blank");
      return;
    }
    const header = "index,query_title,found,dblp_title,similarity,year,venue\n";
    const rows = items.map(it =>
      [
        it.index,
        `"${(it.query_title || "").replace(/"/g, '""')}"`,
        it.found ? 1 : 0,
        `"${(it.dblp_title || "").replace(/"/g, '""')}"`,
        it.dblp_title_similarity != null ? Math.round(it.dblp_title_similarity * 100) : "",
        it.year ?? "",
        it.venue ?? "",
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "citeverifier_results.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col">
      <SiteBackdrop />
      <SiteNav />

      <section className="relative z-10 flex min-h-[calc(100vh-88px)] items-center px-4 sm:px-6 md:px-12 py-12 md:py-16">
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
            {t({ zh: "粘贴标题列表，或上传 PDF 自动提取参考文献。", en: "Paste a list of titles, or upload a PDF to extract references automatically." })}
          </p>

          <div
            className="animate-blur-fade-up flex justify-center mb-8"
            style={{ animationDelay: "150ms" }}
          >
            <div className="liquid-glass rounded-full p-1 inline-flex gap-1" role="tablist">
              {([
                { key: "zh", label: t({ zh: "中文文献", en: "Chinese Literature" }) },
                { key: "en", label: t({ zh: "英文文献", en: "English Literature" }) },
              ] as { key: "zh" | "en"; label: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLang(opt.key)}
                  className={`px-5 py-2 rounded-full text-sm transition-colors ${
                    lang === opt.key
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="animate-blur-fade-up liquid-glass rounded-3xl p-5 md:p-8"
            style={{ animationDelay: "200ms" }}
          >
            {/* Tab 切换 */}
            <div className="flex gap-1 border-b border-white/10 mb-5">
              {([
                { key: "titles", label: t({ zh: "标题列表", en: "Title List" }) },
                { key: "pdf", label: t({ zh: "上传 PDF", en: "Upload PDF" }) },
                { key: "csv", label: t({ zh: "上传 CSV", en: "Upload CSV" }) },
              ] as { key: TabKey; label: string }[]).map(tb => (
                <button
                  key={tb.key}
                  onClick={() => { setTab(tb.key); setErrMsg(""); }}
                  className={`relative px-5 py-3 text-sm transition-colors ${
                    tab === tb.key ? "text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {tb.label}
                  {tab === tb.key && (
                    <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* 标题列表 tab */}
            {tab === "titles" && (
              <>
                <textarea
                  value={titlesValue}
                  onChange={e => setTitlesValue(e.target.value)}
                  placeholder={t({ zh: "每行一个论文标题…", en: "One paper title per line…" })}
                  className="w-full min-h-[240px] bg-transparent outline-none resize-y text-sm leading-relaxed placeholder:text-gray-500 p-3"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={runTitleBatch}
                    disabled={isRunning}
                    className="bg-white text-black rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRunning ? t({ zh: "检索中…", en: "Searching…" }) : t({ zh: "开始检索", en: "Search" })}
                  </button>
                </div>
              </>
            )}

            {/* PDF tab */}
            {tab === "pdf" && (
              <>
                <div
                  onClick={() => !pdfFile && pdfInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f?.name.toLowerCase().endsWith(".pdf")) setPdfFile(f);
                  }}
                  className={`min-h-[200px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
                    pdfFile ? "border-white/20" : "border-white/10 cursor-pointer hover:border-white/30"
                  }`}
                >
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setPdfFile(f);
                    }}
                  />
                  {pdfFile ? (
                    <div className="flex items-center gap-3 p-4">
                      <FileText size={24} className="text-gray-300" />
                      <div>
                        <div className="text-sm font-medium">{pdfFile.name}</div>
                        <div className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setPdfFile(null);
                          setSummary(null);
                          setItems([]);
                          setProgress({ status: "idle", stage: "", total: 0, processed: 0, found: 0 });
                        }}
                        className="ml-2 text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Upload size={28} />
                      <span className="text-sm">{t({ zh: "点击或拖拽上传 PDF 文件", en: "Click or drag to upload a PDF" })}</span>
                      <span className="text-xs">{t({ zh: "系统将自动提取参考文献并逐条核验", en: "References will be extracted and verified automatically" })}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={runPdfBatch}
                    disabled={isRunning || !pdfFile}
                    className="bg-white text-black rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRunning ? t({ zh: "处理中…", en: "Processing…" }) : t({ zh: "开始检测", en: "Run" })}
                  </button>
                </div>
              </>
            )}

            {/* CSV tab */}
            {tab === "csv" && (
              <>
                <div
                  onClick={() => !csvFile && csvInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f?.name.toLowerCase().endsWith(".csv")) setCsvFile(f);
                  }}
                  className={`min-h-[200px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
                    csvFile ? "border-white/20" : "border-white/10 cursor-pointer hover:border-white/30"
                  }`}
                >
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setCsvFile(f);
                    }}
                  />
                  {csvFile ? (
                    <div className="flex items-center gap-3 p-4">
                      <FileText size={24} className="text-gray-300" />
                      <div>
                        <div className="text-sm font-medium">{csvFile.name}</div>
                        <div className="text-xs text-gray-400">{(csvFile.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setCsvFile(null);
                          setSummary(null);
                          setItems([]);
                          setProgress({ status: "idle", stage: "", total: 0, processed: 0, found: 0 });
                        }}
                        className="ml-2 text-gray-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Upload size={28} />
                      <span className="text-sm">{t({ zh: "点击或拖拽上传 CSV 文件", en: "Click or drag to upload a CSV" })}</span>
                      <span className="text-xs">{t({ zh: "系统将自动导入文献标题并逐条核验", en: "Titles will be imported and verified automatically" })}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={runCsvBatch}
                    disabled={isRunning || !csvFile}
                    className="bg-white text-black rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRunning ? t({ zh: "处理中…", en: "Processing…" }) : t({ zh: "开始检测", en: "Run" })}
                  </button>
                </div>
              </>
            )}

            {/* 进度条 */}
            {progress.status !== "idle" && (
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>{progressLabel()}</span>
                  <span className="tabular-nums">{progressPct()}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${progressPct()}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {errMsg && (
              <p className="mt-4 text-sm text-rose-400">{errMsg}</p>
            )}
          </div>

          {/* 结果汇总 */}
          {summary && (
            <div className="mt-6 animate-blur-fade-up">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: t({ zh: "总计", en: "Total" }), value: summary.total_processed, color: "text-white" },
                  { label: t({ zh: "已找到", en: "Found" }), value: summary.found_count, color: "text-emerald-300" },
                  { label: t({ zh: "未找到", en: "Not found" }), value: summary.not_found_count, color: "text-rose-300" },
                  { label: t({ zh: "耗时", en: "Duration" }), value: `${(summary.duration_ms / 1000).toFixed(1)}s`, color: "text-white" },
                ].map(c => (
                  <div key={c.label} className="liquid-glass rounded-2xl p-4 text-center">
                    <div className={`text-2xl font-medium tabular-nums mb-1 ${c.color}`}>{c.value}</div>
                    <div className="text-xs text-gray-400">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* 结果表格 */}
              {items.length > 0 && (
                <div className="liquid-glass rounded-3xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <span className="text-sm font-medium">{t({ zh: "详细结果", en: "Details" })}</span>
                    <button
                      onClick={downloadCsv}
                      className="flex items-center gap-1.5 text-xs liquid-glass rounded-full px-4 py-1.5 hover:bg-white/10 transition-colors"
                    >
                      <Download size={13} /> {t({ zh: "导出 CSV", en: "Export CSV" })}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-xs">
                          <th className="text-left px-5 py-3 w-10">#</th>
                          <th className="text-left px-5 py-3">{t({ zh: "查询标题", en: "Query title" })}</th>
                          <th className="text-left px-5 py-3">{t({ zh: "DBLP 匹配", en: "DBLP match" })}</th>
                          <th className="text-right px-5 py-3 w-24">{t({ zh: "相似度", en: "Similarity" })}</th>
                          <th className="text-right px-5 py-3 w-16">{t({ zh: "状态", en: "Status" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const sim = item.dblp_title_similarity;
                          const simPct = sim != null ? (sim * 100).toFixed(1) : null;
                          const simNum = simPct != null ? parseFloat(simPct) : null;
                        const simColor = simNum == null ? "text-gray-500"
                            : simNum >= 80 ? "text-emerald-300"
                            : simNum >= 50 ? "text-amber-300"
                            : "text-rose-300";
                          return (
                            <tr key={item.index} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                              <td className="px-5 py-3 text-gray-500 tabular-nums">{item.index}</td>
                              <td className="px-5 py-3 max-w-xs">
                                <div className="truncate text-gray-200">{item.query_title}</div>
                              </td>
                              <td className="px-5 py-3 max-w-xs">
                                {item.dblp_title
                                  ? <div className="truncate text-gray-300">{item.dblp_title}</div>
                                  : <span className="text-gray-600">—</span>}
                              </td>
                              <td className={`px-5 py-3 text-right tabular-nums ${simColor}`}>
                                {simPct != null ? `${simPct}%` : "—"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {item.found
                                  ? <CheckCircle2 size={16} className="inline text-emerald-400" />
                                  : <AlertTriangle size={16} className="inline text-rose-400" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
