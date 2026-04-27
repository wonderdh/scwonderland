import type { Metadata } from "next";
import Image from "next/image";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";
import styles from "./WonderK.module.css";

export const metadata: Metadata = {
  title: "Wonder K | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonder K - 오후 유치부 프로그램 (5세~7세)",
};

export default function WonderKPage() {
  return (
    <PageContent title="Wonder K">
      <div className={`${styles.contents} ${styles.type4}`}>
        <div className={styles.program}>
          <div className={styles.wonderlandk}>
            <div className={styles.layout}>
              <div className={styles.txtBox}>
                <span>
                  <strong>오후</strong> 유치부 프로그램 / 5세 ~ 7세 대상
                </span>
                <h3>Wonder K</h3>
                <p>
                  알파벳 학습과 더불어 사운드를 이해하고 <br />
                  책을 읽어내도록 지도하며 반복적인 패턴의
                  <br />
                  영어 표현에 노출시켜 아이들이 듣고 <br />
                  말할 수 있게 합니다.
                </p>
              </div>
              <div className={styles.imgBox}>
                <Image
                  src="/images/program/wonder-k/wonderlandk_img.png"
                  alt="Wonder K 프로그램"
                  width={603}
                  height={360}
                />
              </div>
            </div>

            <div className={styles.gyBox}>
              <div className={styles.layout}>
                <div className={styles.yrdbox}>
                  <div className={styles.ykrd}>
                    <span>학습목표</span>
                    <ul>
                      <li>
                        영어의 음소와 철자관계를 정확하게 인식하여 자연스럽게
                        영어를 읽어낼 수 있습니다.
                      </li>
                      <li>
                        유용한 영어 표현들을 익히고 상황에 맞게 영어로 말할 수
                        있습니다.
                      </li>
                      <li>
                        신나는 노래와 율동으로 영어의 흥미를 높이고 쉽고 빠르게
                        영어를 사용할 수 있습니다.
                      </li>
                      <li>
                        과학에 관련된 새로운 영어 단어들을 배우며 실험을 통해
                        과학의 원리를 영어로 이해할 수 있습니다.
                      </li>
                    </ul>
                  </div>
                  <div className={styles.ykrd}>
                    <span>학습과목</span>
                    <div>
                      <p>
                        <strong>Main Subjects</strong> - Phonics / Course Book{" "}
                        <em>75%</em>
                      </p>
                      <p>
                        <strong>Special Subjects</strong> - Sing &amp; Chant /
                        Science <em>25%</em>
                      </p>
                    </div>
                    <ul>
                      <li>
                        다양한 방법으로 영어에 흥미를 가지고 재미있게
                        수업하도록 구성되었으며, Sing &amp; Chant, Science
                        과목들을 통하여
                        <br />
                        아이들이 신나고 즐겁게 영어를 배우면서 영어로 사고하고
                        자신감을 가지도록 돕습니다.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  );
}
