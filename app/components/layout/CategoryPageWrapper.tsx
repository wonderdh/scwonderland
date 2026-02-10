type CategoryPageWrapperProps = {
  children: React.ReactNode;
};

export function CategoryPageWrapper({ children }: CategoryPageWrapperProps) {
  return <main className="min-h-screen bg-white">{children}</main>;
}
