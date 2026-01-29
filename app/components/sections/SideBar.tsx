const quickLinks = [
  {
    title: "리포트 카드",
    description: "학습 성과 확인",
    color: "bg-red-500",
    href: "https://wonderland-reportcard.web.app",
  },
  {
    title: "레벨테스트",
    description: "실력 평가",
    color: "bg-blue-500",
    href: "http://qawonderland.com/leveltest/",
  },
];

export function SideBar() {
  return (
    <aside className="fixed right-8 top-1/2 z-40 hidden -translate-y-1/2 space-y-4 lg:block">
      {quickLinks.map((item) => (
        <a
          key={item.title}
          className={`group block w-48 rounded-lg p-6 text-white shadow-lg transition-all duration-300 hover:shadow-xl ${item.color}`}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              {item.title.slice(0, 1)}
            </div>
            <h3 className="mb-1 text-lg font-bold">{item.title}</h3>
            <p className="text-sm opacity-90">{item.description}</p>
          </div>
        </a>
      ))}
    </aside>
  );
}
