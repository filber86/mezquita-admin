// El logo es blanco sobre transparente; se usa como máscara para poder
// pintarlo del color que toque (blanco en la barra lateral, azul en móvil).
export function LogoMark({ className }: { className: string }) {
  return (
    <span
      role="img"
      aria-label="Mezquita Mayor de Granada"
      className={`block shrink-0 ${className}`}
      style={{
        maskImage: 'url(/logo-mark.png)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: 'url(/logo-mark.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
