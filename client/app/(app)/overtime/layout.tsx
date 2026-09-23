import { OtFilterProvider } from "@/components/overtime/OtFilterContext";

export default function OvertimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OtFilterProvider>{children}</OtFilterProvider>;
}
