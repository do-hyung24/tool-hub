"use client";

import { useEffect, useState } from "react";

type GalleryImage = { id: string };

// 썸네일 그리드는 서버 렌더 결과와 동일하게 유지하되, 클릭 시 원본을
// 전체화면 오버레이로 보여주는 라이트박스를 추가한다.
export function RequestImageGallery({ images }: { images: GalleryImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null || images.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenIndex(null);
      } else if (event.key === "ArrowLeft") {
        setOpenIndex((current) => (current === null ? current : (current - 1 + images.length) % images.length));
      } else if (event.key === "ArrowRight") {
        setOpenIndex((current) => (current === null ? current : (current + 1) % images.length));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openIndex, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="block aspect-square w-full appearance-none overflow-hidden rounded-lg border-0 bg-transparent p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/requests/images/${image.id}`} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenIndex(null);
            }}
            aria-label="닫기"
            className="absolute right-4 top-4 text-zinc-300 hover:text-white"
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenIndex((current) =>
                  current === null ? current : (current - 1 + images.length) % images.length
                );
              }}
              aria-label="이전 사진"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white"
            >
              <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 5l-5 5 5 5" />
              </svg>
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/requests/images/${images[openIndex].id}`}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenIndex((current) => (current === null ? current : (current + 1) % images.length));
              }}
              aria-label="다음 사진"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white"
            >
              <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5l5 5-5 5" />
              </svg>
            </button>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-200">
              {openIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
