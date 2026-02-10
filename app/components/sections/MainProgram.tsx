import Link from "next/link";
import styles from "./MainProgram.module.css";

const programs = [
  {
    id: "item01",
    href: "/program/map",
    title: "MAP",
    description: "유치부, 초등부, 초·중등\n프로그램 MAP",
  },
  {
    id: "item02",
    href: "/program/wonderland",
    title: "Wonderland",
    description: "오전 유치부 프로그램",
  },
  {
    id: "item03",
    href: "/program/wonder-k",
    title: "Wonder K",
    description: "오후 유치부 프로그램",
  },
  {
    id: "item04",
    href: "/program/primo-school",
    title: "Primo School",
    description: "초등 저학년 집중 프로그램",
  },
  {
    id: "item05",
    href: "/program/quest-academy",
    title: "Quest Academy",
    description: "초등 고학년 · 중등 전문 프로그램",
  },
] as const;

export function MainProgram() {
  return (
    <section className={styles.mainProgram} id="main-program">
      <div className={styles.layout}>
        <div className={styles.mainHgroup}>
          <h3 className={styles.mainTitle}>PROGRAM</h3>
          <p>
            <span className={styles.colorBlue}>발표와 토론</span>을 위한 최적의{" "}
            <br className="max-md:hidden" />
            학습 환경을 제공합니다.
          </p>
        </div>
        <div className={styles.list}>
          {programs.map((item) => (
            <div key={item.id} className={styles[item.id]}>
              <Link href={item.href}>
                <div className={styles.txtBox}>
                  <h3>{item.title}</h3>
                  <p style={{ whiteSpace: "pre-line" }}>{item.description}</p>
                  <span>view</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
