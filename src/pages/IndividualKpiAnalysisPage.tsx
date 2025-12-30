// src/pages/IndividualKpiAnalysisPage.tsx
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// あなたの dashboard_api シートの CSV 公開 URL
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRqD0n1ft0DY9mS9N2_noPz5r9SmjRu0vRDsiRrjWmeh-pOdC7YKQIS-IvwdDpsf_lVu3PvdUTqwS-T/pub?output=csv";

// ====== CSV パース周り ======
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const rows = lines.map((line) => line.split(","));
  const header = rows[0] ?? [];
  const data = rows.slice(1);
  return { header, data };
}

const parseNumber = (value: any): number => {
  if (value == null) return 0;
  const v = String(value).replace(/,/g, "").trim();
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const parsePercent = (value: any): number => {
  if (value == null) return 0;
  const v = String(value).replace("%", "").trim();
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return n / 100;
};

// ====== 型定義 ======
type DashboardRow = {
  date: string;
  member: string;
  sales: number;
  expectedSales: number;
  lineLeads: number;
  callCount: number;
  inboundCount: number;
  appointments: number;
  applications: number;
  applyRate: number;
  contracts: number;
  contractRate: number;
  cancelCount: number;
  cancelRate: number;
};

// グラフがデータなしの時の予備
const fallbackTimelineData = [
  { date: "2025-01-01", actual: 3, target: 4 },
  { date: "2025-01-02", actual: 2, target: 3 },
  { date: "2025-01-03", actual: 5, target: 4 },
  { date: "2025-01-04", actual: 1, target: 3 },
  { date: "2025-01-05", actual: 4, target: 4 },
];

// ====== 月間目標値（仮）======
// ※あとでスプレッドシート側に「目標列」を作って、ここを連動させることもできます
const monthlyTargets = {
  actionCount: 100, // アクション数（仮）
  callCount: 70, // 架電
  inboundCount: 40, // 受電
  appointments: 20, // アポ
  applications: 15, // 申込
  sales: 10000000, // 売上（税抜）
};

const formatYen = (val: number) =>
  val.toLocaleString("ja-JP", { maximumFractionDigits: 0 });

const formatPercent = (val: number) =>
  (val * 100).toFixed(1).replace(/\.0$/, "") + "%";

// ====== メインコンポーネント ======
export const IndividualKpiAnalysisPage: React.FC = () => {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      const parsed = parseCsv(text);

      console.log("CSV 取得結果", parsed);

      const mapped: DashboardRow[] = parsed.data
        .filter((row) => row.length > 0 && row.some((v) => v !== ""))
        .map((row) => ({
          date: row[0] ?? "",
          member: row[1] ?? "",
          sales: parseNumber(row[2]),
          expectedSales: parseNumber(row[3]),
          lineLeads: parseNumber(row[4]),
          callCount: parseNumber(row[5]),
          inboundCount: parseNumber(row[6]),
          appointments: parseNumber(row[7]),
          applications: parseNumber(row[8]),
          applyRate: parsePercent(row[9]),
          contracts: parseNumber(row[10]),
          contractRate: parsePercent(row[11]),
          cancelCount: parseNumber(row[12]),
          cancelRate: parsePercent(row[13]),
        }));

      setRows(mapped);
      setLoading(false);
    };

    load();
  }, []);

  // ====== 集計 ======
  const timelineData =
    rows.length > 0
      ? rows.map((r) => ({
          date: r.date,
          actual: r.sales,
          target: r.expectedSales,
        }))
      : fallbackTimelineData;

  const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);
  const totalExpectedSales = rows.reduce(
    (sum, r) => sum + r.expectedSales,
    0
  );
  const totalLineLeads = rows.reduce((sum, r) => sum + r.lineLeads, 0);
  const totalCalls = rows.reduce((sum, r) => sum + r.callCount, 0);
  const totalInbound = rows.reduce((sum, r) => sum + r.inboundCount, 0);
  const totalAppointments = rows.reduce(
    (sum, r) => sum + r.appointments,
    0
  );
  const totalApplications = rows.reduce(
    (sum, r) => sum + r.applications,
    0
  );
  const totalContracts = rows.reduce(
    (sum, r) => sum + r.contracts,
    0
  );

  const overallApplyRate =
    totalAppointments === 0 ? 0 : totalApplications / totalAppointments;
  const overallContractRate =
    totalApplications === 0 ? 0 : totalContracts / totalApplications;

  // アクション数 = 架電 + 受電 + LINE流入（ざっくり）
  const totalActionCount =
    totalCalls + totalInbound + totalLineLeads;

  // ドーナツ用のデータ
  const donutMetrics = [
    {
      key: "action",
      label: "アクション数",
      value: totalActionCount,
      target: monthlyTargets.actionCount,
      unit: "件",
    },
    {
      key: "call",
      label: "架電数",
      value: totalCalls,
      target: monthlyTargets.callCount,
      unit: "件",
    },
    {
      key: "inbound",
      label: "受電数",
      value: totalInbound,
      target: monthlyTargets.inboundCount,
      unit: "件",
    },
    {
      key: "appointment",
      label: "アポ数",
      value: totalAppointments,
      target: monthlyTargets.appointments,
      unit: "件",
    },
    {
      key: "application",
      label: "申込数",
      value: totalApplications,
      target: monthlyTargets.applications,
      unit: "件",
    },
    {
      key: "sales",
      label: "売上（税抜）",
      value: totalSales,
      target: monthlyTargets.sales,
      unit: "円",
      isKgi: true,
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        データ読み込み中…
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui",
        backgroundColor: "#f5f7fb",
        minHeight: "100vh",
      }}
    >
      {/* タブっぽいヘッダー */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 16,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            paddingBottom: 8,
            borderBottom: "2px solid #2563eb",
            fontWeight: 600,
            fontSize: 14,
            color: "#2563eb",
          }}
        >
          比較（組織）
        </div>
        <div
          style={{
            paddingBottom: 8,
            fontSize: 14,
            color: "#9ca3af",
          }}
        >
          比較（施策）
        </div>
        <div
          style={{
            paddingBottom: 8,
            fontSize: 14,
            color: "#9ca3af",
          }}
        >
          詳細テーブル
        </div>
      </div>

      {/* 見出し */}
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        サマリー（当月）
      </h1>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 16,
        }}
      >
        data: dashboard_api シート連動
      </div>

      {/* 上段：ドーナツカード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {donutMetrics.map((m) => (
          <DonutCard
            key={m.key}
            label={m.label}
            value={m.value}
            target={m.target}
            unit={m.unit}
            isKgi={Boolean(m.isKgi)}
          />
        ))}
      </div>

      {/* 中段：売上タイムライン */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>売上タイムライン（売上 vs 見込み売上）</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            実績：売上 / 目標：見込み売上
          </span>
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={timelineData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                name="売上"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="target"
                name="見込み売上"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 下段：KPI サマリー表（1行だけの簡易版） */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          KPI サマリー（全体）
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 80px",
            rowGap: 12,
            columnGap: 12,
            fontSize: 12,
            alignItems: "center",
          }}
        >
          {donutMetrics.map((m) => {
            const rate =
              m.target === 0 ? 0 : Math.min(m.value / m.target, 2); // 200%で頭打ち
            const ratePercent =
              m.target === 0 ? "-" : formatPercent(m.value / m.target);
            return (
              <React.Fragment key={m.key}>
                {/* 指標名 */}
                <div style={{ fontWeight: 600 }}>{m.label}</div>

                {/* 棒グラフ（実績 / 目標） */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      実績:{" "}
                      {m.unit === "円"
                        ? "¥" + formatYen(m.value)
                        : `${m.value.toLocaleString()}${m.unit}`}
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      目標:{" "}
                      {m.unit === "円"
                        ? "¥" + formatYen(m.target)
                        : `${m.target.toLocaleString()}${m.unit}`}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: "#e5e7eb",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${Math.min(rate, 1) * 100}%`,
                        backgroundColor:
                          rate >= 1 ? "#2563eb" : "#ef4444",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* 達成率 */}
                <div
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color:
                      m.target !== 0 && m.value / m.target >= 1
                        ? "#2563eb"
                        : "#ef4444",
                  }}
                >
                  {ratePercent}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* CVR / 成約率の一言サマリー */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#4b5563",
            display: "flex",
            gap: 24,
          }}
        >
          <div>
            申込率（CVR）:{" "}
            <strong>{formatPercent(overallApplyRate)}</strong>
          </div>
          <div>
            成約率: <strong>{formatPercent(overallContractRate)}</strong>
          </div>
          <div style={{ color: "#9ca3af" }}>
            ※ CVR = 申込数 / アポ数, 成約率 = 成約数 / 申込数
          </div>
        </div>
      </div>
    </div>
  );
};

// ====== ドーナツカードのコンポーネント ======
type DonutCardProps = {
  label: string;
  value: number;
  target: number;
  unit: string;
  isKgi?: boolean;
};

const DonutCard: React.FC<DonutCardProps> = ({
  label,
  value,
  target,
  unit,
  isKgi,
}) => {
  const acheivement = target === 0 ? 0 : value / target;
  const acheivementPercent = target === 0 ? "-" : formatPercent(acheivement);

  const chartData = [
    { name: "達成", value: Math.max(value, 0) },
    { name: "残り", value: Math.max(target - value, 0) },
  ];

  const colors = isKgi
    ? ["#ef4444", "#fee2e2"] // KGI っぽく赤
    : ["#2563eb", "#dbeafe"]; // KPI っぽく青

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: 10,
        boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 4,
        }}
      >
        {label}
        {isKgi && (
          <span
            style={{
              marginLeft: 4,
              padding: "1px 4px",
              fontSize: 9,
              borderRadius: 4,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontWeight: 700,
            }}
          >
            KGI
          </span>
        )}
      </div>

      <div style={{ width: "100%", height: 90 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={24}
              outerRadius={36}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index] ?? "#e5e7eb"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {unit === "円"
          ? "¥" + formatYen(value)
          : `${value.toLocaleString()}${unit}`}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
        }}
      >
        目標:{" "}
        {unit === "円"
          ? "¥" + formatYen(target)
          : `${target.toLocaleString()}${unit}`}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: acheivement >= 1 ? "#2563eb" : "#ef4444",
        }}
      >
        達成率: {acheivementPercent}
      </div>
    </div>
  );
};
