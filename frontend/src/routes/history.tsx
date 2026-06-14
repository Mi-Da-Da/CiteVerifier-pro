import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, ChevronRight, Download, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "History — GhostCite" },
      { name: "description", content: "Your batch search history." },
    ],
  }),
});

interface BatchRun {
  id: number;
  total_input: number;
  total_processed: number;
  found_count: number;
  max_candidates: number;
  duration_ms: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface RunDetail {
  run: BatchRun;
  items: Array<{
    item_index: number;
    query_title: string;
    found: number;
    dblp_title: string | null;
    dblp_title_similarity: number | null;
    year: string | null;
    venue: string | null;
    duration_ms: number;
  }>;
}

function HistoryPage() {
  const t = useT();
  const [runs, setRuns] = useState<BatchRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/history/batch?limit=20&offset=0")
      .then(r => r.json())
      .then(data => {
        setRuns(data.runs || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadDetail = async (run: BatchRun) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/history/batch/${run.id}/items`);
      const data = await res.json();
      setSelected(data);
    } catch {}
    finally { setDetailLoading(false); }
  };

  const fmtDuration = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  const fmtDate = (s: string) => s.replace("T", " ").slice(0, 19);

  const statusIcon = (s: string) =>
    s === "completed" ? <CheckCircle2 size={14} className="text-emerald-400" />
    : s === "running" ? <Clock size={14} className="text-amber-400" />
    : <XCircle size={14} className="text-rose-400" />;

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      <SiteBackdrop />
      <SiteNav />

      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-8 md:pt-16 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-normal mb-1" style={{ letterSpacing: "-0.03em" }}>
                {t({ zh: "历史记录", en: "History" })}
              </h1>
              <p className="text-sm text-gray-400">
                {t({ zh: `共 ${total} 次批量检索记录`, en: `${total} batch search runs` })}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-20">{t({ zh: "加载中…", en: "Loading…" })}</div>
          ) : runs.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-12 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-4 opacity-40" />
              <p>{t({ zh: "暂无历史记录。先去做一次批量检索吧。", en: "No history yet. Try a batch search first." })}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* 列表 */}
              <div className="lg:col-span-2 space-y-3">
                {runs.map(run => (
                  <button key={run.id} onClick={() => loadDetail(run)}
                    className={`w-full text-left liquid-glass rounded-2xl p-4 hover:bg-white/5 transition-colors ${selected?.run.id === run.id ? "ring-1 ring-white/30" : ""}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {statusIcon(run.status)}
                        <span>Run #{run.id}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-500" />
                    </div>
                    <div className="text-sm font-medium mb-1">
                      {t({ zh: `${run.total_input} 条标题`, en: `${run.total_input} titles` })}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="text-emerald-400">{run.found_count} {t({ zh: "找到", en: "found" })}</span>
                      <span>·</span>
                      <span>{fmtDuration(run.duration_ms ?? 0)}</span>
                      <span>·</span>
                      <span>{fmtDate(run.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* 详情 */}
              <div className="lg:col-span-3">
                {detailLoading ? (
                  <div className="liquid-glass rounded-3xl p-8 text-center text-gray-400">{t({ zh: "加载中…", en: "Loading…" })}</div>
                ) : selected ? (
                  <div className="liquid-glass rounded-3xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                      <div>
                        <div className="text-sm font-medium">Run #{selected.run.id}</div>
                        <div className="text-xs text-gray-400">{fmtDate(selected.run.created_at)}</div>
                      </div>
                      <a href={`/api/history/batch/${selected.run.id}/csv`} target="_blank"
                        className="flex items-center gap-1.5 text-xs liquid-glass rounded-full px-4 py-1.5 hover:bg-white/10 transition-colors">
                        <Download size={13} /> {t({ zh: "导出 CSV", en: "Export CSV" })}
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-white/5">
                      {[
                        { label: t({ zh: "总计", en: "Total" }), value: selected.run.total_processed },
                        { label: t({ zh: "已找到", en: "Found" }), value: selected.run.found_count, color: "text-emerald-300" },
                        { label: t({ zh: "未找到", en: "Not found" }), value: selected.run.total_processed - selected.run.found_count, color: "text-rose-300" },
                      ].map(c => (
                        <div key={c.label} className="bg-black/40 p-4 text-center">
                          <div className={`text-xl font-medium tabular-nums ${c.color ?? ""}`}>{c.value}</div>
                          <div className="text-xs text-gray-400 mt-1">{c.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-auto max-h-[480px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-gray-400 text-xs sticky top-0 bg-black/80 backdrop-blur">
                            <th className="text-left px-4 py-3 w-8">#</th>
                            <th className="text-left px-4 py-3">{t({ zh: "查询标题", en: "Query title" })}</th>
                            <th className="text-right px-4 py-3 w-20">{t({ zh: "相似度", en: "Sim." })}</th>
                            <th className="text-right px-4 py-3 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.items.map(item => {
                            const simPct = item.dblp_title_similarity != null ? Math.round(item.dblp_title_similarity * 100) : null;
                            const simColor = simPct == null ? "text-gray-400" : simPct >= 80 ? "text-emerald-300" : simPct >= 50 ? "text-amber-300" : "text-rose-300";
                            return (
                              <tr key={item.item_index} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                                <td className="px-4 py-2.5 text-gray-500 tabular-nums text-xs">{item.item_index}</td>
                                <td className="px-4 py-2.5">
                                  <div className="text-xs text-gray-200 truncate max-w-[220px]">{item.query_title}</div>
                                  {item.dblp_title && <div className="text-xs text-gray-500 truncate max-w-[220px]">{item.dblp_title}</div>}
                                </td>
                                <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${simColor}`}>
                                  {simPct != null ? `${simPct}%` : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {item.found
                                    ? <CheckCircle2 size={13} className="inline text-emerald-400" />
                                    : <AlertTriangle size={13} className="inline text-rose-400" />}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="liquid-glass rounded-3xl p-8 text-center text-gray-400">
                    <ChevronRight size={24} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t({ zh: "点击左侧记录查看详情", en: "Select a run to see details" })}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
