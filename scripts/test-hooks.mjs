// node:test 실행 시 TS path alias `@/*` 를 런타임에 `./src/*` 로 해석한다.
// (tsconfig.json 의 paths 와 동일 매핑. 앱 빌드/타입체크는 Next.js·tsc 가 처리하고,
//  순수 로직 단위 테스트만 이 훅으로 돌린다. 확장자 없는 specifier 는 .ts/.tsx/index.ts 를 탐색.)
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve as resolvePath, join } from "node:path";

const srcBase = resolvePath(process.cwd(), "src");

function withExtension(absPath) {
  if (/\.[a-z]+$/i.test(absPath)) return absPath;
  if (existsSync(absPath + ".ts")) return absPath + ".ts";
  if (existsSync(absPath + ".tsx")) return absPath + ".tsx";
  const indexTs = join(absPath, "index.ts");
  if (existsSync(indexTs)) return indexTs;
  return absPath;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const mapped = withExtension(resolvePath(srcBase, specifier.slice(2)));
      return nextResolve(pathToFileURL(mapped).href, context);
    }
    return nextResolve(specifier, context);
  },
});
