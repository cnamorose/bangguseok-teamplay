import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 공부방 화면이 /study 아래로 옮겨가기 전의 옛 주소들.
  // 북마크·기존 링크가 404로 떨어지지 않게 넘겨준다.
  async redirects() {
    return [
      { source: "/bookshelf", destination: "/study/bookshelf", permanent: false },
      { source: "/create", destination: "/study/create", permanent: false },
      { source: "/evaluate", destination: "/study/evaluate", permanent: false },
    ];
  },
};

export default nextConfig;
