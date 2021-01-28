export interface GithubFileInfoType {
  name: string;
  path: string;
  size: number;
  url: string;
  type: FileType;
  download_url: string;
}

export enum FileType {
  Dir = 'dir',
  File = 'file',
}

export interface ConfigType {
  name: string;
  description?: string;
}
