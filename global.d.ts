// declare process.env values
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_GA_FOUR?: string;
    NEXT_PUBLIC_MAPBOX_TOKEN?: string;
    DISCORD_WEBHOOK_URL?: string;
    AIRTABLE_PERSONAL_ACCESS_TOKEN?: string;
    AIRTABLE_BASE_ID?: string;
    AIRTABLE_TABLE_NAME?: string;
  }
}
