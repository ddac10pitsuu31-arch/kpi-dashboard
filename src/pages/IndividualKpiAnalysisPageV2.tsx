import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// dashboard_api シートの CSV 公開 URL
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRqD0n1ft0DY9mS9N2_noPz5r9SmjRu0vRDsiRrjWmeh-pOdC7YKQIS-IvwdDpsf_lVu3PvdUTqwS-T/pub?output=csv";

const HIGH_RENT_THRESHOLD = 150000;
const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type CsvRecord = Record<string, string>;

type KpiRow = {
  memberName: string;
  inquiryProperty: string;
  decidedProperty: string;
  area: string;
  area2: string;
  inquiryRent: number;
  decidedRent: number;
  rentBand: string;
  lineAddedDate: string;
  serviceDate: string;
  applicationDate: string;
  paymentDate: string;
  keyHandoverDate: string;
  review: string;
  yearMonth: string;
};

type NamedValue = {
  name: string;
  value: number;
};

type MemberRankingRow = {
  memberName: string;
  applications: number;
  averageDecidedRent: number;
  highRentRate: number;
  averageLeadToServiceDays: number;
  averageServiceToApplicationDays: number;
  averageRentChange: number;
};

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  return rows.slice(1).map((values) =>
    headers.reduce<CsvRecord>((record, header, index) => {
      record[header] = values[index]?.trim() ?? "";
      return record;
    }, {})
  );
}

const getValue = (record: CsvRecord, key: string): string => record[key]?.trim() ?? "";

const parseNumber = (value: string): number => {
  const normalized = value.replace(/[¥￥,円\s]/g, "").trim();
  if (normalized === "") return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const parseDate = (value: string): Date | null => {
  const normalized = value.trim().replace(/\./g, "/").replace(/-/g, "/");
  if (!normalized) return null;

  const parts = normalized.split("/").map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const diffDays = (start: string, end: string): number | null => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  const diff = endDate.getTime() - startDate.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

const average = (values: number[]): number => {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
};

const formatYen = (value: number): string =>
  value.toLocaleString("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

const formatNumber = (value: number, digits = 1): string =>
  value.toLocaleString("ja-JP", { maximumFractionDigits: digits });

const formatPercent = (value: number): string => `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;

const toKpiRow = (record: CsvRecord): KpiRow => ({
  memberName: getValue(record, "メンバー名"),
  inquiryProperty: getValue(record, "問い物"),
  decidedProperty: getValue(record, "決め物"),
  area: getValue(record, "エリア"),
  area2: getValue(record, "エリア２"),
  inquiryRent: parseNumber(getValue(record, "問い物家賃")),
  decidedRent: parseNumber(getValue(record, "決め物家賃")),
  rentBand: getValue(record, "家賃帯"),
  lineAddedDate: getValue(record, "LINE追加日"),
  serviceDate: getValue(record, "接客日"),
  applicationDate: getValue(record, "申込日"),
  paymentDate: getValue(record, "入金日"),
  keyHandoverDate: getValue(record, "鍵渡し"),
  review: getValue(record, "口コミ"),
  yearMonth: getValue(record, "年月"),
});

const groupCount = (rows: KpiRow[], getKey: (row: KpiRow) => string): NamedValue[] => {
  const grouped = rows.reduce<Record<string, number>>((result, row) => {
    const key = getKey(row) || "未設定";
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const getAverageDays = (rows: KpiRow[], getStart: (row: KpiRow) => string, getEnd: (row: KpiRow) => string) =>
  average(
    rows
      .map((row) => diffDays(getStart(row), getEnd(row)))
      .filter((value): value is number => value !== null && value >= 0)
  );

const buildMemberRanking = (rows: KpiRow[]): MemberRankingRow[] => {
  const grouped = rows.reduce<Record<string, KpiRow[]>>((result, row) => {
    const key = row.memberName || "未設定";
    result[key] = [...(result[key] ?? []), row];
    return result;
  }, {});

  return Object.entries(grouped)
    .map(([memberName, memberRows]) => {
      const applicationRows = memberRows.filter((row) => row.applicationDate);
      const rentRows = memberRows.filter((row) => row.decidedRent > 0);
      const rentChanges = rentRows.map((row) => row.decidedRent - row.inquiryRent);

      return {
        memberName,
        applications: applicationRows.length,
        averageDecidedRent: average(rentRows.map((row) => row.decidedRent)),
        highRentRate: rentRows.length === 0 ? 0 : rentRows.filter((row) => row.decidedRent >= HIGH_RENT_THRESHOLD).length / rentRows.length,
        averageLeadToServiceDays: getAverageDays(memberRows, (row) => row.lineAddedDate, (row) => row.serviceDate),
        averageServiceToApplicationDays: getAverageDays(memberRows, (row) => row.serviceDate, (row) => row.applicationDate),
        averageRentChange: average(rentChanges),
      };
    })
    .sort((a, b) => b.applications - a.applications || b.averageDecidedRent - a.averageDecidedRent);
};

export const IndividualKpiAnalysisPageV2: React.FC = () => {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
          throw new Error(`CSV取得に失敗しました (${response.status})`);
        }
        const text = await response.text();
        setRows(parseCsv(text).map(toKpiRow));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "CSV取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const kpis = useMemo(() => {
    const applicationRows = rows.filter((row) => row.applicationDate);
    const decidedRentRows = rows.filter((row) => row.decidedRent > 0);
    const rentChanges = decidedRentRows.map((row) => row.decidedRent - row.inquiryRent);

    return {
      applicationCount: applicationRows.length,
      averageDecidedRent: average(decidedRentRows.map((row) => row.decidedRent)),
      highRentRate:
        decidedRentRows.length === 0
          ? 0
          : decidedRentRows.filter((row) => row.decidedRent >= HIGH_RENT_THRESHOLD).length / decidedRentRows.length,
      averageLeadToServiceDays: getAverageDays(rows, (row) => row.lineAddedDate, (row) => row.serviceDate),
      averageServiceToApplicationDays: getAverageDays(rows, (row) => row.serviceDate, (row) => row.applicationDate),
      averageRentChange: average(rentChanges),
      totalRentChange: rentChanges.reduce((sum, value) => sum + value, 0),
    };
  }, [rows]);

  const applicationRows = useMemo(() => rows.filter((row) => row.applicationDate), [rows]);
  const areaChartData = useMemo(() => groupCount(applicationRows, (row) => row.area2 || row.area), [applicationRows]);
  const rentBandChartData = useMemo(() => groupCount(applicationRows, (row) => row.rentBand), [applicationRows]);
  const memberRanking = useMemo(() => buildMemberRanking(rows), [rows]);
  const rentChangeByMonth = useMemo(() => {
    const grouped = rows.reduce<Record<string, number[]>>((result, row) => {
      if (!row.yearMonth || row.decidedRent <= 0) return result;
      result[row.yearMonth] = [...(result[row.yearMonth] ?? []), row.decidedRent - row.inquiryRent];
      return result;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, "ja"))
      .map(([yearMonth, values]) => ({ yearMonth, averageChange: Math.round(average(values)) }));
  }, [rows]);

  if (loading) {
    return <div style={styles.loading}>データ読み込み中…</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerTabs}>
        <div style={styles.activeTab}>営業KPI分析 V2</div>
        <div style={styles.inactiveTab}>比較（組織）</div>
        <div style={styles.inactiveTab}>詳細テーブル</div>
      </div>

      <div style={styles.titleRow}>
        <div>
          <h1 style={styles.title}>営業KPIダッシュボード</h1>
          <div style={styles.subtitle}>data: dashboard_api シート連動 / 申込日がある行を成約・申込として集計</div>
        </div>
        <div style={styles.badge}>対象データ {rows.length.toLocaleString()} 件</div>
      </div>

      {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

      <section style={styles.kpiGrid}>
        <KpiCard label="申込数" value={`${kpis.applicationCount.toLocaleString()}件`} note="申込日あり" tone="blue" />
        <KpiCard label="平均決め物家賃" value={formatYen(kpis.averageDecidedRent)} note="決め物家賃の平均" tone="green" />
        <KpiCard label="高単価率" value={formatPercent(kpis.highRentRate)} note="15万円以上" tone="amber" />
        <KpiCard label="LINE→接客" value={`${formatNumber(kpis.averageLeadToServiceDays)}日`} note="平均リードタイム" tone="purple" />
        <KpiCard label="接客→申込" value={`${formatNumber(kpis.averageServiceToApplicationDays)}日`} note="平均リードタイム" tone="cyan" />
        <KpiCard label="家賃増減" value={formatYen(kpis.averageRentChange)} note={`総額 ${formatYen(kpis.totalRentChange)}`} tone="red" />
      </section>

      <section style={styles.chartGrid}>
        <ChartPanel title="エリア別成約数" description="エリア２を優先し、未入力時はエリアで集計">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={areaChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="成約数" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="家賃帯別成約数" description="家賃帯列をもとに構成比を表示">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={rentBandChartData} dataKey="value" nameKey="name" outerRadius={92} label>
                {rentBandChartData.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="問い物家賃→決め物家賃の増減" description="年月別の平均増減額">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rentChangeByMonth} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}千`} />
              <Tooltip formatter={(value) => formatYen(Number(value))} />
              <Line type="monotone" dataKey="averageChange" name="平均増減" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>メンバー別ランキング</h2>
            <p style={styles.panelDescription}>申込数を主軸に、単価・高単価率・リードタイムを比較</p>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>順位</Th>
                <Th>メンバー名</Th>
                <Th align="right">申込数</Th>
                <Th align="right">平均決め物家賃</Th>
                <Th align="right">高単価率</Th>
                <Th align="right">LINE→接客</Th>
                <Th align="right">接客→申込</Th>
                <Th align="right">家賃増減</Th>
              </tr>
            </thead>
            <tbody>
              {memberRanking.map((member, index) => (
                <tr key={member.memberName}>
                  <Td>{index + 1}</Td>
                  <Td>{member.memberName}</Td>
                  <Td align="right">{member.applications.toLocaleString()}件</Td>
                  <Td align="right">{formatYen(member.averageDecidedRent)}</Td>
                  <Td align="right">{formatPercent(member.highRentRate)}</Td>
                  <Td align="right">{formatNumber(member.averageLeadToServiceDays)}日</Td>
                  <Td align="right">{formatNumber(member.averageServiceToApplicationDays)}日</Td>
                  <Td align="right">{formatYen(member.averageRentChange)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>詳細テーブル</h2>
            <p style={styles.panelDescription}>指定列をそのまま確認できる明細一覧</p>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["年月", "メンバー名", "問い物", "決め物", "エリア", "エリア２", "問い物家賃", "決め物家賃", "家賃帯", "LINE追加日", "接客日", "申込日", "入金日", "鍵渡し", "口コミ"].map((header) => (
                  <Th key={header}>{header}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.memberName}-${row.applicationDate}-${index}`}>
                  <Td>{row.yearMonth}</Td>
                  <Td>{row.memberName}</Td>
                  <Td>{row.inquiryProperty}</Td>
                  <Td>{row.decidedProperty}</Td>
                  <Td>{row.area}</Td>
                  <Td>{row.area2}</Td>
                  <Td>{row.inquiryRent ? formatYen(row.inquiryRent) : ""}</Td>
                  <Td>{row.decidedRent ? formatYen(row.decidedRent) : ""}</Td>
                  <Td>{row.rentBand}</Td>
                  <Td>{row.lineAddedDate}</Td>
                  <Td>{row.serviceDate}</Td>
                  <Td>{row.applicationDate}</Td>
                  <Td>{row.paymentDate}</Td>
                  <Td>{row.keyHandoverDate}</Td>
                  <Td>{row.review}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

type KpiCardProps = {
  label: string;
  value: string;
  note: string;
  tone: "blue" | "green" | "amber" | "purple" | "cyan" | "red";
};

const toneColor: Record<KpiCardProps["tone"], string> = {
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  purple: "#7c3aed",
  cyan: "#0891b2",
  red: "#dc2626",
};

const KpiCard: React.FC<KpiCardProps> = ({ label, value, note, tone }) => (
  <div style={{ ...styles.kpiCard, borderTop: `4px solid ${toneColor[tone]}` }}>
    <div style={styles.kpiLabel}>{label}</div>
    <div style={{ ...styles.kpiValue, color: toneColor[tone] }}>{value}</div>
    <div style={styles.kpiNote}>{note}</div>
  </div>
);

type ChartPanelProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

const ChartPanel: React.FC<ChartPanelProps> = ({ title, description, children }) => (
  <div style={styles.panel}>
    <div style={styles.panelHeader}>
      <div>
        <h2 style={styles.panelTitle}>{title}</h2>
        <p style={styles.panelDescription}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

type CellProps = {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
};

const Th: React.FC<CellProps> = ({ children, align = "left" }) => (
  <th style={{ ...styles.th, textAlign: align }}>{children}</th>
);

const Td: React.FC<CellProps> = ({ children, align = "left" }) => (
  <td style={{ ...styles.td, textAlign: align }}>{children}</td>
);

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    backgroundColor: "#f5f7fb",
    color: "#111827",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  loading: {
    padding: 24,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  headerTabs: {
    display: "flex",
    gap: 24,
    marginBottom: 16,
    borderBottom: "1px solid #e5e7eb",
  },
  activeTab: {
    paddingBottom: 8,
    borderBottom: "2px solid #2563eb",
    color: "#2563eb",
    fontSize: 14,
    fontWeight: 700,
  },
  inactiveTab: {
    paddingBottom: 8,
    color: "#9ca3af",
    fontSize: 14,
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    margin: "0 0 4px",
    fontSize: 22,
    fontWeight: 800,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 12,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  errorBox: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontSize: 13,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
  },
  kpiLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 6,
  },
  kpiNote: {
    color: "#9ca3af",
    fontSize: 11,
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
    marginBottom: 24,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
  },
  panelDescription: {
    margin: "4px 0 0",
    color: "#9ca3af",
    fontSize: 12,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  th: {
    padding: "10px 8px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    fontWeight: 800,
  },
  td: {
    padding: "9px 8px",
    borderBottom: "1px solid #f3f4f6",
    color: "#111827",
  },
};

export default IndividualKpiAnalysisPageV2;
