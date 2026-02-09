import Image from "next/image";

const GREETING_IMAGE =
  "https://images.unsplash.com/photo-1587654780291-39c9404d746b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600";

export function GreetingContent() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900 md:text-3xl">
              Everyone Smiles in Wonderland
            </h2>
            <p className="mb-8 text-xl font-medium text-gray-700">
              원더랜드에 오면 아이들이 행복합니다.
            </p>
            <div className="space-y-4 text-gray-600">
              <p>
                1993년 1호점 개원을 시작한 이후 원더랜드 전직원은 오로지
                아이들의 미래를 위한 영어교육을 생각하고 있습니다.
              </p>
              <p>
                놀이와 노래, 스토리와 활동 속에서 자연스럽게 영어를 익히고,
                자신 있게 말하고 쓰는 경험을 쌓아가도록 돕고 있습니다.
              </p>
              <p>
                원더랜드는 단순한 학원이 아니라, 아이들이 꿈을 키우고 세상과
                소통하는 힘을 기르는 공간입니다. 여러분의 관심과 참여에
                감사드립니다.
              </p>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-[320px] w-[320px] overflow-hidden rounded-full border-4 border-white shadow-xl">
              <Image
                src={GREETING_IMAGE}
                alt="원더랜드에서 즐겁게 학습하는 아이들"
                fill
                className="object-cover"
                sizes="320px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
