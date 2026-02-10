import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";
import styles from "./PrimoSchool.module.css";

export const metadata: Metadata = {
  title: "Primo School | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Primo School - 초등 저학년 집중 프로그램",
};

export default function PrimoSchoolPage() {
  return (
    <PageContent title="Primo School">
      <div className={`${styles.contents} ${styles.type4}`}>
        <div className={styles.program}>
          <div className={styles.primo}>
            <div className={styles.layout}>
              <div className={styles.txtBox}>
                <span>
                  <strong>초등 저학년 집중</strong> 프로그램
                </span>
                <h3>Primo School</h3>
                <p>
                  영어의 기초를 확립하여 <br />
                  자유로운 의사소통, 문해력 증진, <br />
                  배경지식을 쌓아가는 단계입니다
                </p>
              </div>
              <div className={styles.imgBox}>
                <img
                  src="/images/program/primo-school/primo_img.svg"
                  alt="Primo School 프로그램"
                />
              </div>
            </div>

            <div className={styles.gyBox}>
              <div className={styles.layout}>
                <h2>프로그램</h2>
                <div className={styles.levelobx}>
                  <div className={styles.no1obx}>
                    <span>1. 초등 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Galaxy</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>1.0 ~ 1.7</b>
                        </li>
                        <li>
                          Lexile : <b>25 ~ 275</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Aurora</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>1.5 ~ 2.0</b>
                        </li>
                        <li>
                          Lexile : <b>200 ~ 350</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Comet</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>1.8 ~ 2.5</b>
                        </li>
                        <li>
                          Lexile : <b>300 ~ 450</b>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className={styles.no2obx}>
                    <span>2. 중등 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Eclipse</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>2.3 ~ 3.0</b>
                        </li>
                        <li>
                          Lexile : <b>425 ~ 550</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Gravity</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>2.7 ~ 4.0</b>
                        </li>
                        <li>
                          Lexile : <b>525 ~ 650</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Hubble</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>3.5 ~ 5.0</b>
                        </li>
                        <li>
                          Lexile : <b>625 ~ 750</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Meteor</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>4.7 ~ 6.0</b>
                        </li>
                        <li>
                          Lexile : <b>725 ~ 850</b>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className={styles.no3obx}>
                    <span>3. 고등 프로그램</span>
                    <div>
                      <em>Level</em>
                      <strong>Orbit</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>5.7 ~ 7.0</b>
                        </li>
                        <li>
                          Lexile : <b>825 ~ 950</b>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <em>Level</em>
                      <strong>Prodigy</strong>
                      <ul>
                        <li>
                          미국교과과정 : <b>6.7 ~ 9.5</b>
                        </li>
                        <li>
                          Lexile : <b>925 ~ 1100</b>
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
