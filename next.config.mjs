/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // `next dev` bez limitu sterty w NODE_OPTIONS ustawia dziecku
    // --max-old-space-size na 50% RAM (na 64 GB maszynie to 32 GB), a restartuje
    // je dopiero po przekroczeniu 80% tego limitu - bez backoffu i bez limitu
    // prob. Preload modulow wszystkich tras przy kazdym forku podbija sterte do
    // progu i restarty zamieniaja sie w lawine procesow node. Limit siedzi w
    // skrypcie `dev`, tutaj tniemy zuzycie u zrodla.
    preloadEntriesOnStart: false,
  },
};

export default nextConfig;
