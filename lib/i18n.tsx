"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENCIES,
  EXCHANGE_RATES,
  formatMoney,
  fromUsd,
  type CurrencyCode,
} from "@/lib/currency";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

export type Locale = "en" | "ar";
export type LangStrings = keyof typeof en;

const en = {
  appName: "StoreFlow",
  navDashboard: "Dashboard",
  navPos: "Point of Sale",
  navFinance: "Finance",
  navSettings: "Settings & Billing",
  navCore: "Core",
  navInventory: "Inventory",
  navFinanceGroup: "Finance & ERP",
  navAnalyticsGroup: "Analytics & AI",
  navCatalog: "Catalog",
  navTransfers: "Stock Transfers",
  navWarehouses: "Warehouses",
  navSuppliers: "Suppliers",
  navInvoices: "Invoices",
  navReceivables: "Accounts Receivable",
  navLedger: "General Ledger",
  navExpenses: "Expenses",
  navReports: "P&L Reports",
  navIntelligence: "Intelligence Hub",
  navForecasting: "Forecasting",
  navPurchaseOrders: "Auto-Purchase Orders",
  forbiddenTitle: "Access denied",
  forbiddenDescription: "Your current role does not have permission to access this workspace.",
  returnToWorkspace: "Return to workspace",
  selectCompany: "Select company",
  mainStore: "Main Store",
  selectWarehouse: "Select warehouse",
  warehouse: "Warehouse",
  currency: "Currency",
  toggleTheme: "Toggle theme",
  light: "Light",
  dark: "Dark",
  storeBadge: "Store #{id}",
  dashboardTagline:
    "Manage your product catalog, sales, and AI insights in one place.",
  statProducts: "Total Products",
  statStockValue: "Total Stock Value",
  statLowStock: "Low Stock Items",
  chartRevenue: "Monthly Sales Trend",
  chartRevenueSub: "Revenue, last 6 months",
  chartMargin: "Profit Margin",
  chartMarginSub: "Monthly margin %, last 6 months",
  loadingAnalytics: "Loading analytics...",
  formAddProduct: "Add New Product",
  formAddSub: "Add a product to your catalog to start tracking sales.",
  formName: "Name",
  formPrice: "Price",
  formStock: "Stock",
  formAdd: "Add Product",
  formAdding: "Adding...",
  tableProducts: "Products",
  tableInCatalog: "{count} in catalog",
  thProduct: "Product",
  thPrice: "Price",
  thStock: "Stock",
  thStatus: "Status",
  thValue: "Value",
  thActions: "Actions",
  statusIn: "In stock",
  statusLow: "Low stock",
  statusOut: "Out of stock",
  loadingProducts: "Loading products...",
  noProducts: "No products yet for this store. Add your first one above.",
  aiCopilot: "AI Copilot",
  copilotSub: "Ask about your sales & inventory",
  copilotPlaceholder: "Ask Copilot...",
  copilotThinking: "Copilot is thinking...",
  copilotWelcome:
    "Hi, I'm your StoreFlow Copilot. Ask me things like:",
  copilotError:
    "Could not reach the AI assistant. Check your API key and try again.",
  analystTitle: "AI Business Analyst",
  analystBadge: "Gemini",
  analystSub:
    "Ask about inventory, sales trends, and what to reorder.",
  analystPlaceholder:
    "Ask about inventory, sales trends, and what to reorder...",
  analyze: "Analyze",
  analyzing: "Analyzing...",
  insights: "Insights",
  recommendations: "Recommendations",
  errorPrefix: "Error",
  poTitle: "Auto Purchase Order",
  poSub:
    "Generate a downloadable PDF purchase order covering low-stock items.",
  poGenerate: "Generate PDF",
  poGenerating: "Preparing...",
  poNoLowStock: "No low-stock items right now.",
  poCount: "{count} low-stock item(s)",
  poTarget: "Reorder to {target}",
  poDocTitle: "Purchase Order",
  posTitle: "Point of Sale",
  posSub: "Fast barcode-friendly checkout",
  posSearch: "Scan or search products...",
  posSearchHint:
    "Type a product name (or scan a barcode) and press Enter to add it to the order",
  posItems: "Items",
  posCart: "Current Order",
  posEmptyCart: "Cart is empty. Click a product to add it.",
  posQty: "Qty",
  posSubtotal: "Subtotal",
  posPay: "Complete Sale",
  posPaying: "Recording...",
  posSuccess: "Sale recorded: {total}",
  posInsufficient: "Not enough stock for \"{name}\"",
  posNoMatch: "No product found for \"{query}\"",
  settingsTitle: "Subscription & Billing",
  settingsSub:
    "Manage your plan, usage, and billing with Lemon Squeezy.",
  currentPlanLabel: "Current Plan",
  usageLabel: "Usage This Month",
  planActive: "Active",
  starterName: "Starter",
  starterPrice: "Free",
  proName: "Pro",
  proPrice: "$19/mo",
  upGrade: "Upgrade",
  manageBilling: "Manage Billing",
  usageProducts: "Products",
  usageTransactions: "POS Transactions",
  usageInsights: "AI Insights",
  ofPlan: "of {limit}",
  lsNotConfigured:
    "Lemon Squeezy is not configured. Set LS_API_KEY, LS_STORE_ID, and LS_PRO_VARIANT_ID to enable checkout.",
  checkoutError: "Could not create the checkout. Please try again.",
  working: "Working...",
  featStarter1: "50 products",
  featStarter2: "500 POS transactions / month",
  featStarter3: "Basic reports",
  featPro1: "Unlimited products",
  featPro2: "Unlimited POS transactions",
  featPro3: "AI Analyst + Copilot",
  featPro4: "Auto purchase orders & PDFs",
  posWarehouse: "Warehouse",
  posOnline: "Online",
  posOffline: "Offline",
  posSyncing: "Syncing",
  offlineMode: "Offline mode",
  offlineBanner: "You are offline.",
  offlineNotice:
    "Checkout is still available from the local cache. Sales will sync automatically when you reconnect.",
  offlineUnavailable:
    "No cached catalog is available offline. Connect once to cache products.",
  posQueued:
    "Sale recorded and queued. It will sync automatically when back online.",
  posQueuedHint: "Sale is queued locally and will sync automatically.",
  syncPending: "{count} action(s) waiting to sync ({state})",
  syncPendingShort: "{count} pending",
  syncRejected: "Sync failed for {kind}: {error}",
  transferTitle: "Stock Transfers",
  transferSub:
    "Move stock between warehouses. Every transfer is audited and kept in sync.",
  transferFrom: "From warehouse",
  transferTo: "To warehouse",
  transferProduct: "Product",
  transferQtyLabel: "Qty",
  transferNote: "Note",
  transferNotePlaceholder: "Optional note",
  transferSubmit: "Transfer",
  transferInvalid: "Please fill in all fields with a valid quantity.",
  transferSameWarehouse: "Source and destination must be different.",
  transferDone: "Transfer completed.",
  transferQueued: "Transfer queued offline — will sync automatically.",
  transferRecent: "Recent transfers",
  transferEmpty: "No transfers yet.",
  transferOffline:
    "Offline — transfers will be queued and sync automatically.",
  transferWarehouseError:
    "Warehouses could not be loaded. Check your connection and try again.",
  transferListError: "Recent transfers could not be loaded right now.",
  alertsTitle: "Proactive AI Alerts",
  alertsSub: "Generated nightly by the AI engine from overnight analysis",
  alertsEmpty:
    "No alerts yet. Nightly insights will appear here automatically.",
  alertsMarkRead: "Dismiss",
  alertsUnread: "{count} new",
  alertHigh: "High",
  alertMedium: "Medium",
  alertLow: "Low",
};

export type Dict = Record<LangStrings, string>;

const ar: Dict = {
  appName: "StoreFlow",
  forbiddenTitle: "تم رفض الوصول",
  forbiddenDescription: "لا يملك دورك الحالي صلاحية الوصول إلى مساحة العمل هذه.",
  returnToWorkspace: "العودة إلى مساحة العمل",
  navDashboard: "لوحة التحكم",
  navPos: "نقطة البيع",
  navFinance: "المالية",
  navSettings: "الفواتير والاشتراك",
  navCore: "الأساسي",
  navInventory: "المخزون",
  navFinanceGroup: "المالية وتخطيط الموارد",
  navAnalyticsGroup: "التحليلات والذكاء الاصطناعي",
  navCatalog: "الكتالوج",
  navTransfers: "تحويلات المخزون",
  navWarehouses: "المستودعات",
  navSuppliers: "الموردون",
  navInvoices: "الفواتير",
  navReceivables: "الحسابات المدينة",
  navLedger: "دفتر الأستاذ العام",
  navExpenses: "المصروفات",
  navReports: "تقارير الأرباح والخسائر",
  navIntelligence: "مركز الذكاء",
  navForecasting: "التنبؤات",
  navPurchaseOrders: "أوامر الشراء التلقائية",
  selectCompany: "اختيار الشركة",
  mainStore: "المتجر الرئيسي",
  selectWarehouse: "اختيار المستودع",
  warehouse: "المستودع",
  currency: "العملة",
  toggleTheme: "تبديل المظهر",
  light: "فاتح",
  dark: "داكن",
  storeBadge: "المتجر #{id}",
  dashboardTagline:
    "إدارة منتجاتك ومبيعاتك ورؤى الذكاء الاصطناعي في مكان واحد.",
  statProducts: "إجمالي المنتجات",
  statStockValue: "إجمالي قيمة المخزون",
  statLowStock: "منتجات المخزون المنخفض",
  chartRevenue: "اتجاه المبيعات الشهرية",
  chartRevenueSub: "الإيرادات، آخر 6 أشهر",
  chartMargin: "هامش الربح",
  chartMarginSub: "هامش الربح الشهري %، آخر 6 أشهر",
  loadingAnalytics: "جارٍ تحميل التحليلات...",
  formAddProduct: "إضافة منتج جديد",
  formAddSub: "أضف منتجًا إلى الكتالوج الخاص بك لبدء تتبع المبيعات.",
  formName: "الاسم",
  formPrice: "السعر",
  formStock: "المخزون",
  formAdd: "إضافة منتج",
  formAdding: "جارٍ الإضافة...",
  tableProducts: "المنتجات",
  tableInCatalog: "{count} في الكتالوج",
  thProduct: "المنتج",
  thPrice: "السعر",
  thStock: "المخزون",
  thStatus: "الحالة",
  thValue: "القيمة",
  thActions: "إجراءات",
  statusIn: "متوفر",
  statusLow: "منخفض",
  statusOut: "نفد المخزون",
  loadingProducts: "جارٍ تحميل المنتجات...",
  noProducts: "لا توجد منتجات لهذا المتجر بعد. أضف أول منتج بالأعلى.",
  aiCopilot: "المساعد الذكي",
  copilotSub: "اسأل عن مبيعاتك ومخزونك",
  copilotPlaceholder: "اسأل المساعد...",
  copilotThinking: "المساعد يفكر...",
  copilotWelcome:
    "مرحبًا، أنا مساعد StoreFlow. اسألني مثلًا:",
  copilotError:
    "تعذر الوصول إلى المساعد الذكي. تحقق من مفتاح API وحاول مجددًا.",
  analystTitle: "المحلل التجاري الذكي",
  analystBadge: "جيميني",
  analystSub:
    "اسأل عن المخزون واتجاهات المبيعات وما يجب إعادة طلبه.",
  analystPlaceholder:
    "اسأل عن المخزون واتجاهات المبيعات وما يجب إعادة طلبه...",
  analyze: "تحليل",
  analyzing: "جارٍ التحليل...",
  insights: "الرؤى",
  recommendations: "التوصيات",
  errorPrefix: "خطأ",
  poTitle: "أمر شراء تلقائي",
  poSub: "أنشئ أمر شراء PDF قابل للتنزيل يغطي العناصر منخفضة المخزون.",
  poGenerate: "إنشاء PDF",
  poGenerating: "جارٍ التحضير...",
  poNoLowStock: "لا توجد عناصر منخفضة المخزون حاليًا.",
  poCount: "{count} عنصر منخفض المخزون",
  poTarget: "إعادة الطلب إلى {target}",
  poDocTitle: "أمر شراء",
  posTitle: "نقطة البيع",
  posSub: "دفع سريع متوافق مع الباركود",
  posSearch: "مسح أو بحث عن المنتجات...",
  posSearchHint:
    "اكتب اسم المنتج (أو امسح باركود) ثم اضغط Enter للإضافة إلى الطلب",
  posItems: "العناصر",
  posCart: "الطلب الحالي",
  posEmptyCart: "السلة فارغة. اضغط على منتج لإضافته.",
  posQty: "الكمية",
  posSubtotal: "الإجمالي",
  posPay: "إتمام البيع",
  posPaying: "جارٍ التسجيل...",
  posSuccess: "تم تسجيل البيع: {total}",
  posInsufficient: "المخزون غير كافٍ لـ \"{name}\"",
  posNoMatch: "لا يوجد منتج مطابق لـ \"{query}\"",
  settingsTitle: "الاشتراك والفواتير",
  settingsSub: "إدارة خطتك واستخدامك وفواتيرك عبر Lemon Squeezy.",
  currentPlanLabel: "الخطة الحالية",
  usageLabel: "الاستخدام هذا الشهر",
  planActive: "نشطة",
  starterName: "الأساسية",
  starterPrice: "مجاني",
  proName: "الاحترافية",
  proPrice: "$19/شهر",
  upGrade: "الترقية",
  manageBilling: "إدارة الفواتير",
  usageProducts: "المنتجات",
  usageTransactions: "معاملات نقطة البيع",
  usageInsights: "رؤى الذكاء الاصطناعي",
  ofPlan: "من {limit}",
  lsNotConfigured:
    "Lemon Squeezy غير مهيأ. اضبط LS_API_KEY وLS_STORE_ID وLS_PRO_VARIANT_ID لتفعيل الدفع.",
  checkoutError: "تعذر إنشاء نافذة الدفع. حاول مرة أخرى.",
  working: "جارٍ التنفيذ...",
  featStarter1: "50 منتجًا",
  featStarter2: "500 معاملة نقطة بيع / شهر",
  featStarter3: "تقارير أساسية",
  featPro1: "منتجات غير محدودة",
  featPro2: "معاملات نقطة بيع غير محدودة",
  featPro3: "محلل ذكي + مساعد",
  featPro4: "أوامر شراء وPDF تلقائية",
  posWarehouse: "المخزن",
  posOnline: "متصل",
  posOffline: "غير متصل",
  posSyncing: "مزامنة",
  offlineMode: "وضع عدم الاتصال",
  offlineBanner: "أنت غير متصل.",
  offlineNotice:
    "لا يزال الدفع متاحًا من النسخة المحلية. ستتم مزامنة المبيعات تلقائيًا عند إعادة الاتصال.",
  offlineUnavailable:
    "لا توجد نسخة محلية من الكتالوج. اتصل بالإنترنت مرة واحدة لتخزين المنتجات محليًا.",
  posQueued:
    "تم تسجيل البيع ووضعه في قائمة الانتظار. ستتم المزامنة تلقائيًا عند عودة الاتصال.",
  posQueuedHint: "البيع محفوظ محليًا وستتم مزامنته تلقائيًا.",
  syncPending: "{count} عملية بانتظار المزامنة ({state})",
  syncPendingShort: "{count} بانتظار",
  syncRejected: "فشلت مزامنة {kind}: {error}",
  transferTitle: "تحويلات المخزون",
  transferSub: "انقل المخزون بين المستودعات. كل عملية تحويل موثّقة ومتزامنة.",
  transferFrom: "من المستودع",
  transferTo: "إلى المستودع",
  transferProduct: "المنتج",
  transferQtyLabel: "الكمية",
  transferNote: "ملاحظة",
  transferNotePlaceholder: "ملاحظة اختيارية",
  transferSubmit: "تحويل",
  transferInvalid: "يرجى ملء جميع الحقول بكمية صحيحة.",
  transferSameWarehouse: "يجب أن يختلف المستودع المصدر عن الوجهة.",
  transferDone: "تم التحويل بنجاح.",
  transferQueued: "تمت إضافة التحويل محليًا — سيُزامَن تلقائيًا.",
  transferRecent: "أحدث التحويلات",
  transferEmpty: "لا توجد تحويلات بعد.",
  transferOffline:
    "وضع عدم الاتصال — ستُضاف التحويلات إلى قائمة الانتظار وتُزامَن تلقائيًا.",
  transferWarehouseError:
    "تعذر تحميل المستودعات. تحقق من الاتصال وحاول مجددًا.",
  transferListError: "تعذر تحميل أحدث التحويلات حاليًا.",
  alertsTitle: "تنبيهات الذكاء الاصطناعي",
  alertsSub: "تُنشأ ليلًا تلقائيًا من التحليل الليلي",
  alertsEmpty: "لا توجد تنبيهات بعد. ستظهر الرؤى الليلية هنا تلقائيًا.",
  alertsMarkRead: "إغلاق",
  alertsUnread: "{count} جديد",
  alertHigh: "عالٍ",
  alertMedium: "متوسط",
  alertLow: "منخفض",
};

export type DictKey = keyof typeof en | `auth.${keyof typeof enMessages.auth}`;
export type { CurrencyCode };

interface I18nContextValue {
  locale: Locale;
  currency: CurrencyCode;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: CurrencyCode) => void;
  t: (key: DictKey, params?: Record<string, string | number>) => string;
  money: (amountUsd: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

function getMessage(key: DictKey, locale: Locale): string {
  if (key.startsWith("auth.")) {
    const messageKey = key.slice(5) as keyof typeof enMessages.auth;
    return (locale === "ar" ? arMessages.auth : enMessages.auth)[messageKey];
  }
  return (locale === "ar" ? ar : en)[key as keyof typeof en];
}

const STORAGE_KEYS = {
  locale: "sf.locale",
  currency: "sf.currency",
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(STORAGE_KEYS.locale);
    const storedCurrency = window.localStorage.getItem(STORAGE_KEYS.currency);
    if (storedLocale === "en" || storedLocale === "ar") {
      setLocaleState(storedLocale);
    }
    if (CURRENCIES.includes(storedCurrency as CurrencyCode)) {
      setCurrencyState(storedCurrency as CurrencyCode);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEYS.locale, next);
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    window.localStorage.setItem(STORAGE_KEYS.currency, next);
  }, []);

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const dict: Dict = locale === "ar" ? ar : en;

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      currency,
      dir,
      setLocale,
      setCurrency,
      t: (key, params) => interpolate(getMessage(key, locale), params),
      money: (amountUsd) =>
        formatMoney(fromUsd(amountUsd, currency), currency, locale),
    }),
    [locale, currency, dir, setLocale, setCurrency, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { EXCHANGE_RATES };