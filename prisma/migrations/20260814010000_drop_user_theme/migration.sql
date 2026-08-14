-- 책장 테마(색 바꾸기) 기능을 없애면서 컬럼도 함께 정리한다.
-- 색조는 이제 globals.css의 :root 기본값만 쓰고, 밝기는 브라우저에 저장한다.
ALTER TABLE "User" DROP COLUMN "theme";
