import type { SVGProps } from "react";
export const markPath =
  "M613.1 0L964.4 846.5C990.7 910 1037.3 1000 1115.2 1000L801.2 1000C837.9 1000 823.9 933.2 810.8 901.5L516.2 191.8ZM565.3 478.2C403.6 500.4 277.2 636.6 205.4 773.4C167.9 844.9 133.2 917.9 65.2 965.8C49.8 976.6 19.2 1000 0 1000L447.4 1000C437.8 1000 419 985.7 410.7 980.4C364.3 950.5 340 898.8 339.9 844.4C339.5 737.2 400.6 618.9 475.4 544.6C492.9 527.2 511.7 511.7 532.3 498.2C541.9 492 558.3 487.2 565.3 478.2Z";
export function Mark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1115.2 1000"
      fill="currentColor"
      {...props}
    >
      <path d={markPath} />
    </svg>
  );
}
export function Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 6712.9 1050"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M0 1025L560 7L1120 1025L966.6 1025L560 285.8L153.4 1025ZM1620 25L1793 25L2111.4 418.2L2429.9 25L2602.9 25L2197.9 525L2602.9 1025L2429.9 1025L2111.4 631.8L1793 1025L1620 1025L2025 525ZM3362.9 1025L3362.9 25L3222.9 25L3222.9 1025ZM4042.9 525a525 525 0 1 0 1050 0a525 525 0 1 0 -1050 0ZM4187.1 525a380.8 380.8 0 1 0 761.6 0a380.8 380.8 0 1 0 -761.6 0ZM6712.9 1043L5912.9 315.9L5912.9 1025L5772.9 1025L5772.9 7L6572.9 734.1L6572.9 25L6712.9 25Z"
      />
    </svg>
  );
}
export function Logo({ vertical = false }: { vertical?: boolean }) {
  return (
    <span className={vertical ? "brand-logo vertical" : "brand-logo"}>
      <Mark aria-hidden="true" />
      <Wordmark aria-hidden="true" />
    </span>
  );
}
