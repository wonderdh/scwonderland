"use client";

import Image from "next/image";
import { useState } from "react";

const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==";

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function ImageWithFallback({
  src,
  alt,
  className,
  priority,
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);

  if (didError) {
    return (
      <div
        className={`relative bg-gray-100 text-center ${className ?? ""}`}
      >
        <div className="flex h-full w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ERROR_IMG_SRC}
            alt="이미지를 불러올 수 없습니다"
            data-original-url={src}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover"
        priority={priority}
        onError={() => setDidError(true)}
      />
    </div>
  );
}
