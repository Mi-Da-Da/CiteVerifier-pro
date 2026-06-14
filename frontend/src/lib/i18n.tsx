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

const COMMON_BODY: Record<string, Record<Exclude<Lang, "zh" | "en">, string>> = {
  "请输入论文标题。": { es: "Introduce el título del artículo.", ar: "أدخل عنوان البحث.", fr: "Saisissez le titre de l'article.", ru: "Введите название статьи." },
  "三重核验。层层把关。": { es: "Triple verificación. Capa a capa.", ar: "تحقق ثلاثي. طبقة تلو الأخرى.", fr: "Triple vérification. Couche par couche.", ru: "Тройная проверка. Слой за слоем." },
  "数据库比对。谷歌学术。AI 大模型。每一条引用，都经得起推敲。": { es: "Bases de datos. Google Scholar. IA avanzada. Cada cita resiste el escrutinio.", ar: "قواعد البيانات. جوجل سكولار. الذكاء الاصطناعي. كل اقتباس يصمد أمام التدقيق.", fr: "Bases de données. Google Scholar. IA de pointe. Chaque citation tient l'examen.", ru: "Базы данных. Google Scholar. ИИ. Каждая ссылка выдерживает проверку." },
  "极速。": { es: "Rápido.", ar: "سريع.", fr: "Rapide.", ru: "Быстро." },
  "平均三秒，给你答案。": { es: "Una respuesta en unos tres segundos.", ar: "إجابة في نحو ثلاث ثوانٍ.", fr: "Une réponse en trois secondes.", ru: "Ответ примерно за три секунды." },
  "智能。": { es: "Inteligente.", ar: "ذكي.", fr: "Intelligent.", ru: "Умно." },
  "大模型驱动的真实性判断。": { es: "Veracidad evaluada por modelos avanzados.", ar: "تقييم الصدقية بواسطة نماذج متقدمة.", fr: "Véracité évaluée par des modèles de pointe.", ru: "Достоверность оценивается передовыми моделями." },
  "双语。": { es: "Bilingüe.", ar: "ثنائي اللغة.", fr: "Bilingue.", ru: "Двуязычный." },
  "中文与英文，同等精准。": { es: "Chino e inglés, con igual precisión.", ar: "الصينية والإنجليزية بنفس الدقة.", fr: "Chinois et anglais, même précision.", ru: "Китайский и английский — одинаково точно." },
  "毕业论文。": { es: "Tesis.", ar: "الأطروحات.", fr: "Mémoires.", ru: "Дипломы." },
  "上百条参考文献，逐条核验。在答辩前，发现问题，而不是被问到问题。": { es: "Cientos de referencias, verificadas una a una. Detecta los fallos antes de la defensa, no durante.", ar: "مئات المراجع تُتحقق واحدة تلو الأخرى. اكتشف الأخطاء قبل المناقشة لا أثناءها.", fr: "Des centaines de références vérifiées une à une. Détectez les problèmes avant la soutenance.", ru: "Сотни источников проверяются по одному. Найдите ошибки до защиты, а не во время." },
  "期刊投稿。": { es: "Envíos a revistas.", ar: "تقديم للمجلات.", fr: "Soumissions aux revues.", ru: "Подача в журналы." },
  "投稿前的最后一道防线。降低拒稿风险，让评审专注于内容。": { es: "La última línea antes de enviar. Reduce los rechazos y deja que los revisores se concentren en el contenido.", ar: "خط الدفاع الأخير قبل الإرسال. قلّل من الرفض ودع المراجعين يركّزون على المحتوى.", fr: "Dernier rempart avant l'envoi. Réduisez les rejets et laissez les évaluateurs se concentrer sur le contenu.", ru: "Последний рубеж перед отправкой. Снизьте риск отказа и дайте рецензентам сосредоточиться на содержании." },
  "AI 写作。": { es: "Escritura con IA.", ar: "الكتابة بالذكاء الاصطناعي.", fr: "Écriture avec IA.", ru: "Письмо с ИИ." },
  "ChatGPT、Claude 偶尔会编造引用。我们识别它们，让 AI 真正可靠。": { es: "ChatGPT y Claude a veces inventan citas. Las detectamos para que la IA sea de fiar.", ar: "قد يختلق ChatGPT وClaude اقتباسات. نكشفها لجعل الذكاء الاصطناعي موثوقاً.", fr: "ChatGPT et Claude inventent parfois des citations. Nous les détectons pour fiabiliser l'IA.", ru: "ChatGPT и Claude иногда выдумывают ссылки. Мы их находим, чтобы ИИ был надёжным." },
  "文献综述。": { es: "Revisiones bibliográficas.", ar: "مراجعات الأدبيات.", fr: "Revues de littérature.", ru: "Литературные обзоры." },
  "成百上千条候选文献，批量核验。把时间留给思考。": { es: "Miles de candidatos verificados por lotes. Dedica tu tiempo a pensar.", ar: "آلاف المرشحين يُتحقق منها دفعةً واحدة. خصّص وقتك للتفكير.", fr: "Des milliers de candidats vérifiés par lot. Consacrez votre temps à la réflexion.", ru: "Тысячи кандидатов проверяются пакетно. Уделяйте время мышлению." },
  "GhostCite · 文献真实性检测": { es: "GhostCite · Verificación de citas", ar: "GhostCite · التحقق من الاقتباسات", fr: "GhostCite · Vérification des citations", ru: "GhostCite · Проверка цитирования" },
  "每一篇引用，\n都真实可信。": { es: "Cada cita,\nfuera de toda duda.", ar: "كل اقتباس،\nبلا شك.", fr: "Chaque citation,\nau-delà du doute.", ru: "Каждая ссылка —\nвне сомнений." },
  "输入一个标题。秒级判定真伪。远离虚假引用，远离 AI 幻觉。": { es: "Introduce un título. Verifica en segundos. Sin citas falsas ni alucinaciones de IA.", ar: "أدخل عنواناً. تحقق في ثوانٍ. بعيداً عن الاقتباسات الزائفة وهلوسات الذكاء الاصطناعي.", fr: "Saisissez un titre. Vérifiez en quelques secondes. Plus de fausses citations, plus d'hallucinations IA.", ru: "Введите название. Проверка за секунды. Без фальшивых ссылок и галлюцинаций ИИ." },
  "粘贴或输入论文标题…": { es: "Pega o escribe un título de artículo…", ar: "ألصق أو اكتب عنوان البحث…", fr: "Collez ou saisissez le titre d'un article…", ru: "Вставьте или введите название статьи…" },
  "开始检测": { es: "Verificar", ar: "تحقق", fr: "Vérifier", ru: "Проверить" },
  "权威数据库": { es: "BD acreditadas", ar: "قواعد بيانات معتمدة", fr: "Bases reconnues", ru: "Авторитетные БД" },
  "多源比对，精准定位。": { es: "Cotejo multi-fuente preciso.", ar: "مقارنة دقيقة متعددة المصادر.", fr: "Recoupement multi-source précis.", ru: "Точное сопоставление по источникам." },
  "秒级核验": { es: "Verificación instantánea", ar: "تحقق في ثوانٍ", fr: "Vérification en secondes", ru: "Проверка за секунды" },
  "平均三秒给出答案。": { es: "Respuesta en unos 3 s.", ar: "إجابة في نحو 3 ثوانٍ.", fr: "Réponse en environ 3 s.", ru: "Ответ примерно за 3 с." },
  "中英文双语": { es: "Bilingüe", ar: "ثنائي اللغة", fr: "Bilingue", ru: "Двуязычный" },
  "覆盖中英文文献。": { es: "Cubre chino e inglés.", ar: "يغطي الصينية والإنجليزية.", fr: "Couvre chinois et anglais.", ru: "Покрытие китайского и английского." },
  "演示视频即将上线。": { es: "Demo próximamente.", ar: "العرض التوضيحي قريباً.", fr: "Démo bientôt disponible.", ru: "Демо скоро." },
  "为严谨而生。": { es: "Hecho para el rigor.", ar: "صُمم للدقة.", fr: "Conçu pour la rigueur.", ru: "Создано для строгости." },
  "四个理由。": { es: "Cuatro razones.", ar: "أربعة أسباب.", fr: "Quatre raisons.", ru: "Четыре причины." },
  "数据库": { es: "Bases de datos", ar: "قواعد البيانات", fr: "Bases de données", ru: "Базы данных" },
  "谷歌学术": { es: "Google Scholar", ar: "جوجل سكولار", fr: "Google Scholar", ru: "Google Scholar" },
  "AI 大模型": { es: "IA avanzada", ar: "الذكاء الاصطناعي المتقدم", fr: "IA de pointe", ru: "Передовой ИИ" },
  "为每一种写作。": { es: "Para cada tipo de escritura.", ar: "لكل نوع من الكتابة.", fr: "Pour chaque type d'écrit.", ru: "Для любого вида письма." },
  "四个场景。": { es: "Cuatro escenarios.", ar: "أربعة مشاهد.", fr: "Quatre moments.", ru: "Четыре сценария." },
  "产品": { es: "Producto", ar: "المنتج", fr: "Produit", ru: "Продукт" },
  "英文文献": { es: "Literatura en inglés", ar: "الأدبيات الإنجليزية", fr: "Littérature anglaise", ru: "Англоязычная литература" },
  "中文文献": { es: "Literatura en chino", ar: "الأدبيات الصينية", fr: "Littérature chinoise", ru: "Китайская литература" },
  "API 文档": { es: "Docs de API", ar: "وثائق API", fr: "Docs API", ru: "Документация API" },
  "推荐阅读": { es: "Lecturas", ar: "قراءات", fr: "Lectures", ru: "Чтение" },
  "AI 幻觉文献": { es: "Sobre las alucinaciones de IA", ar: "حول هلوسات الذكاء الاصطناعي", fr: "Sur les hallucinations IA", ru: "О галлюцинациях ИИ" },
  "如何核验引用": { es: "Cómo verificar una cita", ar: "كيف تتحقق من اقتباس", fr: "Comment vérifier une citation", ru: "Как проверить цитату" },
  "学术写作实践": { es: "Buenas prácticas", ar: "أفضل الممارسات", fr: "Bonnes pratiques", ru: "Лучшие практики" },
  "关于我们": { es: "Empresa", ar: "الشركة", fr: "Entreprise", ru: "О компании" },
  "团队": { es: "Equipo", ar: "الفريق", fr: "Équipe", ru: "Команда" },
  "更新日志": { es: "Cambios", ar: "سجل التحديثات", fr: "Changelog", ru: "История изменений" },
  "用户反馈": { es: "Comentarios", ar: "ملاحظات", fr: "Retours", ru: "Отзывы" },
  "联系我们": { es: "Contacto", ar: "اتصل بنا", fr: "Contact", ru: "Контакт" },
  "商务合作": { es: "Alianzas", ar: "الشراكات", fr: "Partenariats", ru: "Партнёрства" },
  "媒体邀约": { es: "Prensa", ar: "صحافة", fr: "Presse", ru: "Пресса" },
  "保留所有权利。": { es: "Todos los derechos reservados.", ar: "جميع الحقوق محفوظة.", fr: "Tous droits réservés.", ru: "Все права защищены." },
  "隐私政策": { es: "Privacidad", ar: "الخصوصية", fr: "Confidentialité", ru: "Конфиденциальность" },
  "服务条款": { es: "Términos", ar: "الشروط", fr: "Conditions", ru: "Условия" },
  // More page
  "关于我们。": { es: "Sobre nosotros.", ar: "من نحن.", fr: "À propos.", ru: "О нас." },
  "为学术界做一件简单的事。让每一条引用，都值得信任。": { es: "Hacemos algo simple por la academia: que cada cita merezca confianza.", ar: "نقدّم خدمة بسيطة للأكاديميا: نجعل كل اقتباس جديراً بالثقة.", fr: "Une chose simple pour la recherche : rendre chaque citation digne de confiance.", ru: "Простая задача для науки — сделать каждую ссылку достойной доверия." },
  "常见问题。": { es: "Preguntas frecuentes.", ar: "أسئلة شائعة.", fr: "FAQ.", ru: "Частые вопросы." },
  "汇总高频问题。涵盖原理、覆盖范围与隐私。": { es: "Las dudas más comunes: cómo funciona, qué cubre y privacidad.", ar: "أكثر الأسئلة شيوعاً: آلية العمل والنطاق والخصوصية.", fr: "Les questions les plus fréquentes : fonctionnement, couverture et confidentialité.", ru: "Самые частые вопросы: как работает, охват и приватность." },
  "更新日志。": { es: "Cambios.", ar: "سجل التحديثات.", fr: "Changelog.", ru: "История изменений." },
  "持续打磨中。当前 v0.1.0，支持中英文核心检测。": { es: "Mejora continua. v0.1.0 cubre la verificación principal en chino e inglés.", ar: "تحسّن مستمر. الإصدار v0.1.0 يغطي التحقق الأساسي بالصينية والإنجليزية.", fr: "Amélioration continue. v0.1.0 couvre la vérification principale en chinois et anglais.", ru: "Постоянное улучшение. v0.1.0 — основная проверка на китайском и английском." },
  "API 文档。": { es: "API.", ar: "API.", fr: "API.", ru: "API." },
  "面向开发者的接入文档。即将开放。": { es: "Documentación para desarrolladores. Próximamente.", ar: "وثائق للمطورين. قريباً.", fr: "Documentation pour les développeurs. Bientôt.", ru: "Документация для разработчиков. Скоро." },
  "用户反馈。": { es: "Comentarios.", ar: "ملاحظات.", fr: "Retours.", ru: "Отзывы." },
  "你的建议，会让产品变得更好。": { es: "Tus ideas mejoran el producto. Cuéntanos.", ar: "أفكاركم تطوّر المنتج. شاركونا.", fr: "Vos idées améliorent le produit. Dites-nous.", ru: "Ваши идеи делают продукт лучше. Поделитесь." },
  "更多。": { es: "Más.", ar: "المزيد.", fr: "Plus.", ru: "Ещё." },
  "了解 GhostCite。和我们保持联系。": { es: "Conoce GhostCite. Mantente en contacto.", ar: "تعرّف على GhostCite. ابقَ على تواصل.", fr: "Découvrez GhostCite. Restons en contact.", ru: "Узнайте GhostCite. Оставайтесь на связи." },
  "海报。": { es: "Póster.", ar: "ملصق.", fr: "Affiche.", ru: "Постер." },
  "团队成果。": { es: "Resultados del equipo.", ar: "نتائج الفريق.", fr: "Résultats de l'équipe.", ru: "Результаты команды." },

  // Auth — login
  "欢迎回来。": { es: "Bienvenido de nuevo.", ar: "مرحباً بعودتك.", fr: "Bon retour.", ru: "С возвращением." },
  "登录，继续检测。": { es: "Inicia sesión para seguir verificando.", ar: "سجّل الدخول لمواصلة التحقق.", fr: "Connectez-vous pour continuer.", ru: "Войдите, чтобы продолжить проверку." },
  "用户名": { es: "Usuario", ar: "اسم المستخدم", fr: "Identifiant", ru: "Имя пользователя" },
  "请输入用户名": { es: "Introduce tu usuario", ar: "أدخل اسم المستخدم", fr: "Saisissez votre identifiant", ru: "Введите имя пользователя" },
  "密码": { es: "Contraseña", ar: "كلمة المرور", fr: "Mot de passe", ru: "Пароль" },
  "至少 6 位": { es: "Al menos 6 caracteres", ar: "6 أحرف على الأقل", fr: "Au moins 6 caractères", ru: "Минимум 6 символов" },
  "至少 6 位。": { es: "Al menos 6 caracteres.", ar: "6 أحرف على الأقل.", fr: "Au moins 6 caractères.", ru: "Минимум 6 символов." },
  "登录中…": { es: "Iniciando sesión…", ar: "جارٍ تسجيل الدخول…", fr: "Connexion…", ru: "Вход…" },
  "注册账号": { es: "Crear cuenta", ar: "إنشاء حساب", fr: "Créer un compte", ru: "Создать аккаунт" },
  "用户名或密码错误。": { es: "Usuario o contraseña incorrectos.", ar: "اسم المستخدم أو كلمة المرور غير صحيحة.", fr: "Identifiant ou mot de passe incorrect.", ru: "Неверное имя или пароль." },
  "网络错误，请稍后再试。": { es: "Error de red. Inténtalo más tarde.", ar: "خطأ في الشبكة. حاول لاحقاً.", fr: "Erreur réseau. Réessayez plus tard.", ru: "Сетевая ошибка. Повторите позже." },
  "网络错误，请稍后重试。": { es: "Error de red. Inténtalo más tarde.", ar: "خطأ في الشبكة. حاول لاحقاً.", fr: "Erreur réseau. Réessayez plus tard.", ru: "Сетевая ошибка. Повторите позже." },

  // Register
  "创建账号。": { es: "Crear una cuenta.", ar: "إنشاء حساب.", fr: "Créer un compte.", ru: "Создать аккаунт." },
  "加入 GhostCite。从此引用，皆可信。": { es: "Únete a GhostCite. Citas fiables desde ya.", ar: "انضم إلى GhostCite. اقتباسات موثوقة منذ الآن.", fr: "Rejoignez GhostCite. Des citations fiables désormais.", ru: "Присоединяйтесь к GhostCite. Надёжные ссылки с этого момента." },
  "3–20 位字母 / 数字 / 下划线": { es: "3–20 letras, números o guion bajo", ar: "3–20 حرفًا أو رقمًا أو شرطة سفلية", fr: "3 à 20 lettres, chiffres ou tirets bas", ru: "3–20 букв, цифр или подчёркиваний" },
  "3–20 位字母、数字或下划线。": { es: "3–20 letras, números o guion bajo.", ar: "3–20 حرفًا أو رقمًا أو شرطة سفلية.", fr: "3 à 20 lettres, chiffres ou tirets bas.", ru: "3–20 букв, цифр или подчёркиваний." },
  "再次输入密码": { es: "Repite la contraseña", ar: "أعد إدخال كلمة المرور", fr: "Confirmez le mot de passe", ru: "Повторите пароль" },
  "确认密码": { es: "Confirmar contraseña", ar: "تأكيد كلمة المرور", fr: "Confirmer le mot de passe", ru: "Подтвердите пароль" },
  "两次密码不一致。": { es: "Las contraseñas no coinciden.", ar: "كلمتا المرور غير متطابقتين.", fr: "Les mots de passe ne correspondent pas.", ru: "Пароли не совпадают." },
  "注册": { es: "Registrarse", ar: "تسجيل", fr: "S'inscrire", ru: "Регистрация" },
  "注册中…": { es: "Registrando…", ar: "جارٍ التسجيل…", fr: "Inscription…", ru: "Регистрация…" },
  "注册失败，请稍后再试。": { es: "Error al registrar. Inténtalo más tarde.", ar: "فشل التسجيل. حاول لاحقاً.", fr: "Échec de l'inscription. Réessayez plus tard.", ru: "Ошибка регистрации. Повторите позже." },
  "已有账号？": { es: "¿Ya tienes cuenta?", ar: "لديك حساب بالفعل؟", fr: "Vous avez déjà un compte ?", ru: "Уже есть аккаунт?" },
  "立即登录": { es: "Inicia sesión", ar: "سجّل الدخول", fr: "Connectez-vous", ru: "Войти" },
  "邮箱": { es: "Correo", ar: "البريد الإلكتروني", fr: "E-mail", ru: "Эл. почта" },
  "邮箱格式不正确。": { es: "Formato de correo no válido.", ar: "صيغة البريد غير صحيحة.", fr: "Format d'e-mail invalide.", ru: "Неверный формат e-mail." },

  // Simple / Advanced search
  "三重核验：数据库比对 · 谷歌学术 · AI 大模型。平均三秒给出答案。": { es: "Triple verificación: bases de datos · Google Scholar · IA. Respuesta en unos 3 s.", ar: "تحقق ثلاثي: قواعد البيانات · جوجل سكولار · الذكاء الاصطناعي. الإجابة في نحو 3 ثوانٍ.", fr: "Triple vérification : bases · Google Scholar · IA. Réponse en ~3 s.", ru: "Тройная проверка: базы · Google Scholar · ИИ. Ответ ~3 с." },
  "粘贴标题列表，或上传 PDF 自动提取参考文献。": { es: "Pega una lista de títulos o sube un PDF para extraer las referencias.", ar: "ألصق قائمة عناوين أو ارفع ملف PDF لاستخراج المراجع.", fr: "Collez une liste de titres ou téléversez un PDF pour extraire les références.", ru: "Вставьте список заголовков или загрузите PDF для извлечения ссылок." },
  "每行一个论文标题…": { es: "Un título por línea…", ar: "عنوان واحد في كل سطر…", fr: "Un titre par ligne…", ru: "По одному заголовку в строке…" },
  "开始检索": { es: "Buscar", ar: "ابدأ البحث", fr: "Lancer", ru: "Начать поиск" },
  "上传 PDF": { es: "Subir PDF", ar: "رفع PDF", fr: "Téléverser un PDF", ru: "Загрузить PDF" },
  "上传 CSV": { es: "Subir CSV", ar: "رفع CSV", fr: "Téléverser un CSV", ru: "Загрузить CSV" },
  "点击或拖拽上传 PDF 文件": { es: "Haz clic o arrastra para subir un PDF", ar: "انقر أو اسحب لرفع ملف PDF", fr: "Cliquez ou glissez un PDF", ru: "Нажмите или перетащите PDF" },
  "点击或拖拽上传 CSV 文件": { es: "Haz clic o arrastra para subir un CSV", ar: "انقر أو اسحب لرفع ملف CSV", fr: "Cliquez ou glissez un CSV", ru: "Нажмите или перетащите CSV" },
  "请先选择 PDF 文件。": { es: "Selecciona primero un archivo PDF.", ar: "اختر ملف PDF أولاً.", fr: "Choisissez d'abord un PDF.", ru: "Сначала выберите PDF." },
  "请先选择 CSV 文件。": { es: "Selecciona primero un archivo CSV.", ar: "اختر ملف CSV أولاً.", fr: "Choisissez d'abord un CSV.", ru: "Сначала выберите CSV." },
  "请输入至少一个标题。": { es: "Introduce al menos un título.", ar: "أدخل عنواناً واحداً على الأقل.", fr: "Saisissez au moins un titre.", ru: "Введите хотя бы один заголовок." },
  "CSV 上传或网络错误。": { es: "Error de red o al subir el CSV.", ar: "خطأ في رفع CSV أو الشبكة.", fr: "Erreur réseau ou de téléversement CSV.", ru: "Ошибка загрузки CSV или сети." },
  "系统将自动提取参考文献并逐条核验": { es: "Las referencias se extraen y verifican automáticamente.", ar: "تُستخرج المراجع وتُتحقق تلقائياً.", fr: "Les références sont extraites et vérifiées automatiquement.", ru: "Ссылки извлекаются и проверяются автоматически." },
  "系统将自动导入文献标题并逐条核验": { es: "Los títulos se importan y verifican automáticamente.", ar: "تُستورد العناوين وتُتحقق تلقائياً.", fr: "Les titres sont importés et vérifiés automatiquement.", ru: "Заголовки импортируются и проверяются автоматически." },
  "中文文献。": { es: "Literatura en chino.", ar: "الأدبيات الصينية.", fr: "Littérature chinoise.", ru: "Китайская литература." },
  "英文文献。": { es: "Literatura en inglés.", ar: "الأدبيات الإنجليزية.", fr: "Littérature anglaise.", ru: "Англоязычная литература." },

  // Detect / result
  "正在检测。": { es: "Verificando.", ar: "جارٍ التحقق.", fr: "Vérification.", ru: "Проверяем." },
  "几秒后，结果出现。": { es: "El resultado aparece en segundos.", ar: "تظهر النتيجة خلال ثوانٍ.", fr: "Le résultat s'affiche en quelques secondes.", ru: "Результат появится через секунды." },
  "检索学术数据库": { es: "Buscando en bases académicas", ar: "البحث في قواعد البيانات الأكاديمية", fr: "Recherche dans les bases académiques", ru: "Поиск в академических базах" },
  "比对学术索引": { es: "Cotejando índices académicos", ar: "مقارنة الفهارس الأكاديمية", fr: "Comparaison des index académiques", ru: "Сравнение академических индексов" },
  "分析引用真实性": { es: "Analizando la veracidad de la cita", ar: "تحليل صدقية الاقتباس", fr: "Analyse de l'authenticité", ru: "Анализ достоверности ссылки" },
  "生成检测报告": { es: "Generando informe", ar: "إنشاء التقرير", fr: "Génération du rapport", ru: "Создание отчёта" },
  "你输入的标题": { es: "Tu título", ar: "العنوان الذي أدخلته", fr: "Votre titre", ru: "Ваш заголовок" },
  "查询标题": { es: "Título consultado", ar: "العنوان المستعلم", fr: "Titre recherché", ru: "Запрошенный заголовок" },
  "找到了。这篇论文真实存在。": { es: "Encontrada. Esta referencia existe.", ar: "تم العثور عليها. هذه المرجع موجود.", fr: "Trouvée. Cette référence existe.", ru: "Найдено. Эта статья существует." },
  "未找到来源。这条引用可能不存在。": { es: "Sin fuente. Esta cita podría no existir.", ar: "لا مصدر. قد لا يكون هذا الاقتباس موجوداً.", fr: "Aucune source. Cette citation peut ne pas exister.", ru: "Источник не найден. Ссылка может не существовать." },
  "找到近似记录，但相似度偏低，建议人工核查。": { es: "Hay coincidencias cercanas pero con baja similitud; revísalo manualmente.", ar: "وجدت سجلات مشابهة بدرجة منخفضة؛ يُنصح بالمراجعة اليدوية.", fr: "Correspondances proches mais faibles ; vérifiez manuellement.", ru: "Найдены похожие записи с низким сходством — проверьте вручную." },
  "在 DBLP 学术数据库中检索到了可信记录。": { es: "Registro fiable encontrado en DBLP.", ar: "تم العثور على سجل موثوق في DBLP.", fr: "Enregistrement fiable trouvé dans DBLP.", ru: "Достоверная запись найдена в DBLP." },
  "在 DBLP 学术数据库中未检索到有效记录。": { es: "Sin registros válidos en DBLP.", ar: "لا توجد سجلات صالحة في DBLP.", fr: "Aucun enregistrement valide dans DBLP.", ru: "Действительные записи в DBLP не найдены." },
  "DBLP 中存在相近标题，但无法确认是同一篇文献。": { es: "Hay títulos similares en DBLP pero no se confirma la coincidencia.", ar: "توجد عناوين قريبة في DBLP لكن لا يمكن تأكيد التطابق.", fr: "Titres proches dans DBLP, correspondance non confirmée.", ru: "В DBLP есть похожие заголовки, но совпадение не подтверждено." },
  "数据来源": { es: "Fuentes", ar: "المصادر", fr: "Sources", ru: "Источники" },
  "DBLP 匹配": { es: "Coincidencia DBLP", ar: "تطابق DBLP", fr: "Correspondance DBLP", ru: "Совпадение DBLP" },
  "DBLP 匹配标题": { es: "Título coincidente en DBLP", ar: "العنوان المطابق في DBLP", fr: "Titre correspondant DBLP", ru: "Совпавший заголовок DBLP" },
  "已通过": { es: "Verificada", ar: "تم التحقق", fr: "Vérifiée", ru: "Подтверждено" },
  "疑似虚假": { es: "Sospechosa", ar: "مشكوك فيها", fr: "Suspecte", ru: "Подозрительно" },
  "无法判断": { es: "No concluyente", ar: "غير حاسم", fr: "Indéterminé", ru: "Не определено" },
  "找到": { es: "Encontradas", ar: "تم العثور", fr: "Trouvées", ru: "Найдено" },
  "已找到": { es: "Encontradas", ar: "تم العثور", fr: "Trouvées", ru: "Найдено" },
  "未找到": { es: "No encontradas", ar: "غير موجود", fr: "Introuvables", ru: "Не найдено" },
  "状态": { es: "Estado", ar: "الحالة", fr: "Statut", ru: "Статус" },
  "时间": { es: "Tiempo", ar: "الوقت", fr: "Temps", ru: "Время" },
  "耗时": { es: "Duración", ar: "المدة", fr: "Durée", ru: "Длительность" },
  "检测时间": { es: "Verificado", ar: "وقت التحقق", fr: "Vérifié le", ru: "Время проверки" },
  "相似度": { es: "Similitud", ar: "التشابه", fr: "Similarité", ru: "Сходство" },
  "总计": { es: "Total", ar: "الإجمالي", fr: "Total", ru: "Всего" },
  "复制结果": { es: "Copiar resultado", ar: "نسخ النتيجة", fr: "Copier le résultat", ru: "Скопировать" },
  "已复制": { es: "Copiado", ar: "تم النسخ", fr: "Copié", ru: "Скопировано" },
  "导出 CSV": { es: "Exportar CSV", ar: "تصدير CSV", fr: "Exporter CSV", ru: "Экспорт CSV" },
  "重新检测": { es: "Verificar de nuevo", ar: "إعادة التحقق", fr: "Revérifier", ru: "Проверить снова" },
  "返回首页检测": { es: "Volver a la página de inicio", ar: "العودة إلى الرئيسية", fr: "Retour à l'accueil", ru: "На главную" },
  "详细结果": { es: "Resultados detallados", ar: "نتائج مفصّلة", fr: "Résultats détaillés", ru: "Подробные результаты" },
  "第 1 步：LLM 解析 PDF 参考文献…": { es: "Paso 1: el LLM analiza las referencias del PDF…", ar: "الخطوة 1: يحلل النموذج مراجع PDF…", fr: "Étape 1 : le LLM analyse les références du PDF…", ru: "Шаг 1: LLM разбирает ссылки PDF…" },
  "标题列表": { es: "Lista de títulos", ar: "قائمة العناوين", fr: "Liste des titres", ru: "Список заголовков" },
  "检索中…": { es: "Buscando…", ar: "جارٍ البحث…", fr: "Recherche…", ru: "Поиск…" },
  "处理中…": { es: "Procesando…", ar: "جارٍ المعالجة…", fr: "Traitement…", ru: "Обработка…" },
  "正在思考…": { es: "Pensando…", ar: "جارٍ التفكير…", fr: "Réflexion…", ru: "Думаем…" },
  "加载中…": { es: "Cargando…", ar: "جارٍ التحميل…", fr: "Chargement…", ru: "Загрузка…" },
  "请求失败。": { es: "Solicitud fallida.", ar: "فشل الطلب.", fr: "Échec de la requête.", ru: "Запрос не выполнен." },
  "出了点问题。请稍后再试。": { es: "Algo salió mal. Inténtalo más tarde.", ar: "حدث خطأ ما. حاول لاحقاً.", fr: "Un problème est survenu. Réessayez plus tard.", ru: "Что-то пошло не так. Повторите позже." },
  "重试": { es: "Reintentar", ar: "إعادة المحاولة", fr: "Réessayer", ru: "Повторить" },
  "（空）": { es: "(vacío)", ar: "(فارغ)", fr: "(vide)", ru: "(пусто)" },

  // History
  "暂无历史记录。先去做一次批量检索吧。": { es: "Sin historial todavía. Empieza con una búsqueda por lotes.", ar: "لا يوجد سجل بعد. ابدأ ببحث دفعي.", fr: "Aucun historique. Lancez une recherche par lot.", ru: "История пуста. Запустите пакетный поиск." },
  "点击左侧记录查看详情": { es: "Selecciona un elemento para ver los detalles.", ar: "اختر سجلًا لعرض التفاصيل.", fr: "Sélectionnez un élément pour voir les détails.", ru: "Выберите запись слева для деталей." },

  // Home extras
  "它能做什么。": { es: "Lo que hace.", ar: "ما يفعله.", fr: "Ce qu'il fait.", ru: "Что он делает." },
  "怎么用。": { es: "Cómo usarlo.", ar: "كيفية الاستخدام.", fr: "Comment l'utiliser.", ru: "Как использовать." },
  "在首页输入框粘贴标题。": { es: "Pega un título en el cuadro de búsqueda.", ar: "ألصق عنواناً في حقل البحث.", fr: "Collez un titre dans le champ de recherche.", ru: "Вставьте заголовок в поле поиска." },
  "在首页输入框粘贴英文标题。": { es: "Pega un título en inglés en el cuadro.", ar: "ألصق عنواناً إنجليزياً في الحقل.", fr: "Collez un titre anglais dans le champ.", ru: "Вставьте англоязычный заголовок." },
  "点击「开始检测」或按下回车。": { es: "Pulsa «Verificar» o Enter.", ar: "اضغط «تحقق» أو Enter.", fr: "Cliquez sur « Vérifier » ou Entrée.", ru: "Нажмите «Проверить» или Enter." },
  "真实示例": { es: "Ejemplo real", ar: "مثال حقيقي", fr: "Exemple réel", ru: "Реальный пример" },
  "虚假示例": { es: "Ejemplo falso", ar: "مثال زائف", fr: "Exemple faux", ru: "Поддельный пример" },
  "为中文学术语境而调。覆盖主流期刊、学位论文与开放获取库。": { es: "Optimizado para el contexto chino. Cubre revistas, tesis y repositorios abiertos.", ar: "مُهيّأ للسياق الأكاديمي الصيني. يغطي المجلات والأطروحات والمستودعات المفتوحة.", fr: "Adapté au contexte chinois : revues, thèses, dépôts ouverts.", ru: "Оптимизировано для китайского контекста: журналы, диссертации, открытые архивы." },
  "面向英文学术写作。覆盖核心索引与开放获取库。": { es: "Para escritura académica en inglés. Cubre índices clave y repositorios abiertos.", ar: "للكتابة الأكاديمية الإنجليزية. يغطي الفهارس الأساسية والمستودعات المفتوحة.", fr: "Pour l'écriture académique anglaise. Index principaux et dépôts ouverts.", ru: "Для англоязычного академического письма. Ключевые индексы и открытые архивы." },
  "主流中文期刊索引与学位论文库。覆盖范围持续扩展。": { es: "Índices de revistas chinas y tesis. Cobertura en expansión.", ar: "فهارس المجلات الصينية والأطروحات. تغطية تتوسع باستمرار.", fr: "Index des revues chinoises et thèses. Couverture en expansion.", ru: "Индексы китайских журналов и диссертаций. Покрытие расширяется." },
  "核心期刊索引、会议库与开放获取库。范围持续扩展。": { es: "Índices de revistas, conferencias y acceso abierto. Cobertura en expansión.", ar: "فهارس المجلات والمؤتمرات والوصول المفتوح. تغطية تتوسع.", fr: "Index de revues, conférences et accès ouvert. Couverture en expansion.", ru: "Индексы журналов, конференций и открытого доступа. Покрытие расширяется." },
  "纯英文，以及英文为主的混排。关键字段自动识别。": { es: "Solo inglés o mayoritariamente inglés. Campos clave detectados automáticamente.", ar: "إنجليزي بحت أو غالب. يُكتشف الحقول الرئيسية تلقائياً.", fr: "Anglais pur ou principalement anglais. Champs clés détectés automatiquement.", ru: "Только английский или преимущественно английский. Ключевые поля распознаются автоматически." },
  "多源比对，加上语义匹配。判定标题是否真实存在。从学位论文到 AI 写作校验，皆可使用。": { es: "Cotejo multi-fuente con coincidencia semántica. Determina si un título existe. De tesis a textos generados por IA.", ar: "مقارنة متعددة المصادر مع تطابق دلالي. يحدد ما إذا كان العنوان موجوداً. من الأطروحات إلى مخرجات الذكاء الاصطناعي.", fr: "Recoupement multi-source et correspondance sémantique. Vérifie l'existence d'un titre. Des thèses aux textes IA.", ru: "Сопоставление по источникам и семантический матчинг. Определяет реальность заголовка — от диссертаций до текстов ИИ." },
  "多源比对，结合语义匹配。判定一篇英文标题是否真实存在。从综述写作到投稿前自检，都适用。": { es: "Cotejo multi-fuente con coincidencia semántica. Verifica títulos en inglés, de revisiones a auto-revisión previa al envío.", ar: "مقارنة متعددة المصادر مع تطابق دلالي. للتحقق من العناوين الإنجليزية، من المراجعات إلى الفحص قبل التقديم.", fr: "Recoupement multi-source et sémantique. Vérifie les titres anglais, de la revue à l'auto-contrôle avant soumission.", ru: "Многосточник + семантика. Проверяет английские заголовки — от обзоров до самоконтроля перед подачей." },
  "支持哪些英文标题？": { es: "¿Qué títulos en inglés admite?", ar: "ما العناوين الإنجليزية المدعومة؟", fr: "Quels titres anglais sont pris en charge ?", ru: "Какие английские заголовки поддерживаются?" },
  "支持繁体中文吗？": { es: "¿Admite chino tradicional?", ar: "هل يدعم الصينية التقليدية؟", fr: "Le chinois traditionnel est-il pris en charge ?", ru: "Поддерживается ли традиционный китайский?" },
  "覆盖哪些数据库？": { es: "¿Qué bases de datos cubre?", ar: "ما القواعد التي يغطيها؟", fr: "Quelles bases sont couvertes ?", ru: "Какие базы данных охвачены?" },
  "覆盖哪些英文数据库？": { es: "¿Qué bases en inglés cubre?", ar: "ما قواعد البيانات الإنجليزية المغطاة؟", fr: "Quelles bases anglaises sont couvertes ?", ru: "Какие англоязычные базы охвачены?" },
  "标题中的特殊字符可以识别吗？": { es: "¿Reconoce caracteres especiales en los títulos?", ar: "هل تُكتشف الأحرف الخاصة في العناوين؟", fr: "Les caractères spéciaux sont-ils reconnus ?", ru: "Распознаются ли спецсимволы в заголовках?" },
  "中英混排标题可以吗？": { es: "¿Acepta títulos chino-inglés mezclados?", ar: "هل يقبل عناوين مختلطة صينية-إنجليزية؟", fr: "Les titres bilingues chinois-anglais sont-ils acceptés ?", ru: "Допускаются ли смешанные китайско-английские заголовки?" },
  "可以。": { es: "Sí.", ar: "نعم.", fr: "Oui.", ru: "Да." },
  "支持。简繁自动归一，异形字也匹配。": { es: "Sí. Simplificado y tradicional se normalizan; variantes también coinciden.", ar: "نعم. يتم توحيد المبسط والتقليدي وتطابق الأشكال البديلة.", fr: "Oui. Simplifié et traditionnel normalisés ; variantes reconnues.", ru: "Да. Упрощённый и традиционный нормализуются; варианты тоже совпадают." },
  "可以。冒号、连字符、希腊字母等学术符号皆支持。": { es: "Sí. Dos puntos, guiones, letras griegas y otros símbolos académicos están admitidos.", ar: "نعم. النقطتان والشُرَط والأحرف اليونانية وغيرها مدعومة.", fr: "Oui. Deux-points, tirets, lettres grecques et autres symboles acceptés.", ru: "Да. Двоеточия, дефисы, греческие буквы и другие символы поддерживаются." },
  "可以。系统自动识别关键字段。": { es: "Sí. El sistema detecta los campos clave.", ar: "نعم. يتعرف النظام على الحقول الرئيسية تلقائياً.", fr: "Oui. Le système détecte les champs clés.", ru: "Да. Система автоматически распознаёт ключевые поля." },
  "常见问题": { es: "Preguntas frecuentes", ar: "أسئلة شائعة", fr: "FAQ", ru: "Частые вопросы" },

  // AI chat
  "GhostCite AI 助手": { es: "Asistente IA de GhostCite", ar: "مساعد GhostCite الذكي", fr: "Assistant IA GhostCite", ru: "ИИ-ассистент GhostCite" },
  "在线": { es: "En línea", ar: "متصل", fr: "En ligne", ru: "Онлайн" },
  "输入你的问题…": { es: "Escribe tu pregunta…", ar: "اكتب سؤالك…", fr: "Posez votre question…", ru: "Введите ваш вопрос…" },
  "问我关于引用核验、文献查找或学术写作的问题。": { es: "Pregúntame sobre verificación de citas, búsqueda bibliográfica o escritura académica.", ar: "اسألني عن التحقق من الاقتباسات أو البحث في الأدبيات أو الكتابة الأكاديمية.", fr: "Posez vos questions sur la vérification de citations, la recherche ou l'écriture académique.", ru: "Спросите о проверке ссылок, поиске литературы или академическом письме." },
  "你好": { es: "Hola", ar: "مرحباً", fr: "Bonjour", ru: "Привет" },
};

const NAV_TRANSLATIONS: Record<Exclude<Lang, "zh" | "en">, Record<string, string>> = {
  es: {
    "首页": "Inicio", "检索": "Búsqueda", "语言": "Español", "更多": "Más", "帮助": "Ayuda",
    "登录": "Iniciar sesión", "退出登录": "Cerrar sesión",
    "简单检索": "Búsqueda simple", "批量检索": "Búsqueda por lotes",
    "导入Excel": "Importar Excel", "导入PDF": "Importar PDF", "导入CSV": "Importar CSV",
    "直接检索": "Buscar", "批量导入结果": "Resultados de importación por lotes",
    "共 {count} 条": "{count} elementos", "序号": "#",
    "来源 PDF": "PDF de origen", "提取标题": "Título extraído",
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
    "历史记录": "Historial",
  },
  ar: {
    "首页": "الرئيسية", "检索": "بحث", "语言": "العربية", "更多": "المزيد", "帮助": "مساعدة",
    "登录": "تسجيل الدخول", "退出登录": "تسجيل الخروج",
    "简单检索": "بحث بسيط", "批量检索": "بحث دفعي",
    "导入Excel": "استيراد Excel", "导入PDF": "استيراد PDF", "导入CSV": "استيراد CSV",
    "直接检索": "بحث", "批量导入结果": "نتائج الاستيراد الدفعي",
    "共 {count} 条": "{count} عناصر", "序号": "#",
    "来源 PDF": "ملف PDF المصدر", "提取标题": "العنوان المستخرج",
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
    "历史记录": "السجل",
  },
  fr: {
    "首页": "Accueil", "检索": "Recherche", "语言": "Français", "更多": "Plus", "帮助": "Aide",
    "登录": "Connexion", "退出登录": "Déconnexion",
    "简单检索": "Recherche simple", "批量检索": "Recherche par lot",
    "导入Excel": "Importer Excel", "导入PDF": "Importer PDF", "导入CSV": "Importer CSV",
    "直接检索": "Rechercher", "批量导入结果": "Résultats d'import par lot",
    "共 {count} 条": "{count} éléments", "序号": "#",
    "来源 PDF": "PDF source", "提取标题": "Titre extrait",
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
    "历史记录": "Historique",
  },
  ru: {
    "首页": "Главная", "检索": "Поиск", "语言": "Русский", "更多": "Еще", "帮助": "Помощь",
    "登录": "Войти", "退出登录": "Выйти",
    "简单检索": "Простой поиск", "批量检索": "Пакетный поиск",
    "导入Excel": "Импорт Excel", "导入PDF": "Импорт PDF", "导入CSV": "Импорт CSV",
    "直接检索": "Искать", "批量导入结果": "Результаты пакетного импорта",
    "共 {count} 条": "{count} элементов", "序号": "#",
    "来源 PDF": "Исходный PDF", "提取标题": "Извлеченный заголовок",
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
    "历史记录": "История",
  },
};

const UI_TRANSLATIONS: Record<Exclude<Lang, "zh" | "en">, Record<string, string>> = (() => {
  const out = { es: {}, ar: {}, fr: {}, ru: {} } as Record<Exclude<Lang, "zh" | "en">, Record<string, string>>;
  for (const lang of ["es", "ar", "fr", "ru"] as const) {
    Object.assign(out[lang], NAV_TRANSLATIONS[lang]);
    for (const [zh, dict] of Object.entries(COMMON_BODY)) {
      out[lang][zh] = dict[lang];
    }
  }
  return out;
})();


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
