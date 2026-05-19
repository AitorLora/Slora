export type AssetStatus = "ACTIVO" | "ALERTA" | "MANTENIMIENTO";
export type AssetType = "moto" | "barco";
export type BookingStatus = "pendiente" | "confirmada" | "en_curso" | "completada" | "cancelada";
export type BarcoCategoria = "quicksilver" | "sin_licencia_6" | "sin_licencia_7";

export interface Sociedad {
  id: string;
  nombre: string;
}

export interface Asset {
  id: string;
  nombre: string;
  matricula: string;
  tipo: AssetType;
  modelo: string;
  capacidad?: number;
  licencia?: boolean;
  categoria?: BarcoCategoria; // solo barcos
  sociedad_id: string;
  sociedad_nombre: string;
  horas_motor: number;
  horas_desde_servicio: number;
  estado: AssetStatus;
}

export interface Booking {
  id: number;
  activo_id: string;
  activo_nombre: string;
  sociedad_id: string;
  sociedad_nombre: string;
  tipo: AssetType;
  cliente: string;
  fecha: string;
  hora: string;
  duracion: string;
  horas_consumidas: number;
  ingreso_neto: number;
  fuente: string;
  estado: BookingStatus;
  notas?: string;
}

export const sociedades: Sociedad[] = [
  { id: "s1", nombre: "Sociedad A" },
  { id: "s2", nombre: "Sociedad B" },
  { id: "s3", nombre: "Sociedad C" },
];

// ── Tarifas motos (por horas) ─────────────────────────────────────────
export const TARIFAS_MOTO: Record<string, number> = {
  "2h": 100,
  "4h": 150,
  "6h": 200,
  "8h": 250,
};

export const DURACIONES_MOTO = ["2h", "4h", "6h", "8h"];

export const HORAS_CONSUMIDAS: Record<string, number> = {
  "2h": 2, "4h": 4, "6h": 6, "8h": 8,
  "Medio día": 4, "Día completo": 8,
};

// ── Tarifas barcos (por periodo) ──────────────────────────────────────
export interface TarifaBarco {
  label: string;
  capacidad: number;
  licencia: boolean;
  medio_dia: number;
  dia_completo: number;
  descripcion: string;
}

export const TARIFAS_BARCO: Record<BarcoCategoria, TarifaBarco> = {
  quicksilver:    { label: "Quicksilver",           capacidad: 7, licencia: true,  medio_dia: 300, dia_completo: 500, descripcion: "Con licencia · 7 personas" },
  sin_licencia_6: { label: "Barco sin licencia 6p", capacidad: 6, licencia: false, medio_dia: 250, dia_completo: 400, descripcion: "Sin licencia · 6 personas" },
  sin_licencia_7: { label: "Barco sin licencia 7p", capacidad: 7, licencia: false, medio_dia: 300, dia_completo: 450, descripcion: "Sin licencia · 7 personas" },
};

export const DURACIONES_BARCO = ["Medio día", "Día completo"];

export const FUENTES = [
  "Directo",
  "WhatsApp",
  "Teléfono",
  "slora.app",
  "Airbnb",
  "Booking.com",
  "Viator",
  "GetYourGuide",
];

export const assets: Asset[] = [
  // Motos
  { id: "GTX-01", nombre: "Sea-Doo GTX 1", matricula: "MA-1234-A", tipo: "moto", modelo: "Sea-Doo GTX 230", sociedad_id: "s1", sociedad_nombre: "Sociedad A", horas_motor: 142, horas_desde_servicio: 28,  estado: "ACTIVO" },
  { id: "GTX-02", nombre: "Sea-Doo GTX 2", matricula: "MA-1235-A", tipo: "moto", modelo: "Sea-Doo GTX 230", sociedad_id: "s1", sociedad_nombre: "Sociedad A", horas_motor: 98,  horas_desde_servicio: 67,  estado: "ALERTA" },
  { id: "GTX-03", nombre: "Sea-Doo GTX 3", matricula: "MA-1236-A", tipo: "moto", modelo: "Sea-Doo GTX 155", sociedad_id: "s1", sociedad_nombre: "Sociedad A", horas_motor: 210, horas_desde_servicio: 102, estado: "MANTENIMIENTO" },
  { id: "GTX-04", nombre: "Yamaha VX 1",   matricula: "MA-2201-B", tipo: "moto", modelo: "Yamaha VX Cruiser", sociedad_id: "s2", sociedad_nombre: "Sociedad B", horas_motor: 175, horas_desde_servicio: 15, estado: "ACTIVO" },
  { id: "GTX-05", nombre: "Yamaha VX 2",   matricula: "MA-2202-B", tipo: "moto", modelo: "Yamaha VX Cruiser", sociedad_id: "s2", sociedad_nombre: "Sociedad B", horas_motor: 88,  horas_desde_servicio: 44, estado: "ACTIVO" },
  // Barcos
  { id: "BAR-01", nombre: "Quicksilver",      matricula: "MA-3310-A", tipo: "barco", modelo: "Quicksilver",  capacidad: 7, licencia: true,  categoria: "quicksilver",    sociedad_id: "s1", sociedad_nombre: "Sociedad A", horas_motor: 320, horas_desde_servicio: 18, estado: "ACTIVO" },
  { id: "BAR-02", nombre: "Barco 1",          matricula: "MA-4410-B", tipo: "barco", modelo: "Barco 1",      capacidad: 6, licencia: false, categoria: "sin_licencia_6", sociedad_id: "s2", sociedad_nombre: "Sociedad B", horas_motor: 445, horas_desde_servicio: 78, estado: "ALERTA" },
  { id: "BAR-03", nombre: "Barco 2",          matricula: "MA-4411-B", tipo: "barco", modelo: "Barco 2",      capacidad: 6, licencia: false, categoria: "sin_licencia_6", sociedad_id: "s2", sociedad_nombre: "Sociedad B", horas_motor: 280, horas_desde_servicio: 22, estado: "ACTIVO" },
  { id: "BAR-04", nombre: "Barco 3",          matricula: "MA-4412-C", tipo: "barco", modelo: "Barco 3",      capacidad: 7, licencia: false, categoria: "sin_licencia_7", sociedad_id: "s3", sociedad_nombre: "Sociedad C", horas_motor: 512, horas_desde_servicio: 31, estado: "ACTIVO" },
];

export const bookings: Booking[] = [
  { id: 1,  activo_id: "GTX-01", activo_nombre: "Sea-Doo GTX 1", sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "moto",  cliente: "Carlos García",   fecha: "2026-05-17", hora: "09:00", duracion: "2h",          horas_consumidas: 2, ingreso_neto: 100, fuente: "slora.app", estado: "confirmada",  notas: "" },
  { id: 2,  activo_id: "GTX-02", activo_nombre: "Sea-Doo GTX 2", sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "moto",  cliente: "Marie Dupont",    fecha: "2026-05-17", hora: "09:00", duracion: "4h",          horas_consumidas: 4, ingreso_neto: 150, fuente: "Airbnb",           estado: "completada",  notas: "" },
  { id: 3,  activo_id: "GTX-04", activo_nombre: "Yamaha VX 1",   sociedad_id: "s2", sociedad_nombre: "Sociedad B", tipo: "moto",  cliente: "James Wilson",    fecha: "2026-05-17", hora: "11:00", duracion: "2h",          horas_consumidas: 2, ingreso_neto: 100, fuente: "Directo",          estado: "pendiente",   notas: "" },
  { id: 4,  activo_id: "BAR-03", activo_nombre: "Barco 2",       sociedad_id: "s2", sociedad_nombre: "Sociedad B", tipo: "barco", cliente: "Ana Martínez",    fecha: "2026-05-17", hora: "09:00", duracion: "Día completo", horas_consumidas: 8, ingreso_neto: 400, fuente: "Directo",          estado: "confirmada",  notas: "Grupo de 6 personas" },
  { id: 5,  activo_id: "BAR-01", activo_nombre: "Quicksilver",   sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "barco", cliente: "Luca Rossi",      fecha: "2026-05-17", hora: "15:00", duracion: "Medio día",    horas_consumidas: 4, ingreso_neto: 300, fuente: "GetYourGuide",     estado: "pendiente",   notas: "" },
  { id: 6,  activo_id: "GTX-05", activo_nombre: "Yamaha VX 2",   sociedad_id: "s2", sociedad_nombre: "Sociedad B", tipo: "moto",  cliente: "Sophie Müller",   fecha: "2026-05-16", hora: "09:00", duracion: "6h",          horas_consumidas: 6, ingreso_neto: 200, fuente: "Viator",           estado: "completada",  notas: "" },
  { id: 7,  activo_id: "BAR-04", activo_nombre: "Barco 3",       sociedad_id: "s3", sociedad_nombre: "Sociedad C", tipo: "barco", cliente: "Tom Baker",       fecha: "2026-05-16", hora: "09:00", duracion: "Día completo", horas_consumidas: 8, ingreso_neto: 450, fuente: "slora.app", estado: "completada",  notas: "" },
  { id: 8,  activo_id: "GTX-01", activo_nombre: "Sea-Doo GTX 1", sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "moto",  cliente: "Paula Sánchez",   fecha: "2026-05-15", hora: "11:00", duracion: "4h",          horas_consumidas: 4, ingreso_neto: 150, fuente: "WhatsApp",         estado: "completada",  notas: "" },
  { id: 9,  activo_id: "BAR-01", activo_nombre: "Quicksilver",   sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "barco", cliente: "Isabel Ferreira", fecha: "2026-05-18", hora: "10:00", duracion: "Día completo", horas_consumidas: 8, ingreso_neto: 500, fuente: "Airbnb",           estado: "en_curso",    notas: "" },
  { id: 10, activo_id: "GTX-04", activo_nombre: "Yamaha VX 1",   sociedad_id: "s2", sociedad_nombre: "Sociedad B", tipo: "moto",  cliente: "David Chen",      fecha: "2026-05-18", hora: "09:00", duracion: "2h",          horas_consumidas: 2, ingreso_neto: 100, fuente: "Teléfono",         estado: "en_curso",    notas: "" },
  { id: 11, activo_id: "GTX-02", activo_nombre: "Sea-Doo GTX 2", sociedad_id: "s1", sociedad_nombre: "Sociedad A", tipo: "moto",  cliente: "Marta López",     fecha: "2026-04-28", hora: "10:00", duracion: "4h",          horas_consumidas: 4, ingreso_neto: 150, fuente: "Viator",           estado: "completada",  notas: "" },
  { id: 12, activo_id: "BAR-02", activo_nombre: "Barco 1",       sociedad_id: "s2", sociedad_nombre: "Sociedad B", tipo: "barco", cliente: "Erik Johansen",   fecha: "2026-05-11", hora: "09:00", duracion: "Medio día",    horas_consumidas: 4, ingreso_neto: 250, fuente: "slora.app", estado: "cancelada",   notas: "Cliente no apareció" },
];

export const kpis = {
  total_activos: assets.length,
  motos_activas: assets.filter(a => a.tipo === "moto" && a.estado === "ACTIVO").length,
  barcos_activos: assets.filter(a => a.tipo === "barco" && a.estado === "ACTIVO").length,
  en_mantenimiento: assets.filter(a => a.estado === "MANTENIMIENTO").length,
  alertas: assets.filter(a => a.estado === "ALERTA").length,
  cobrado: bookings.filter(b => b.estado === "completada").reduce((s, b) => s + b.ingreso_neto, 0),
  proyectado: bookings.filter(b => b.estado !== "cancelada").reduce((s, b) => s + b.ingreso_neto, 0),
  total_sociedades: sociedades.length,
};
