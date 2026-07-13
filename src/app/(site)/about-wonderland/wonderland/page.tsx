import type { Metadata } from "next";
import Image from "next/image";
import styles from "./Wonderland.module.css";

export const metadata: Metadata = {
  title: "Wonderland | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonderland - 왜 다른가요?",
};

const IMG = {
  wonderland1: "/images/about-wonderland/wonderland/wonderland1.png",
  wonderland2: "/images/about-wonderland/wonderland/wonderland2.png",
  wonderland3: "/images/about-wonderland/wonderland/wonderland3.png",
};

export default function WonderlandPage() {
  return (
    <div className={styles.wonderland}>
      <div className={styles.top}>
        <div className={styles.layout}>
          <div className={styles.titleGroup}>
            <p>Why is Wonderland different?</p>
            <h1>
              Wonderland는
              <br />
              <span className={styles.colorGreen}>왜 다른가요?</span>
            </h1>
          </div>
          <div className={styles.txtBox}>
            주니어 영어 교육에 힘쓰며 탄탄한 수업구성과 교수방법을 갖추고
            있습니다.
            <br />
            교사의 일방적인 수업이 아닌 학습자 중심의 수업을 지향합니다.
          </div>
        </div>
      </div>

      <div className={styles.list}>
        <div className={styles.layout}>
          <div className={styles.box}>
            <div className={styles.txtBox}>
              <em>01</em>
              <h3>
                <span className={styles.colorOrange}>
                  Whole Language Approach
                </span>
                <br />
                총체적 언어 접근법
              </h3>
              <p>
                통합적인 언어기능에 초점을 두어 말하기, <br />
                듣기, 읽기, 쓰기를 고루 발달시킵니다.
              </p>
            </div>
            <div className={styles.imgBox}>
              <Image
                src={IMG.wonderland1}
                alt="Whole Language Approach"
                width={450}
                height={450}
              />
            </div>
          </div>

          <div className={styles.box}>
            <div className={styles.imgBox}>
              <Image
                src={IMG.wonderland2}
                alt="Communicative Language Teaching"
                width={450}
                height={439}
              />
            </div>
            <div className={styles.txtBox}>
              <em>02</em>
              <h3>
                <span className={styles.colorGreen}>
                  Communicative Language Teaching
                </span>
                <br />
                의사소통 언어 교육
              </h3>
              <p>
                학습에 그치지 않고 실제로 의사소통이 가능하고
                <br />
                상황에 맞게 언어를 사용하도록 지도합니다.
              </p>
            </div>
          </div>

          <div className={styles.box}>
            <div className={styles.txtBox}>
              <em>03</em>
              <h3>
                <span className={styles.colorBlue}>
                  Content-based Instruction
                </span>
                <br />
                내용 중심 접근법
              </h3>
              <p>
                다양한 주제의 내용들을 제 2외국어인 영어로
                <br />
                습득하게 합니다.
              </p>
            </div>
            <div className={styles.imgBox}>
              <Image
                src={IMG.wonderland3}
                alt="Content-based Instruction"
                width={480}
                height={400}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.banner}>
        <div className={styles.txtBox}>
          <h3>
            <span>아이들의 눈높이에 맞게 디자인</span>된 수업을 통하여
          </h3>
          <p>
            새로운 언어에 대한 흥미를 더하고 스스로 동기를 유발하도록 이끌어
            주어
            <br />
            쉽고 자연스럽게 발화하고 자신감을 갖도록 지도합니다.
          </p>
        </div>
      </div>

      <div className={styles.txt}>
        <h3>외우는 영어가 아닙니다.</h3>
        <h2>
          <strong>
            <span className={styles.colorOrange}>보고</span>,{" "}
            <span className={styles.colorBlue}>듣고</span>,{" "}
            <span className={styles.colorGreen}>활동</span> 하면서
          </strong>
          <br />
          배우는 영어입니다.
        </h2>
      </div>
    </div>
  );
}
