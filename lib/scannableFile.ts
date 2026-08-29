// GitHub 저장소든 zip 업로드든, 이후 탐지기에는 항상 이 형태로 전달된다.
export type ScannableFile = {
  path: string;
  content: string;
};
