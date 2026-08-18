const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export interface InspectionResponse {
  img_num: string;
  lat: number;
  lon: number;
  classificacao: "baixa" | "media" | "alta";
  confianca: number;
  created_at: string | null;
}

const ERROR_MESSAGES: Record<number, string> = {
  422: "Imagem ou coordenadas inválidas.",
  500: "Configuração do modelo ausente no servidor.",
  502: "Modelo indisponível no momento. Tente novamente.",
  503: "Banco de dados indisponível no momento.",
  504: "O modelo demorou demais para responder. Tente novamente.",
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") {
      return body.detail;
    }
  } catch {
    // corpo não é JSON ou está vazio; usa a mensagem padrão abaixo
  }
  return ERROR_MESSAGES[response.status] ?? `Erro inesperado (${response.status}).`;
}

export async function createInspection(
  image: string,
  lat: number,
  lon: number,
): Promise<InspectionResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, lat, lon }),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar à API.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  return (await response.json()) as InspectionResponse;
}

export async function listAlerts(): Promise<InspectionResponse[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/alerts`);
  } catch {
    throw new ApiError(0, "Não foi possível conectar à API.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  return (await response.json()) as InspectionResponse[];
}
