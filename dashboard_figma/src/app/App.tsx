import { useState, useRef, useEffect, useCallback } from "react";
import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AIResult,
  ImageEntry,
  ImageStatus,
} from "./types";
import { ApiError, createInspection, listAlerts } from "./api";
import MapView, { MapViewHandle } from "./components/MapView";
import {
  Globe,
  BarChart2,
  Bell,
  Settings,
  Upload,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  ShieldCheck,
  Activity,
  ImageIcon,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { clsx } from "clsx";

// ─── Data ─────────────────────────────────────────────────────────────────────

const hourlyData = [
  { time: "00h", eventos: 12, alertas: 2 },
  { time: "02h", eventos: 8, alertas: 1 },
  { time: "04h", eventos: 5, alertas: 0 },
  { time: "06h", eventos: 19, alertas: 3 },
  { time: "08h", eventos: 34, alertas: 5 },
  { time: "10h", eventos: 41, alertas: 4 },
  { time: "12h", eventos: 38, alertas: 6 },
  { time: "14h", eventos: 52, alertas: 8 },
  { time: "16h", eventos: 47, alertas: 7 },
  { time: "18h", eventos: 39, alertas: 5 },
  { time: "20h", eventos: 28, alertas: 3 },
  { time: "22h", eventos: 21, alertas: 2 },
];

const regionData = [
  { regiao: "Norte", eventos: 124 },
  { regiao: "Sul", eventos: 89 },
  { regiao: "Leste", eventos: 203 },
  { regiao: "Oeste", eventos: 156 },
  { regiao: "Centro", eventos: 312 },
];

const severityConfig = {
  high: {
    color: "text-red-400",
    bg: "bg-red-500/5 border-red-500/25",
    dot: "bg-red-400",
    label: "Alto",
  },
  medium: {
    color: "text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/25",
    dot: "bg-amber-400",
    label: "Médio",
  },
  low: {
    color: "text-cyan-400",
    bg: "bg-cyan-500/5 border-cyan-500/20",
    dot: "bg-cyan-400",
    label: "Baixo",
  },
};

const statusConfig = {
  ativo: { color: "text-red-400", label: "Ativo" },
  resolvido: { color: "text-green-400", label: "Resolvido" },
  investigando: { color: "text-amber-400", label: "Investigando" },
  pendente: { color: "text-muted-foreground", label: "Pendente" },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "mapa" | "analise" | "alertas" | "imagens" | "configuracoes";

const tabs: { id: Tab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "mapa", label: "Mapa", Icon: Globe },
  { id: "analise", label: "Análise", Icon: BarChart2 },
  { id: "alertas", label: "Alertas", Icon: Bell },
  { id: "imagens", label: "Imagens", Icon: ImageIcon },
  { id: "configuracoes", label: "Configurações", Icon: Settings },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  unit,
  trend,
  delta,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  delta?: string;
}) {
  return (
    <div className="bg-card border border-border p-4 flex flex-col gap-1 hover:border-primary/20 transition-colors">
      <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-foreground text-2xl font-mono font-medium tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-muted-foreground text-sm font-mono mb-0.5">
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div className="flex items-center gap-1 mt-0.5">
          {trend === "up" && <TrendingUp size={11} className="text-primary" />}
          {trend === "down" && (
            <TrendingDown size={11} className="text-destructive" />
          )}
          {trend === "flat" && (
            <Minus size={11} className="text-muted-foreground" />
          )}
          <span
            className={clsx(
              "text-[10px] font-mono",
              trend === "up"
                ? "text-primary"
                : trend === "down"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {delta}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────

function MapTab({
  alerts,
  images,
  mapRef,
}: {
  alerts: Alert[];
  images: ImageEntry[];
  mapRef: React.RefObject<MapViewHandle | null>;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <MapView ref={mapRef} alerts={alerts} images={images} />

      <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur border border-border px-3 py-2">
        <div className="flex items-center gap-2 text-primary text-[11px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          MAPA ATIVO
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: "#0b0f18",
    border: "1px solid rgba(34,211,238,0.15)",
    borderRadius: 0,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "#dde6f0",
  },
  labelStyle: { color: "#dde6f0" },
  itemStyle: { color: "#526070" },
};

function AnalyticsTab() {
  return (
    <div className="p-5 space-y-5 h-full overflow-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Total de Eventos"
          value="884"
          trend="up"
          delta="+12.4% hoje"
        />
        <StatTile
          label="Alertas Ativos"
          value="4"
          trend="up"
          delta="+2 última hora"
        />
        <StatTile
          label="Zonas Monitoradas"
          value="38"
          unit="zonas"
          trend="flat"
          delta="sem alteração"
        />
        <StatTile
          label="Tempo Online"
          value="99.7"
          unit="%"
          trend="flat"
          delta="30 dias"
        />
      </div>

      <div className="bg-card border border-border p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-foreground font-mono text-xs font-medium uppercase tracking-widest">
              Eventos por Hora — Últimas 24h
            </h3>
            <p className="text-muted-foreground font-mono text-[10px] mt-0.5">
              Detecções e alertas gerados no período
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-0.5 bg-cyan-400 inline-block" />
              Eventos
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-0.5 bg-amber-400 inline-block" />
              Alertas
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart
            data={hourlyData}
            margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id="gEvt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAlt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke="rgba(34,211,238,0.06)"
            />
            <XAxis
              dataKey="time"
              tick={{
                fill: "#526070",
                fontSize: 10,
                fontFamily: "JetBrains Mono",
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{
                fill: "#526070",
                fontSize: 10,
                fontFamily: "JetBrains Mono",
              }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              {...tooltipStyle}
              cursor={{ stroke: "rgba(34,211,238,0.12)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="eventos"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill="url(#gEvt)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="alertas"
              stroke="#f59e0b"
              strokeWidth={1.5}
              fill="url(#gAlt)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border p-5">
        <div className="mb-5">
          <h3 className="text-foreground font-mono text-xs font-medium uppercase tracking-widest">
            Distribuição por Região
          </h3>
          <p className="text-muted-foreground font-mono text-[10px] mt-0.5">
            Eventos acumulados por área geográfica
          </p>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart
            data={regionData}
            margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid
              strokeDasharray="2 6"
              stroke="rgba(34,211,238,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="regiao"
              tick={{
                fill: "#526070",
                fontSize: 10,
                fontFamily: "JetBrains Mono",
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{
                fill: "#526070",
                fontSize: 10,
                fontFamily: "JetBrains Mono",
              }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "rgba(34,211,238,0.04)" }}
            />
            <Bar
              dataKey="eventos"
              fill="#22d3ee"
              fillOpacity={0.6}
              radius={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab({
  alerts,
  onUpdateStatus,
  onViewOnMap,
  onClearAll,
}: {
  alerts: Alert[];
  onUpdateStatus: (id: string, status: AlertStatus) => void;
  onViewOnMap: (alert: Alert) => void;
  onClearAll: () => void;
}) {
  const [filter, setFilter] = useState<"todos" | "high" | "medium" | "low">(
    "todos",
  );

  const filtered = alerts.filter(
    (a) => filter === "todos" || a.severity === filter,
  );

  const activeHigh = alerts.filter(
    (a) => a.severity === "high" && a.status === "ativo",
  ).length;

  const activeMed = alerts.filter(
    (a) => a.severity === "medium" && a.status === "ativo",
  ).length;

  return (
    <div className="p-5 space-y-5 h-full overflow-auto">
      {/* ── Resumo ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/5 border border-red-500/20 p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Críticos Ativos
          </div>

          <div className="text-3xl font-mono text-red-400 tabular-nums">
            {activeHigh}
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Médios Ativos
          </div>

          <div className="text-3xl font-mono text-amber-400 tabular-nums">
            {activeMed}
          </div>
        </div>

        <div className="bg-card border border-border p-4">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Total Hoje
          </div>

          <div className="text-3xl font-mono text-foreground tabular-nums">
            {alerts.length}
          </div>
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["todos", "high", "medium", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border transition-colors",
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/60",
              )}
            >
              {f === "todos"
                ? "Todos"
                : f === "high"
                  ? "Alto"
                  : f === "medium"
                    ? "Médio"
                    : "Baixo"}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (alerts.length === 0) return;

            const confirmar = window.confirm(
              "Tem certeza que deseja limpar todos os alertas?",
            );

            if (confirmar) {
              onClearAll();
            }
          }}
          disabled={alerts.length === 0}
          className={clsx(
            "px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border transition-colors",
            alerts.length > 0
              ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
              : "border-border text-muted-foreground/30 cursor-not-allowed",
          )}
        >
          Limpar alertas
        </button>
      </div>

      {/* ── Lista de alertas ───────────────────────────────────── */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center">
            <div className="text-sm font-mono text-muted-foreground">
              Nenhum alerta registrado
            </div>

            <div className="text-[10px] font-mono text-muted-foreground/50 mt-1">
              Os alertas gerados pelas análises aparecerão aqui.
            </div>
          </div>
        ) : (
          filtered.map((alert) => {
            const sev =
              severityConfig[alert.severity as keyof typeof severityConfig];

            const sts = statusConfig[alert.status as keyof typeof statusConfig];

            const possuiCoordenadas =
              typeof alert.latitude === "number" &&
              typeof alert.longitude === "number";

            return (
              <div
                key={alert.id}
                className={clsx(
                  "border p-4 transition-colors hover:bg-white/[0.015] cursor-default",
                  sev.bg,
                )}
              >
                {/* Cabeçalho do alerta */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                        sev.dot,
                      )}
                    />

                    <div className="min-w-0">
                      <div className="text-sm font-sans text-foreground leading-snug">
                        {alert.title}
                      </div>

                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {alert.location}

                        {alert.imageId && (
                          <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">
                            Origem: {alert.imageId}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className={clsx("text-xs font-mono", sts.color)}>
                      {sts.label}
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5 tabular-nums">
                      {alert.time}
                    </div>
                  </div>
                </div>

                {/* ID e severidade */}
                <div className="flex items-center gap-2 mt-2 ml-4">
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {alert.id}
                  </span>

                  <span className={clsx("text-[10px] font-mono", sev.color)}>
                    · {sev.label}
                  </span>

                  {alert.confianca !== undefined && (
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      · IA {(alert.confianca * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 mt-3 ml-4 flex-wrap">
                  {alert.status === "ativo" && (
                    <button
                      onClick={() => onUpdateStatus(alert.id, "investigando")}
                      className="px-2.5 py-1.5 text-[10px] font-mono border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      Investigar
                    </button>
                  )}

                  {alert.status === "investigando" && (
                    <button
                      onClick={() => onUpdateStatus(alert.id, "resolvido")}
                      className="px-2.5 py-1.5 text-[10px] font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                    >
                      Resolver
                    </button>
                  )}

                  {alert.status === "pendente" && (
                    <button
                      onClick={() => onUpdateStatus(alert.id, "ativo")}
                      className="px-2.5 py-1.5 text-[10px] font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Ativar
                    </button>
                  )}

                  {possuiCoordenadas && (
                    <button
                      onClick={() => onViewOnMap(alert)}
                      className="px-2.5 py-1.5 text-[10px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      Ver no mapa
                    </button>
                  )}
                </div>

                {/* Coordenadas */}
                {possuiCoordenadas && (
                  <div className="mt-3 ml-4 text-[10px] font-mono text-muted-foreground/50">
                    Lat: {alert.latitude!.toFixed(6)} · Lon:{" "}
                    {alert.longitude!.toFixed(6)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  onMapUrlChange,
}: {
  onMapUrlChange: (url: string) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refreshInterval, setRefreshInterval] = useState("30");
  const [notifications, setNotifications] = useState({
    high: true,
    medium: true,
    low: false,
  });
  const [saved, setSaved] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onMapUrlChange(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onMapUrlChange(urlInput.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="p-5 max-w-xl space-y-8 h-full overflow-auto">
      {saved && (
        <div className="flex items-center gap-2 text-green-400 text-xs font-mono bg-green-500/10 border border-green-500/20 px-3 py-2">
          <CheckCircle size={12} />
          Configurações aplicadas — redirecionando para o mapa
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h3 className="text-foreground font-mono text-xs font-medium uppercase tracking-widest mb-0.5">
            Fonte do Mapa
          </h3>
          <p className="text-muted-foreground font-mono text-[11px]">
            Arquivo HTML ou URL do mapa a exibir
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
            Arquivo HTML
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="border border-border bg-card hover:border-primary/30 transition-colors px-4 py-2.5 text-sm font-mono text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <Upload size={13} />
            Selecionar arquivo...
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        <form onSubmit={handleUrlSubmit} className="space-y-1">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
            URL do Mapa
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/mapa.html"
              className="flex-1 bg-card border border-border px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2.5 text-sm font-mono hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </form>
      </section>

      <div className="h-px bg-border" />

      <section className="space-y-4">
        <div>
          <h3 className="text-foreground font-mono text-xs font-medium uppercase tracking-widest mb-0.5">
            Intervalo de Atualização
          </h3>
          <p className="text-muted-foreground font-mono text-[11px]">
            Com que frequência os dados são atualizados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["15", "30", "60", "300"].map((v) => (
            <button
              key={v}
              onClick={() => setRefreshInterval(v)}
              className={clsx(
                "px-4 py-2 text-sm font-mono border transition-colors",
                refreshInterval === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground",
              )}
            >
              {v === "300" ? "5 min" : `${v}s`}
            </button>
          ))}
        </div>
      </section>

      <div className="h-px bg-border" />

      <section className="space-y-4">
        <div>
          <h3 className="text-foreground font-mono text-xs font-medium uppercase tracking-widest mb-0.5">
            Notificações de Alerta
          </h3>
          <p className="text-muted-foreground font-mono text-[11px]">
            Defina quais severidades acionam notificações
          </p>
        </div>
        <div className="space-y-3">
          {[
            {
              key: "high" as const,
              label: "Severidade Alta",
              color: "text-red-400",
            },
            {
              key: "medium" as const,
              label: "Severidade Média",
              color: "text-amber-400",
            },
            {
              key: "low" as const,
              label: "Severidade Baixa",
              color: "text-cyan-400",
            },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between">
              <span className={clsx("text-sm font-mono", color)}>{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={notifications[key]}
                onClick={() =>
                  setNotifications((n) => ({ ...n, [key]: !n[key] }))
                }
                className={clsx(
                  "w-9 h-5 border transition-colors relative flex items-center px-0.5",
                  notifications[key]
                    ? "bg-primary/15 border-primary/50"
                    : "bg-muted border-border",
                )}
              >
                <div
                  className={clsx(
                    "w-3.5 h-3.5 transition-transform",
                    notifications[key]
                      ? "translate-x-4 bg-primary"
                      : "translate-x-0 bg-muted-foreground/50",
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Images Tab ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function LightboxModal({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: ImageEntry[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = images[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1"
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 text-muted-foreground hover:text-foreground transition-colors p-2 border border-border bg-card/60 backdrop-blur"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors p-2 border border-border bg-card/60 backdrop-blur"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      <div
        className="flex flex-col items-center gap-4 max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={img.url}
          alt={img.name}
          className="max-w-full max-h-[80vh] object-contain"
          style={{ imageRendering: "auto" }}
        />
        <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground">{img.name}</span>
          <span>·</span>
          <span>
            {img.width} × {img.height}px
          </span>
          <span>·</span>
          <span>{formatBytes(img.size)}</span>
          <span>·</span>
          <span>
            {index + 1} / {images.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function classificacaoParaSeveridade(
  classificacao: AIResult["classificacao"],
): AlertSeverity {
  if (classificacao === "alta") return "high";
  if (classificacao === "media") return "medium";
  return "low";
}

function tituloDaClassificacao(classificacao: AIResult["classificacao"]) {
  if (classificacao === "alta") {
    return "Vegetação crítica detectada";
  }

  if (classificacao === "media") {
    return "Vegetação acima do padrão";
  }

  return "Vegetação dentro do padrão";
}

// ─── Images Storage Tab ───────────────────────────────────────────────────────────────

// Rodovias disponíveis para o usuário indicar onde a imagem foi capturada.
// Cada imagem enviada é marcada exatamente no ponto de referência da rodovia
// escolhida no popup de upload.
interface RoadLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  reference: string;
}

const ROAD_LOCATIONS: RoadLocation[] = [
  {
    id: "presidente-dutra",
    label: "Presidente Dutra (BR-116)",
    latitude: -23.2235,
    longitude: -45.9005,
    reference: "São José dos Campos",
  },
  {
    id: "rodoanel-mario-covas",
    label: "Rodoanel Mário Covas (SP-021)",
    latitude: -23.546,
    longitude: -46.835,
    reference: "Trecho oeste",
  },
  {
    id: "rodovia-bandeirantes",
    label: "Rodovia dos Bandeirantes (SP-348)",
    latitude: -23.185,
    longitude: -46.884,
    reference: "Região de Jundiaí",
  },
  {
    id: "rodovia-anhanguera",
    label: "Rodovia Anhanguera (SP-330)",
    latitude: -23.18,
    longitude: -46.87,
    reference: "Região de Jundiaí",
  },
];

// [longitude, latitude], igual ao formato de coordenadas do GeoJSON.
type GeoPoint = [number, number];

// Mesmos arquivos GeoJSON desenhados no mapa (ver MapView.tsx) — usados aqui
// só para sortear um ponto que caia em cima do traçado real da rodovia.
const ROAD_GEOJSON_FILES: Record<string, string> = {
  "presidente-dutra": "/geojson/via_dutra.geojson",
  "rodoanel-mario-covas": "/geojson/rodoanel_rocada.geojson",
  "rodovia-bandeirantes": "/geojson/autoban.geojson",
  "rodovia-anhanguera": "/geojson/autoban.geojson",
};

function centroideDoAnel(anel: number[][] | undefined): GeoPoint | null {
  if (!anel || anel.length === 0) return null;

  let somaLon = 0;
  let somaLat = 0;

  for (const [lon, lat] of anel) {
    somaLon += lon;
    somaLat += lat;
  }

  return [somaLon / anel.length, somaLat / anel.length];
}

// Extrai, de um GeoJSON já carregado, os pontos pertencentes à rodovia
// indicada — usados para sortear onde a imagem aparece no mapa, sempre em
// cima do traçado real desenhado (ver MapView).
function extrairPontosDaRodovia(roadId: string, geojson: any): GeoPoint[] {
  const features: any[] = geojson?.features ?? [];

  if (roadId === "presidente-dutra") {
    return features
      .filter((feature) => feature.properties?.sg_uf === "SP")
      .flatMap((feature) => feature.geometry?.coordinates ?? []);
  }

  if (roadId === "rodoanel-mario-covas") {
    return features
      .map((feature) => centroideDoAnel(feature.geometry?.coordinates?.[0]))
      .filter((ponto): ponto is GeoPoint => ponto !== null);
  }

  if (roadId === "rodovia-bandeirantes") {
    return features
      .filter((feature) => feature.properties?.rodovia === "SP-348")
      .flatMap((feature) => feature.geometry?.coordinates ?? []);
  }

  if (roadId === "rodovia-anhanguera") {
    return features
      .filter((feature) => feature.properties?.rodovia === "SP-330")
      .flatMap((feature) => feature.geometry?.coordinates ?? []);
  }

  return [];
}

// Sorteia uma coordenada dentro dos pontos reais da rodovia (linha/polígonos
// do GeoJSON). Se o GeoJSON ainda não carregou ou não tiver pontos, cai no
// ponto de referência fixo da rodovia como fallback.
function sortearCoordenadaDaRodovia(
  location: RoadLocation,
  pontos: GeoPoint[] | undefined,
): { latitude: number; longitude: number } {
  if (pontos && pontos.length > 0) {
    const [longitude, latitude] = pontos[Math.floor(Math.random() * pontos.length)];
    return { latitude, longitude };
  }

  return { latitude: location.latitude, longitude: location.longitude };
}

const STORAGE_KEYS = {
  images: "motiva_imagens",
  analyses: "motiva_analises",
  alerts: "motiva_alertas",
  imageSequence: "motiva_image_sequence",
};

function carregarStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);

    if (!data) {
      return fallback;
    }

    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);

    return fallback;
  }
}

function salvarStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // Cota do localStorage estourada (comum ao guardar imagens em base64) —
    // não deve derrubar o fluxo de análise, só perde a persistência local.
    console.warn(`Não foi possível salvar "${key}" no localStorage:`, error);
  }
}

function gerarIdImagem(): string {
  const atual = Number(localStorage.getItem(STORAGE_KEYS.imageSequence) || "1");

  localStorage.setItem(STORAGE_KEYS.imageSequence, String(atual + 1));

  return `IMG-${String(atual).padStart(6, "0")}`;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────

function arquivoParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível converter a imagem."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo da imagem."));
    };

    reader.readAsDataURL(file);
  });
}

function carregarImagensSalvas(): ImageEntry[] {
  const registros = carregarStorage<any[]>(STORAGE_KEYS.images, []);

  return registros.map((imagem) => ({
    id: imagem.id,
    url: imagem.dataUrl,
    dataUrl: imagem.dataUrl,
    name: imagem.arquivo,
    size: imagem.size ?? 0,
    width: imagem.width ?? 0,
    height: imagem.height ?? 0,
    status: imagem.status,
    latitude: imagem.latitude,
    longitude: imagem.longitude,
    rodovia: imagem.rodovia,
    aiResult: imagem.aiResult,
    error: imagem.error,
  }));
}

function ImagesTab({
  images,
  setImages,
  onAlertCreated,
}: {
  images: ImageEntry[];
  setImages: React.Dispatch<React.SetStateAction<ImageEntry[]>>;
  onAlertCreated: (alert: Alert) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRoadRef = useRef<RoadLocation | null>(null);
  const pendingDropFilesRef = useRef<File[] | null>(null);
  const roadPointsRef = useRef<Record<string, GeoPoint[]>>({});

  // Carrega, uma vez, os mesmos GeoJSON das rodovias exibidos no mapa, para
  // sortear coordenadas que caiam em cima do traçado real de cada rodovia.
  useEffect(() => {
    let cancelado = false;

    async function carregarPontosDasRodovias() {
      const urls = Array.from(new Set(Object.values(ROAD_GEOJSON_FILES)));

      try {
        const respostas = await Promise.all(
          urls.map((url) => fetch(url).then((resposta) => resposta.json())),
        );

        if (cancelado) return;

        const geojsonPorUrl = new Map(urls.map((url, i) => [url, respostas[i]]));

        const pontosPorRodovia: Record<string, GeoPoint[]> = {};

        for (const location of ROAD_LOCATIONS) {
          const geojson = geojsonPorUrl.get(ROAD_GEOJSON_FILES[location.id]);
          pontosPorRodovia[location.id] = extrairPontosDaRodovia(
            location.id,
            geojson,
          );
        }

        roadPointsRef.current = pontosPorRodovia;
      } catch (error) {
        console.error("Erro ao carregar coordenadas das rodovias:", error);
      }
    }

    carregarPontosDasRodovias();

    return () => {
      cancelado = true;
    };
  }, []);

  const loadFiles = useCallback(async (files: File[], location: RoadLocation) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    for (const file of imageFiles) {
      const id = gerarIdImagem();

      const url = URL.createObjectURL(file);

      const img = new Image();

      img.onload = async () => {
        // Primeiro adicionamos a imagem como "analisando"
        setImages((prev) => [
          ...prev,
          {
            id,
            url,
            name: file.name,
            size: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
            status: "processando_ia",
            rodovia: location.label,
          },
        ]);

        try {
          // Coordenada sorteada em cima do traçado real (GeoJSON) da rodovia
          // escolhida pelo usuário no popup de upload, para a imagem cair
          // dentro da linha da rodovia no mapa.
          const { latitude, longitude } = sortearCoordenadaDaRodovia(
            location,
            roadPointsRef.current[location.id],
          );

          // ============================================================
          // SALVAR IMAGEM NO BANCO SIMULADO
          // ============================================================

          const dataUrl = await arquivoParaDataUrl(file);

          const registroImagem = {
            id,
            arquivo: file.name,
            dataUrl,
            size: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
            latitude,
            longitude,
            rodovia: location.label,
            status: "processando_ia",
            dataUpload: new Date().toISOString(),
          };

          const imagensSalvas = carregarStorage(STORAGE_KEYS.images, []);

          salvarStorage(STORAGE_KEYS.images, [
            ...imagensSalvas,
            registroImagem,
          ]);

          // ============================================================
          // ATUALIZAR INTERFACE
          // ============================================================

          setImages((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "processando_ia",
                    latitude,
                    longitude,
                  }
                : item,
            ),
          );

          // Análise real: envia a imagem para a API e aguarda o resultado do modelo
          try {
            const resultado = await createInspection(dataUrl, latitude, longitude);

            const aiResult: AIResult = {
              classificacao: resultado.classificacao,
              confianca: resultado.confianca,
            };

            const imagensAtuais = carregarStorage(STORAGE_KEYS.images, []);

            const imagensAtualizadas = imagensAtuais.map((imagem: any) =>
              imagem.id === id
                ? {
                    ...imagem,
                    status: "analisada",
                    aiResult,
                  }
                : imagem,
            );

            salvarStorage(STORAGE_KEYS.images, imagensAtualizadas);

            const analise = {
              imageId: id,
              classificacao: resultado.classificacao,
              confianca: resultado.confianca,
              dataAnalise: new Date().toISOString(),
            };

            // ============================================================
            // ATUALIZAR A IMAGEM NA INTERFACE
            // ============================================================

            setImages((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: "analisada",
                      aiResult,
                    }
                  : item,
              ),
            );

            const analises = carregarStorage(STORAGE_KEYS.analyses, []);

            salvarStorage(STORAGE_KEYS.analyses, [...analises, analise]);

            // ============================================================
            // CRIAR ALERTA
            // ============================================================

            const severity = classificacaoParaSeveridade(
              resultado.classificacao,
            );

            const novoAlerta: Alert = {
              id: `ALT-${resultado.img_num.replace("IMG-", "")}`,

              severity,

              title: tituloDaClassificacao(resultado.classificacao),

              location: `${location.label} — Imagem ${resultado.img_num}`,

              time: resultado.created_at
                ? new Date(resultado.created_at).toLocaleTimeString("pt-BR", {
                    hour12: false,
                  })
                : new Date().toLocaleTimeString("pt-BR", { hour12: false }),

              status: severity === "low" ? "pendente" : "ativo",

              imageId: id,

              latitude,

              longitude,

              rodovia: location.label,

              confianca: resultado.confianca,
            };

            onAlertCreated(novoAlerta);
          } catch (analiseError) {
            const mensagem =
              analiseError instanceof ApiError
                ? analiseError.detail
                : "Erro inesperado ao analisar a imagem.";

            console.error(`Erro ao analisar a imagem ${id}:`, analiseError);

            setImages((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: "erro",
                      error: mensagem,
                    }
                  : item,
              ),
            );
          }
        } catch (error) {
          console.error(`Erro ao processar a imagem ${id}:`, error);

          setImages((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "erro",
                    error: "Ocorreu um erro ao processar a imagem.",
                  }
                : item,
            ),
          );
        }
      };

      img.onerror = () => {
        setImages((prev) => [
          ...prev,
          {
            id,
            url,
            name: file.name,
            size: file.size,
            width: 0,
            height: 0,
            status: "erro",
            error: "Não foi possível carregar a imagem.",
          },
        ]);
      };

      img.src = url;
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const location = pendingRoadRef.current;
    pendingRoadRef.current = null;
    if (e.target.files && location) loadFiles(Array.from(e.target.files), location);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length === 0) return;
    pendingDropFilesRef.current = files;
    setLocationPickerOpen(true);
  };

  const openUploadDialog = () => {
    pendingDropFilesRef.current = null;
    setLocationPickerOpen(true);
  };

  const handleSelectLocation = (location: RoadLocation) => {
    setLocationPickerOpen(false);

    const droppedFiles = pendingDropFilesRef.current;
    pendingDropFilesRef.current = null;

    if (droppedFiles) {
      loadFiles(droppedFiles, location);
    } else {
      pendingRoadRef.current = location;
      fileInputRef.current?.click();
    }
  };

  const cancelLocationPicker = () => {
    setLocationPickerOpen(false);
    pendingDropFilesRef.current = null;
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const entry = prev.find((image) => image.id === id);

      if (entry?.url && entry.url.startsWith("blob:")) {
        URL.revokeObjectURL(entry.url);
      }

      return prev.filter((image) => image.id !== id);
    });

    // Remove imagem
    const imagens = carregarStorage<any[]>(STORAGE_KEYS.images, []);

    salvarStorage(
      STORAGE_KEYS.images,
      imagens.filter((imagem) => imagem.id !== id),
    );

    // Remove análise relacionada
    const analises = carregarStorage<any[]>(STORAGE_KEYS.analyses, []);

    salvarStorage(
      STORAGE_KEYS.analyses,
      analises.filter((analise) => analise.imageId !== id),
    );

    // Remove alerta gerado pela imagem
    const alertas = carregarStorage<Alert[]>(STORAGE_KEYS.alerts, []);

    salvarStorage(
      STORAGE_KEYS.alerts,
      alertas.filter((alerta) => alerta.imageId !== id),
    );

    setLightboxIndex(null);
  };

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () =>
    setLightboxIndex((i) =>
      i === null ? null : (i - 1 + images.length) % images.length,
    );
  const nextImage = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Upload zone */}
      <div className="p-5 pb-0 flex-shrink-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={openUploadDialog}
          className={clsx(
            "border border-dashed transition-all cursor-pointer flex items-center gap-6 px-8 py-6",
            dragging
              ? "border-primary bg-primary/10 scale-[1.005]"
              : "border-border hover:border-primary/40 hover:bg-primary/[0.03] bg-card",
          )}
        >
          <div
            className={clsx(
              "w-10 h-10 border flex items-center justify-center flex-shrink-0 transition-colors",
              dragging
                ? "border-primary text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            <Upload size={18} />
          </div>
          <div>
            <div className="text-sm font-mono text-foreground">
              {dragging
                ? "Solte as imagens aqui"
                : "Arraste imagens ou clique para selecionar"}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
              JPG, PNG, WebP — você escolherá a rodovia da imagem em seguida
            </div>
          </div>
          {images.length > 0 && (
            <div className="ml-auto text-[11px] font-mono text-muted-foreground/60 flex-shrink-0">
              {images.length} imagem{images.length !== 1 ? "ns" : ""} carregada
              {images.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Gallery or empty state */}
      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div
            className="w-20 h-20 border border-border flex items-center justify-center"
            style={{
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            <ImageIcon className="text-muted-foreground/40" size={28} />
          </div>
          <div>
            <p className="text-muted-foreground font-mono text-sm">
              Nenhuma imagem carregada
            </p>
            <p className="text-muted-foreground/50 font-mono text-xs mt-1">
              Use a zona acima para adicionar imagens ao preview
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative bg-card border border-border hover:border-primary/30 transition-colors flex flex-col overflow-hidden"
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-square overflow-hidden bg-secondary cursor-pointer"
                  onClick={() => openLightbox(idx)}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn
                      size={20}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>

                {/* Meta */}
                <div className="px-2.5 py-2 flex flex-col gap-0.5">
                  <div
                    className="text-[11px] font-mono text-foreground truncate"
                    title={img.name}
                  >
                    {img.name}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {img.width}×{img.height} · {formatBytes(img.size)}
                  </div>
                  <div className="text-[10px] font-mono mt-1">
                    {img.status === "analisando_exif" && (
                      <span className="text-amber-400">🔄 Lendo EXIF...</span>
                    )}

                    {img.status === "processando_ia" && (
                      <span className="text-amber-400">
                        🔄 IA analisando...
                      </span>
                    )}

                    {img.status === "analisada" && (
                      <span className="text-green-400">
                        ✓ Análise concluída
                      </span>
                    )}

                    {img.status === "pronta_ia" && (
                      <span className="text-green-400">
                        ✓ GPS encontrado · Pronta para IA
                      </span>
                    )}

                    {img.status === "sem_gps" && (
                      <span className="text-red-400">⚠ GPS não encontrado</span>
                    )}

                    {img.status === "erro" && (
                      <span className="text-red-400">
                        ✕ Erro no processamento
                      </span>
                    )}
                    {img.error && (
                      <div
                        className="text-[9px] font-mono text-red-400/70 mt-0.5 truncate"
                        title={img.error}
                      >
                        {img.error}
                      </div>
                    )}
                  </div>
                  {img.rodovia && (
                    <div className="text-[10px] font-mono text-primary/80 mt-1">
                      {img.rodovia}
                    </div>
                  )}

                  {img.latitude !== undefined &&
                    img.longitude !== undefined && (
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">
                        Lat: {img.latitude.toFixed(6)}
                        <br />
                        Lon: {img.longitude.toFixed(6)}
                      </div>
                    )}

                  {img.aiResult && (
                    <div className="text-[10px] font-mono mt-1">
                      <div
                        className={clsx(
                          img.aiResult.classificacao === "alta"
                            ? "text-red-400"
                            : img.aiResult.classificacao === "media"
                              ? "text-amber-400"
                              : "text-green-400",
                        )}
                      >
                        IA: {img.aiResult.classificacao.toUpperCase()}
                      </div>

                      <div className="text-muted-foreground">
                        Confiança: {(img.aiResult.confianca * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/60"
                  title="Remover"
                >
                  <X size={11} className="text-white" />
                </button>

                {/* Index badge */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 backdrop-blur text-[9px] font-mono text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Clear all */}
          {images.length > 1 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  images.forEach((image) => {
                    if (image.url && image.url.startsWith("blob:")) {
                      URL.revokeObjectURL(image.url);
                    }
                  });

                  setImages([]);
                  setLightboxIndex(null);

                  localStorage.removeItem(STORAGE_KEYS.images);

                  localStorage.removeItem(STORAGE_KEYS.analyses);

                  localStorage.removeItem(STORAGE_KEYS.alerts);
                }}
                className="text-[11px] font-mono text-muted-foreground hover:text-destructive transition-colors border border-border hover:border-destructive/30 px-3 py-1.5"
              >
                Limpar todas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <LightboxModal
          images={images}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}

      {/* Popup de seleção da rodovia */}
      {locationPickerOpen && (
        <LocationPickerModal
          onSelect={handleSelectLocation}
          onClose={cancelLocationPicker}
        />
      )}
    </div>
  );
}

// ─── Location Picker Modal ──────────────────────────────────────────────────────

function LocationPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (location: RoadLocation) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[360px] max-w-[90vw] bg-card border border-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-mono text-foreground">
            Selecione a rodovia da imagem
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ROAD_LOCATIONS.map((location) => (
            <button
              key={location.id}
              onClick={() => onSelect(location)}
              className="text-left px-3 py-2.5 text-[12px] font-mono border border-border hover:border-primary/40 hover:bg-primary/[0.05] transition-colors text-foreground"
            >
              <div>{location.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {location.reference}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("mapa");
  const [mapUrl, setMapUrl] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    carregarStorage<Alert[]>(STORAGE_KEYS.alerts, []),
  );
  const time = useCurrentTime();
  const mapRef = useRef<MapViewHandle | null>(null);
  const [images, setImages] = useState<ImageEntry[]>(carregarImagensSalvas);

  useEffect(() => {
    let cancelado = false;

    listAlerts()
      .then((resultados) => {
        if (cancelado) return;

        const alertasDaApi: Alert[] = resultados.map((resultado) => {
          const severity = classificacaoParaSeveridade(resultado.classificacao);

          return {
            id: `ALT-${resultado.img_num.replace("IMG-", "")}`,
            severity,
            title: tituloDaClassificacao(resultado.classificacao),
            location: `Imagem ${resultado.img_num}`,
            time: resultado.created_at
              ? new Date(resultado.created_at).toLocaleTimeString("pt-BR", {
                  hour12: false,
                })
              : "",
            status: severity === "low" ? "pendente" : "ativo",
            imageId: resultado.img_num,
            latitude: resultado.lat,
            longitude: resultado.lon,
            confianca: resultado.confianca,
          };
        });

        // Merge por id em vez de substituir: se um alerta foi criado
        // localmente (upload+análise) enquanto esta busca inicial ainda
        // estava em andamento, a resposta da API (buscada antes dessa
        // criação) não vai conter esse alerta — sobrescrever o estado
        // inteiro o faria desaparecer da tela.
        setAlerts((prev) => {
          const idsDaApi = new Set(alertasDaApi.map((a) => a.id));
          const somenteLocais = prev.filter((a) => !idsDaApi.has(a.id));
          const mesclados = [...somenteLocais, ...alertasDaApi].sort(
            (a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
          );

          salvarStorage(STORAGE_KEYS.alerts, mesclados);

          return mesclados;
        });
      })
      .catch((error) => {
        console.error(
          "Não foi possível carregar alertas da API; usando cache local.",
          error,
        );
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const visualizarAlertaNoMapa = (alert: Alert) => {
    if (alert.latitude === undefined || alert.longitude === undefined) {
      return;
    }

    setActiveTab("mapa");

    setTimeout(() => {
      mapRef.current?.focusAlert(alert.latitude!, alert.longitude!);
    }, 100);
  };

  const activeAlerts = alerts.filter(
    (a) => a.status === "ativo" && a.severity === "high",
  ).length;

  const adicionarAlerta = (novoAlerta: Alert) => {
    setAlerts((prev) => {
      const atualizados = [novoAlerta, ...prev];

      salvarStorage(STORAGE_KEYS.alerts, atualizados);

      return atualizados;
    });
  };

  const atualizarStatusAlerta = (id: string, status: AlertStatus) => {
    setAlerts((prev) => {
      const atualizados = prev.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              status,
            }
          : alert,
      );

      salvarStorage(STORAGE_KEYS.alerts, atualizados);

      return atualizados;
    });
  };

  const limparTodosAlertas = () => {
    setAlerts([]);
    localStorage.removeItem(STORAGE_KEYS.alerts);
  };

  const handleMapChange = (url: string) => {
    setMapUrl(url);
    setActiveTab("mapa");
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 border-b border-border bg-card h-12 flex-shrink-0">
        {/* Logo + Nav */}
        <div className="flex items-center">
          <div className="flex items-center gap-2.5 pr-5 border-r border-border mr-1">
            <div className="w-5 h-5 border border-primary/70 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-primary" />
            </div>
            <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-foreground">
              GeoWatch
            </span>
          </div>

          <nav className="flex items-center">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  "flex items-center gap-2 px-4 h-12 text-[11px] font-mono uppercase tracking-wider border-b-2 transition-colors",
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={12} />
                {label}
                {id === "alertas" && activeAlerts > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-mono w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {activeAlerts}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-5 text-[11px] font-mono">
          <div className="hidden sm:flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Wifi size={11} />
              <span>38 zonas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={11} />
              <span>884 eventos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={11} />
              <span>99.7%</span>
            </div>
          </div>

          <div className="flex items-center gap-4 border-l border-border pl-5">
            <div className="flex items-center gap-1.5 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              ONLINE
            </div>
            <span className="text-muted-foreground tabular-nums hidden sm:block">
              {time.toLocaleTimeString("pt-BR", { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden relative">
        <div
          className={clsx(
            "absolute inset-0",
            activeTab !== "mapa" && "invisible pointer-events-none",
          )}
        >
          <MapTab alerts={alerts} images={images} mapRef={mapRef} />
        </div>
        <div
          className={clsx(
            "absolute inset-0 overflow-auto",
            activeTab !== "analise" && "hidden",
          )}
        >
          <AnalyticsTab />
        </div>
        <div
          className={clsx(
            "absolute inset-0 overflow-auto",
            activeTab !== "alertas" && "hidden",
          )}
        >
          <AlertsTab
            alerts={alerts}
            onUpdateStatus={atualizarStatusAlerta}
            onViewOnMap={visualizarAlertaNoMapa}
            onClearAll={limparTodosAlertas}
          />
        </div>
        <div
          className={clsx(
            "absolute inset-0 overflow-hidden",
            activeTab !== "imagens" && "hidden",
          )}
        >
          <ImagesTab
            images={images}
            setImages={setImages}
            onAlertCreated={(novoAlerta) => {
              adicionarAlerta(novoAlerta);
            }}
          />
        </div>
        <div
          className={clsx(
            "absolute inset-0 overflow-auto",
            activeTab !== "configuracoes" && "hidden",
          )}
        >
          <SettingsTab onMapUrlChange={handleMapChange} />
        </div>
      </main>

      {/* ── Footer status bar ──────────────────────────────────────────── */}
      <footer className="flex items-center gap-6 px-4 border-t border-border bg-card h-7 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
          <span className="uppercase tracking-widest">Sistema</span>
          <span className="text-green-400/70">Operacional</span>
        </div>
        <div className="flex-1" />
        {activeAlerts > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400/80">
            <AlertTriangle size={10} />
            {activeAlerts} alerta{activeAlerts > 1 ? "s" : ""} crítico
            {activeAlerts > 1 ? "s" : ""} ativo{activeAlerts > 1 ? "s" : ""}
          </div>
        )}
        <div className="text-[10px] font-mono text-muted-foreground/40 tabular-nums hidden sm:block">
          {time.toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
      </footer>
    </div>
  );
}
