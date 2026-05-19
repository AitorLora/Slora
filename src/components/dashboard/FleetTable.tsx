import { assets } from "@/lib/mock-data";
import { AssetStatusBadge } from "./AssetStatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function FleetTable() {
  return (
    <div className="rounded-xl border overflow-hidden bg-[var(--surface)] border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">Estado de la Flota</p>
        <span className="text-[11px] text-[var(--text-3)]">{assets.length} activos</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-[var(--border)] bg-[var(--muted)]">
            {["", "Activo", "Tipo", "Sociedad", "Horas Motor", "Desde Servicio", "Estado"].map((h, i) => (
              <TableHead key={i} className="text-[10px] uppercase tracking-[0.06em] font-medium text-[var(--text-3)]">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const dotColor =
              asset.estado === "ACTIVO" ? "var(--green)" :
              asset.estado === "ALERTA" ? "var(--amber)" : "var(--text-3)";
            const horaColor =
              asset.horas_desde_servicio >= 100 ? "var(--red)" :
              asset.horas_desde_servicio >= 50  ? "var(--amber)" : "var(--green)";
            return (
              <TableRow key={asset.id} className="border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                <TableCell className="w-4 pl-4">
                  <span className="w-2 h-2 rounded-full block" style={{ background: dotColor }} />
                </TableCell>
                <TableCell className="font-mono text-[12px] font-medium text-[var(--navy)]">
                  {asset.nombre}
                </TableCell>
                <TableCell className="text-[11px] text-[var(--text-3)]">
                  {asset.tipo === "moto" ? "Moto de agua" : "Barco"}
                </TableCell>
                <TableCell className="text-[12px] text-[var(--text-2)]">
                  {asset.sociedad_nombre}
                </TableCell>
                <TableCell className="font-mono text-[12px] font-medium text-[var(--foreground)]">
                  {asset.horas_motor}h
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[12px]" style={{ color: horaColor }}>
                    {asset.horas_desde_servicio}h
                  </span>
                </TableCell>
                <TableCell>
                  <AssetStatusBadge estado={asset.estado} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
