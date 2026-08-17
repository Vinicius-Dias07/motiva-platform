export type ImageStatus =
  | "analisando_exif"
  | "pronta_ia"
  | "processando_ia"
  | "analisada"
  | "sem_gps"
  | "erro";

export interface AIResult {
  classificacao: "baixa" | "media" | "alta";
  confianca: number;
  vegetacaoDetectada: number;
  areaNaoRocada: number;
}

export interface ImageEntry {
  id: string;
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
  status: ImageStatus;

  latitude?: number;
  longitude?: number;

  aiResult?: AIResult;

  error?: string;
}

export type AlertSeverity = "high" | "medium" | "low";

export type AlertStatus = "ativo" | "resolvido" | "investigando" | "pendente";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  location: string;
  time: string;
  status: AlertStatus;

  imageId?: string;
  latitude?: number;
  longitude?: number;

  rodovia?: string;
  confianca?: number;
}
