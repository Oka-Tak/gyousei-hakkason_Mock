export const metadata = {
  title: 'ZAIMYAKU ',
  description: '政府予算の透明性向上を支援する見える化プラットフォーム。行政事業レビューデータをインタラクティブなグラフで表示し、税金の使い道を分かりやすく可視化します。',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
