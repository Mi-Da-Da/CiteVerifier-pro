import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export type Lang = "zh" | "en" | "es" | "ar" | "fr" | "ru";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "ghostcite.lang";

const FALLBACK_LANG: Exclude<Lang, "zh" | "en">[] = ["es", "ar", "fr", "ru"];

const UI_TRANSLATIONS: Record<Exclude<Lang, "zh" | "en">, Record<string, string>> = {
  es: {
    "首页": "Inicio",
    "检索": "Búsqueda",
    "语言": "Idioma",
    "更多": "Más",
    "帮助": "Ayuda",
    "登录": "Iniciar sesión",
    "退出登录": "Cerrar sesión",
    "简单检索": "Búsqueda simple",
    "批量检索": "Búsqueda por lotes",
    "导入Excel": "Importar Excel",
    "导入PDF": "Importar PDF",
    "导入CSV": "Importar CSV",
    "直接检索": "Buscar",
    "批量导入结果": "Resultados de importación por lotes",
    "共 {count} 条": "{count} elementos",
    "序号": "#",
    "来源 PDF": "PDF de origen",
    "提取标题": "Título extraído",
    "一次粘贴。批量核验。": "Pega una vez. Verifica en lote.",
    "正在解析 PDF…": "Analizando PDF…",
    "正在解析 {count} 个 PDF…": "Analizando {count} PDF…",
    "PDF 导入完成：提取到 {count} 条标题。": "PDF importado: se extrajeron {count} títulos.",
    "PDF 批量导入完成：{files} 个文件共提取到 {count} 条标题。": "Importación por lotes completada: {count} títulos extraídos de {files} archivos.",
    "没有从 PDF 中提取到可检索标题。": "No se extrajeron títulos buscables del PDF.",
    "PDF 导入失败：{message}": "Error al importar PDF: {message}",
    "请选择 PDF 文件。": "Selecciona un archivo PDF.",
    "只支持 PDF 文件。": "Solo se admiten archivos PDF.",
    "粘贴 DOI、专利号、SRID 或论文标题，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。": "Pega DOI, números de patente, SRID o títulos. Sepáralos con saltos de línea, comas o punto y coma. Hasta 1000 por lote.",
  },
  ar: {
    "首页": "الرئيسية",
    "检索": "بحث",
    "语言": "اللغة",
    "更多": "المزيد",
    "帮助": "مساعدة",
    "登录": "تسجيل الدخول",
    "退出登录": "تسجيل الخروج",
    "简单检索": "بحث بسيط",
    "批量检索": "بحث دفعي",
    "导入Excel": "استيراد Excel",
    "导入PDF": "استيراد PDF",
    "导入CSV": "استيراد CSV",
    "直接检索": "بحث",
    "批量导入结果": "نتائج الاستيراد الدفعي",
    "共 {count} 条": "{count} عناصر",
    "序号": "#",
    "来源 PDF": "ملف PDF المصدر",
    "提取标题": "العنوان المستخرج",
    "一次粘贴。批量核验。": "الصق مرة واحدة. تحقق دفعة واحدة.",
    "正在解析 PDF…": "جار تحليل PDF…",
    "正在解析 {count} 个 PDF…": "جار تحليل {count} ملفات PDF…",
    "PDF 导入完成：提取到 {count} 条标题。": "تم استيراد PDF: تم استخراج {count} عنوانا.",
    "PDF 批量导入完成：{files} 个文件共提取到 {count} 条标题。": "اكتمل استيراد PDF الدفعي: تم استخراج {count} عنوانا من {files} ملفات.",
    "没有从 PDF 中提取到可检索标题。": "لم يتم استخراج عناوين قابلة للبحث من PDF.",
    "PDF 导入失败：{message}": "فشل استيراد PDF: {message}",
    "请选择 PDF 文件。": "يرجى اختيار ملف PDF.",
    "只支持 PDF 文件。": "يتم دعم ملفات PDF فقط.",
    "粘贴 DOI、专利号、SRID 或论文标题，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。": "الصق DOI أو أرقام براءات أو SRID أو عناوين. افصل بينها بسطر جديد أو فاصلة أو فاصلة منقوطة. حتى 1000 في الدفعة.",
  },
  fr: {
    "首页": "Accueil",
    "检索": "Recherche",
    "语言": "Langue",
    "更多": "Plus",
    "帮助": "Aide",
    "登录": "Connexion",
    "退出登录": "Déconnexion",
    "简单检索": "Recherche simple",
    "批量检索": "Recherche par lot",
    "导入Excel": "Importer Excel",
    "导入PDF": "Importer PDF",
    "导入CSV": "Importer CSV",
    "直接检索": "Rechercher",
    "批量导入结果": "Résultats d'import par lot",
    "共 {count} 条": "{count} éléments",
    "序号": "#",
    "来源 PDF": "PDF source",
    "提取标题": "Titre extrait",
    "一次粘贴。批量核验。": "Collez une fois. Vérifiez en lot.",
    "正在解析 PDF…": "Analyse du PDF…",
    "正在解析 {count} 个 PDF…": "Analyse de {count} PDF…",
    "PDF 导入完成：提取到 {count} 条标题。": "PDF importé : {count} titres extraits.",
    "PDF 批量导入完成：{files} 个文件共提取到 {count} 条标题。": "Import PDF par lot terminé : {count} titres extraits de {files} fichiers.",
    "没有从 PDF 中提取到可检索标题。": "Aucun titre recherchable extrait du PDF.",
    "PDF 导入失败：{message}": "Échec de l'import PDF : {message}",
    "请选择 PDF 文件。": "Veuillez choisir un fichier PDF.",
    "只支持 PDF 文件。": "Seuls les fichiers PDF sont pris en charge.",
    "粘贴 DOI、专利号、SRID 或论文标题，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。": "Collez des DOI, numéros de brevet, SRID ou titres. Séparez-les par retour ligne, virgule ou point-virgule. Jusqu'à 1000 par lot.",
  },
  ru: {
    "首页": "Главная",
    "检索": "Поиск",
    "语言": "Язык",
    "更多": "Еще",
    "帮助": "Помощь",
    "登录": "Войти",
    "退出登录": "Выйти",
    "简单检索": "Простой поиск",
    "批量检索": "Пакетный поиск",
    "导入Excel": "Импорт Excel",
    "导入PDF": "Импорт PDF",
    "导入CSV": "Импорт CSV",
    "直接检索": "Искать",
    "批量导入结果": "Результаты пакетного импорта",
    "共 {count} 条": "{count} элементов",
    "序号": "#",
    "来源 PDF": "Исходный PDF",
    "提取标题": "Извлеченный заголовок",
    "一次粘贴。批量核验。": "Вставьте один раз. Проверяйте пакетно.",
    "正在解析 PDF…": "Разбор PDF…",
    "正在解析 {count} 个 PDF…": "Разбор {count} PDF-файлов…",
    "PDF 导入完成：提取到 {count} 条标题。": "PDF импортирован: извлечено {count} заголовков.",
    "PDF 批量导入完成：{files} 个文件共提取到 {count} 条标题。": "Пакетный импорт PDF завершен: извлечено {count} заголовков из {files} файлов.",
    "没有从 PDF 中提取到可检索标题。": "Из PDF не удалось извлечь заголовки для поиска.",
    "PDF 导入失败：{message}": "Ошибка импорта PDF: {message}",
    "请选择 PDF 文件。": "Выберите PDF-файл.",
    "只支持 PDF 文件。": "Поддерживаются только PDF-файлы.",
    "粘贴 DOI、专利号、SRID 或论文标题，多个之间请用换行、逗号、分号、顿号分隔，单次最多输入1000个。": "Вставьте DOI, номера патентов, SRID или заголовки. Разделяйте переводом строки, запятой или точкой с запятой. До 1000 за раз.",
  },
};

function formatText(text: string, params?: Record<string, string | number>) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (["zh", "en", "es", "ar", "fr", "ru"].includes(saved || "")) {
        setLangState(saved as Lang);
      }
    } catch {}
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    // Keep the application shell left-to-right. Arabic labels still render correctly,
    // but menus/buttons will not flip their icon/text order unexpectedly.
    document.documentElement.dir = "ltr";
  }, [lang]);

  const toggle = useCallback(() => setLang(lang === "zh" ? "en" : "zh"), [lang, setLang]);

  return <LangCtx.Provider value={{ lang, setLang, toggle }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

/**
 * Translation hook. Pass strings as { zh, en } and get the active one.
 * Usage: const t = useT(); t({ zh: "你好", en: "Hello" })
 */
export function useT() {
  const { lang } = useLang();
  return useCallback(<T,>(
    pair: { zh: T; en: T } & Partial<Record<Exclude<Lang, "zh" | "en">, T>>,
    params?: Record<string, string | number>
  ): T => {
    const direct = pair[lang as keyof typeof pair];
    if (typeof direct === "string") return formatText(direct, params) as T;
    if (direct !== undefined) return direct as T;

    if (FALLBACK_LANG.includes(lang as Exclude<Lang, "zh" | "en">) && typeof pair.zh === "string") {
      const translated = UI_TRANSLATIONS[lang as Exclude<Lang, "zh" | "en">][pair.zh];
      if (translated) return formatText(translated, params) as T;
    }

    return (lang === "zh" ? pair.zh : pair.en) as T;
  }, [lang]);
}

/** Pill-style language switcher button. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = lang === "zh" ? "语言" : UI_TRANSLATIONS[lang as Exclude<Lang, "zh" | "en">]?.["语言"] ?? "Language";
  const options: { code: Lang; label: string }[] = [
    { code: "zh", label: "汉语" },
    { code: "en", label: "英语" },
    { code: "es", label: "西班牙语" },
    { code: "ar", label: "阿拉伯语" },
    { code: "fr", label: "法语" },
    { code: "ru", label: "俄语" },
  ];

  return (
    <div ref={ref} dir="ltr" className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        type="button"
        className="text-sm hover:text-gray-300 transition-colors flex flex-row items-center gap-1 h-9 leading-none"
        aria-label="Language"
      >
        <span dir="auto">{label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`!absolute left-0 top-full mt-3 w-40 liquid-glass rounded-2xl p-1.5 z-50 text-left transition-all duration-200 ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        {options.map(opt => {
          const active = opt.code === lang;
          return (
            <button
              key={opt.code}
              onClick={() => {
                setLang(opt.code);
                setOpen(false);
              }}
              type="button"
              className="w-full flex flex-row items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-colors"
            >
              <span dir="auto">{opt.label}</span>
              {active ? <Check size={12} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
