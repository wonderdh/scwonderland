import Link from "next/link";

const programs = [
  {
    id: "item01",
    href: "/program/map",
    title: "MAP",
    description: "유치부, 초등부, 초·중등\n프로그램 MAP",
    bgImage: "/images/main/program01.png",
  },
  {
    id: "item02",
    href: "/program/wonderland",
    title: "Wonderland",
    description: "오전 유치부 프로그램",
    bgImage: "/images/main/program02.png",
  },
  {
    id: "item03",
    href: "/program/wonder-k",
    title: "Wonder K",
    description: "오후 유치부 프로그램",
    bgImage: "/images/main/program03.png",
  },
  {
    id: "item04",
    href: "/program/primo-school",
    title: "Primo Class",
    description: "초등 저학년 집중 프로그램",
    bgImage: "/images/main/program04.png",
  },
  {
    id: "item05",
    href: "/program/quest-academy",
    title: "Quest Class",
    description: "초등 고학년 · 중등 전문 프로그램",
    bgImage: "/images/main/program05.png",
  },
] as const;

export function MainProgram() {
  return (
    <section
      id="main-program"
      // mobile/tablet(≤1280): 74/45, desktop(>1280): 120/65
      className="pt-[74px] pb-[45px] xl:pt-[120px] xl:pb-[65px]"
    >
      <div className="relative mx-auto max-w-[1440px] px-5">
        {/* Title header: PROGRAM + description */}
        <div className="block text-center md:flex md:items-end md:text-left">
          <h3 className="relative inline-block text-5xl font-extrabold text-[#222] md:pl-10 md:pr-2.5 md:text-[60px] md:z-[1]">
            {/* Dashed circle decoration */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 size-20 rounded-full border-[3px] border-dashed border-[#e1e1e1] md:left-0 md:top-[-36px] md:translate-x-0 md:size-[110px] md:z-[-1]"
            />
            {/* Blue dot decoration */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-2.5 right-1/2 translate-x-1/2 size-2.5 rounded-full md:top-[13px] md:right-0 md:translate-x-0"
              style={{ background: "var(--brand-blue)" }}
            />
            PROGRAM
          </h3>
          <p className="mt-1.5 inline-block text-left text-[17px] leading-[1.47] text-[#787878] md:relative md:top-[-17px] md:ml-[17px] md:mt-0 md:text-lg md:leading-normal">
            <span className="font-normal" style={{ color: "var(--brand-blue)" }}>
              발표와 토론
            </span>
            을 위한 최적의{" "}
            <br className="max-md:hidden" />
            학습 환경을 제공합니다.
          </p>
        </div>

        {/* Program card grid */}
        <div className="mt-10 flex flex-col gap-4 md:mt-[60px] md:flex-row md:gap-[23px]">
          {programs.map((item) => (
            <div
              key={item.id}
              // mobile: min-h 200 + pt 40%, tablet+desktop: pt 26%
              className="group relative flex-1 overflow-hidden rounded-[10px] bg-[#5781ec] bg-cover bg-top bg-no-repeat min-h-[200px] pt-[40%] md:min-h-0 md:pt-[26%]"
              style={{ backgroundImage: `url(${item.bgImage})` }}
            >
              <Link
                href={item.href}
                className="absolute inset-x-0 bottom-[-56%] h-full w-full text-center no-underline transition-all duration-300 group-hover:bottom-0 group-hover:bg-[#5781ec]"
              >
                {/* mobile/tablet(≤1280): top 35%, desktop(>1280): top 50% */}
                <div className="absolute inset-x-0 top-[35%] -translate-y-1/2 xl:top-1/2">
                  <h3 className="text-[25px] font-bold text-white">{item.title}</h3>
                  {/* description: mobile visible, tablet(768-1279) hidden, desktop visible */}
                  <p
                    className="mt-[30px] block px-[25px] text-lg font-medium leading-[1.39] text-white break-keep md:hidden xl:block"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {item.description}
                  </p>
                  <span className="relative mt-[30px] inline-block pr-5 text-xl font-medium text-white md:hidden xl:inline-block">
                    view
                    <span
                      aria-hidden
                      className="absolute right-0 top-2 size-[15px] h-[13px] bg-no-repeat bg-cover"
                      style={{ backgroundImage: "url(/images/icon/link.svg)" }}
                    />
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
