import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function EarningsDashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.className} antialiased`}>{children}</div>;
}
