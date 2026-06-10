# terry-cv — Academic CV (KO/EN) build system

단일 한국어 마크다운 소스(`cv.ko.md`)에서 한글·영문 PDF 두 개를 생성한다.
디자인: **Classic Academic** (serif, 단일 컬럼, 가운데 정렬 이름, 가로줄 섹션 헤더).
렌더링: HTML + CSS → headless Chrome.

## 파일 구조

- `cv.ko.md` — ★ **유일하게 사람이 편집하는 소스 파일 (한국어).**
- `cv.en.md` — `cv.ko.md`를 번역해 자동 생성. **직접 편집하지 말 것** (다음 빌드에서 덮어쓰여짐).
- `assets/portrait.jpg` — 증명사진. **한글 PDF에만** 들어감 (영문 PDF는 사진 없음).
- `templates/classic.css` — 디자인 스타일시트.
- `scripts/build.mjs` — md → HTML → PDF 변환기.
- `dist/cv.ko.pdf`, `dist/cv.en.pdf` — 산출물.

## 마크다운 작성 규칙 (`cv.ko.md`)

- 상단 YAML frontmatter: `name`, `name_en`, `title`, `title_en`, `photo`, `email`(리스트), `homepage`, `scholar`, `linkedin`, `metrics`, `metrics_en`.
- 섹션은 `## 제목`.
- **경력/학력 항목의 날짜 정렬**: `왼쪽 내용 || 오른쪽날짜` 형식. ` || ` (공백-파이프파이프-공백)을 기준으로 좌(제목)·우(기간)로 나뉘어 양끝 정렬된다.
  예) `**코스맥스 — AI혁신본부장 (상무)** || 2024.11 – 현재`
- **Publications 섹션**: `## Publications` 헤딩 바로 뒤의 번호 목록이 논문 스타일로 렌더된다. 본인 이름은 `**TT Um**`처럼 굵게. 피인용수는 `(1,186 cites)` 형식 → 자동으로 회색 처리. **논문 리스트는 한/영 공통으로 영문 원문 유지(번역하지 않음).**

## 명령: "pdf 만들어줘" / "cv를 업데이트 해줘"

둘 다 동일 동작. Claude가 다음을 수행한다:

1. `cv.ko.md`를 읽어 **`cv.en.md`를 새로 생성**(번역).
   - 모든 산문/섹션을 영어로 번역.
   - **`## Publications` 섹션은 `cv.ko.md`의 내용을 그대로 복사**(번역 금지).
   - frontmatter는 영문 필드 사용, `photo:` 필드는 제거(영문판 사진 없음).
2. `node scripts/build.mjs` 실행 → `dist/cv.ko.pdf`, `dist/cv.en.pdf` 재생성.
3. 결과 경로 보고. 커밋/푸시는 사용자가 요청할 때만.

부분 빌드: `node scripts/build.mjs ko` 또는 `... en`.

## 사진 교체

`assets/portrait.jpg` 파일을 교체하면 다음 빌드부터 반영. 없으면 한글판에 placeholder 박스가 표시됨.

## 별도 문서: 겸임교원 자기소개서 + 활동계획서 (KO 전용 2장 PDF)

서울대 공대 제조 피지컬AI 겸임교원 지원용. CV와 분리된 빌드 경로.

- `statement.ko.md` — ★ **유일하게 사람이 편집하는 소스.** frontmatter + `# H1` 두 개(겸임교원 자기소개서 / 활동계획서)로 구성. 각 `# H1`이 한 페이지가 됨. `## 소제목`으로 섹션.
- `templates/statement.css` — `classic.css` 위에 얹는 문서 레이아웃(문서제목·지원자줄·산문·페이지 분할). 폰트·색·`h2` 가로줄 헤더는 `classic.css` 재사용.
- `scripts/build-statement.mjs` — `statement.ko.md` → `dist/statement.ko.pdf`.
- 채움 목표: 1장(자기소개서) 80%↑, 2장(활동계획서) ~60%. 본문 길이·`statement.css`의 `.doc-body p` line-height로 미세조정.

### 명령: "pdf 만들어줘" / "자기소개서 업데이트"

`statement.ko.md`를 수정한 뒤 이 요청이 오면 (CV가 아니라 이 문서 맥락이면):
1. `node scripts/build-statement.mjs` 실행 → `dist/statement.ko.pdf` 재생성.
2. **정확히 2장**인지, 1장 80%↑ / 2장 ~60% 채움인지 렌더 확인 (`pdftoppm -png -r 90 dist/statement.ko.pdf /tmp/stmt`). 넘치거나 모자라면 본문/line-height 조정 후 재빌드.
3. 결과 경로 보고. (npm: `npm run build:statement`)
