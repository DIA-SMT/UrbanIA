import Image from "next/image";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center">
        <Image
          src="/brand/logo-municipalidad-smt.png"
          alt="Municipalidad de San Miguel de Tucuman"
          width={48}
          height={48}
          priority
          className="h-11 w-11 rounded-lg object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none tracking-normal text-white">UrbanIA</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/80">Municipalidad SMT</p>
      </div>
    </div>
  );
}
