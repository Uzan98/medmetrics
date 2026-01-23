import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedMetrics - Dashboard de Residência Médica",
  description: "Acompanhe seu desempenho e evolução para a prova de residência médica",
  keywords: ["residência médica", "questões", "desempenho", "estudo"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
