import logo from "@/assets/logo.png";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt="Trx IDE logo"
      width={size}
      height={size}
      className="rounded-md shadow-[0_0_20px_rgba(59,130,246,0.35)]"
    />
  );
}