export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pb-[76px] min-h-screen">
      {children}
    </div>
  );
}
