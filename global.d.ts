// declare process.env values
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_GITHUB_API: string;
    NEXT_PUBLIC_GA_FOUR: string;
    NEXT_PUBLIC_DISCORD_WEBHOOK_URL: string;
    NEXT_PUBLIC_ENV: string;
    NEXT_PUBLIC_MAPBOX_TOKEN: string;
  }
}
