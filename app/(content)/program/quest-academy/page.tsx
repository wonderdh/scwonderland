import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";
import styles from "./QuestAcademy.module.css";

export const metadata: Metadata = {
  title: "Quest Academy | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Quest Academy - 초등 고학년·중등 전문 프로그램",
};

export default function QuestAcademyPage() {
  return (
    <PageContent title="Quest Academy">
      <div className={`${styles.contents} ${styles.type4}`}>
        <div className={styles.program}>
          <div className={styles.questacademy}>
            <div className={styles.layout}>
              <div className={styles.txtBox}>
                <span>
                  <strong>초등 고학년·중등 전문</strong> 프로그램
                </span>
                <h3>Quest Academy</h3>
                <p>
                  영어의 모든 영역을 최고 단계로 <br />
                  성장 발전시키는 영어 영재 프로그램으로
                  <br />
                  미래의 Global Leader를 양성하는 집중 단계입니다.
                </p>
              </div>
              <div className={styles.imgBox}>
                <img
                  src="/images/program/quest-academy/quest_img.svg"
                  alt="Quest Academy 프로그램"
                />
              </div>
            </div>

            <div className={styles.gyBox}>
              <div className={styles.layout}>
                <h2>프로그램</h2>
                <div className={styles.levelobx}>
                  <div className={styles.no1obx}>
                    <span>1. 영재 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Twilight</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>2.5 ~ 4.0</b>
                        </li>
                        <li>
                          Lexile : <b>450 ~ 650</b>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className={styles.no2obx}>
                    <span>2. 중등 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Vesper</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>3.7 ~ 6.0</b>
                        </li>
                        <li>
                          Lexile : <b>625 ~ 850</b>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className={styles.no3obx}>
                    <span>3. 고등 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Nova</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>5.7 ~ 8.0</b>
                        </li>
                        <li>
                          Lexile : <b>825 ~ 1000</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Prodigy Advanced</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>7.7 ~ 10.0</b>
                        </li>
                        <li>
                          Lexile : <b>975 ~ 1200</b>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className={styles.no4obx}>
                    <span>4. Global Leader 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Global Leader</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>9.5 ~ 10.0 +</b>
                        </li>
                        <li>
                          Lexile : <b>1100 ~ 1200 +</b>
                        </li>
                      </ul>
                    </div>
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
