import Image from "next/image";
import Link from "next/link";

/** Marca no topo da barra lateral: símbolo + nome. */
export function Brand() {
  return (
    <Link
      href="/inicio"
      className="flex items-center gap-2.5 rounded-xl px-1.5 py-1"
      aria-label="Vai Aonde Capixaba? — início"
    >
      <Image
        src="/brand/simbolo-amarelo.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg"
        priority
      />
      <span className="text-[13px] leading-tight font-semibold tracking-tight">
        Vai Aonde
        <br />
        Capixaba<span className="text-brand-strong">?</span>
      </span>
    </Link>
  );
}
