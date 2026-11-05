import { FileText, ImageOff, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Miniatura de mídia (imagem, vídeo ou arquivo). O link vem do Storage e expira, por isso <img> simples. */
export function MediaThumb({
  media,
  className,
  controls = false,
}: {
  media: { url: string | null; mime: string | null; name: string } | null | undefined;
  className?: string;
  /** vídeo com controles (tela de detalhe) em vez de só o quadro inicial */
  controls?: boolean;
}) {
  const base = cn("relative overflow-hidden bg-surface-3", className);
  if (!media || !media.url) {
    return (
      <div className={cn(base, "flex items-center justify-center text-muted-2")} aria-hidden>
        <ImageOff className="size-5" />
      </div>
    );
  }
  if (media.mime?.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage
    return <img src={media.url} alt={media.name} className={cn(base, "object-cover")} loading="lazy" />;
  }
  if (media.mime?.startsWith("video/")) {
    return (
      <div className={base}>
        <video src={media.url} className="size-full object-cover" controls={controls} preload="metadata" muted={!controls} aria-label={media.name} />
        {!controls && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="size-4" />
            </span>
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn(base, "flex flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-muted")}>
      <FileText className="size-5" aria-hidden />
      <span className="line-clamp-2 break-all">{media.name}</span>
    </div>
  );
}
