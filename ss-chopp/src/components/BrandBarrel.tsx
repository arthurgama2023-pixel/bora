"use client";

import { useEffect, useRef, useState } from "react";
import { brandForProduct, photoForProduct, volumeLabel } from "@/lib/brands";

// Foto de um keg de metal (barril real) com a LOGO da marca estampada na frente.
// Usada como base quando a marca NÃO tem uma foto própria (b.photo). Se nem a
// logo (/public/logos/*.png) existir, mostra o nome da marca num selo — nunca
// uma caixa vazia.
const KEG_PHOTO =
  "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa?w=600&q=80&auto=format&fit=crop";

export default function BrandBarrel({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const b = brandForProduct(productId);
  const [logoOk, setLogoOk] = useState(false);
  const [photoErr, setPhotoErr] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  // Se a imagem já veio do cache do navegador, o evento `load` pode disparar
  // antes do React montar o listener — sem isso o selo real nunca aparece
  // e fica preso no fallback. Checa `complete` assim que monta.
  useEffect(() => {
    const img = logoRef.current;
    if (img?.complete) setLogoOk(img.naturalWidth > 0);
  }, [b?.logo]);

  if (!b) return null;
  const vol = volumeLabel(productName);
  const photo = photoForProduct(b, productId);

  // Marca/produto COM foto pronta do barril (ex.: Brahma, Heineken, Belco
  // 50L): imagem retrato de uma cena completa. Pra o barril aparecer INTEIRO
  // em qualquer proporção de card (home baixo ou detalhe largo) sem corte
  // feio nem barras vazias, usamos a técnica do backdrop: a MESMA foto
  // desfocada preenche o fundo e o barril nítido vem por cima com
  // `object-contain`. Só cai no texto se a foto falhar.
  if (photo && !photoErr) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-gray-900">
        {/* Fundo: a própria foto, desfocada e escurecida, preenchendo o card */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-75"
        />
        {/* Barril inteiro, nítido, sempre visível */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt={`Barril ${b.label} ${vol ?? ""}`.trim()}
          onError={() => setPhotoErr(true)}
          className="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-200">
      {/* Barril de metal (foto real genérica) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={KEG_PHOTO}
        alt="Barril de chopp"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Logo oficial estampada na frente (aparece quando o arquivo existir) */}
      {b.logo && (
        <div
          className={`absolute left-1/2 top-1/2 z-10 flex h-[52%] w-[62%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 p-2 shadow-lg ring-1 ring-black/10 ${
            logoOk ? "" : "hidden"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={logoRef}
            src={b.logo}
            alt={`Logo ${b.label}`}
            className="max-h-full max-w-full object-contain"
            onLoad={() => setLogoOk(true)}
            onError={() => setLogoOk(false)}
          />
        </div>
      )}

      {/* Fallback: selo com o nome da marca (enquanto a logo não estiver salva) */}
      {!logoOk && (
        <span
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md px-3 py-1 text-base font-black tracking-tight text-white shadow-lg sm:text-lg"
          style={{ background: `linear-gradient(140deg, ${b.from}, ${b.to})` }}
        >
          {b.label}
        </span>
      )}

      {/* Selo de litragem */}
      {vol && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
          {vol}
        </span>
      )}
    </div>
  );
}
