import Image from "next/image";

export function JetSkiIcon({ size = 24, color = "blue" }: { size?: number; color?: string }) {
  // La imagen es silueta negra sobre blanco.
  // "blue" → filter que la convierte al azul de la marca (#1A6EBF)
  // "white" → la invierte a blanco (para fondos oscuros)
  const filter =
    color === "white"
      ? "brightness(0) invert(1)"
      : "brightness(0) saturate(100%) invert(33%) sepia(82%) saturate(600%) hue-rotate(190deg) brightness(0.9)";

  return (
    <Image
      src="/jetski.jpg"
      alt="Moto de agua"
      width={size}
      height={size}
      style={{ filter, objectFit: "contain" }}
    />
  );
}
